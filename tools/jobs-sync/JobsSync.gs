/**
 * 513 Auto Clean: Jobs -> Google Sheet, automatically.
 *
 * Reads every job from the booking calendars (the website writes each booking
 * there, and GoHighLevel will sync its appointments there too) and keeps two
 * tabs in this spreadsheet up to date:
 *
 *   "Jobs (auto)"    one row per job: date, status, service, ZIP, area,
 *                    total, pre-tax, lead source, detailer
 *   "Jobs by Area"   jobs, revenue and average job per area, with a chart
 *
 * Runs every hour on its own after one-time setup (see README.md next to this
 * file). Rows are matched by calendar event ID, so re-runs update rather than
 * duplicate. Two columns are yours: "Price override" and "Area override".
 * Type in them and the sync keeps what you typed.
 *
 * No customer phone numbers or emails are copied into the sheet.
 *
 * NEEDS the "Google Calendar API" advanced service (Services > + in the Apps
 * Script editor, identifier "Calendar"). CalendarApp can't tell a Free event
 * from a Busy one, and the website marks its fee blocks Free.
 *
 * The website side of this is kept in step by web/lib/jobs-sync-contract.test.ts
 * in the 513 Auto Clean repo: the TOTAL, sales tax, SOURCE, HEARD ABOUT US,
 * ZIP and detailer patterns below are the ones that test checks.
 */

/* ======================= FILL THESE IN ======================= */

// The calendars to read. Each one: its Calendar ID (Google Calendar >
// the calendar's Settings and sharing > Integrate calendar > Calendar ID),
// its name (used to find it if the ID is still a PASTE- placeholder), and
// who did the job when the event title names nobody.
const CALENDARS = [
  {
    id: '75726fed82aa92a27201386beda7b3a15f550a3a5691e5e6cfc51382f0f0b9cf@group.calendar.google.com',
    name: '513 Auto Clean',
    detailer: 'Elijah', // your own jobs carry no "Name:" in the title
  },
  {
    id: 'PASTE-KRIS-BOOKINGS-ID@group.calendar.google.com', // <-- 513 Kris Bookings
    name: '513 Kris Bookings',
    detailer: 'Kris',
  },
];

/* ============================================================= */

const CONFIG = {
  startDate: new Date('2026-01-01T00:00:00-05:00'),
  daysAhead: 60,
  jobsTab: 'Jobs (auto)',
  areaTab: 'Jobs by Area',
  officeMatch: /505\s+Sandheger/i,               // home/office, never a customer job
  // Not jobs. OPEN and "OPEN +20%" are working hours, BEST marks best times,
  // DNS is blocked time. Whole word, as the website reads them.
  skipTitle: /^(open|best|dns|busy|blocked?|unavailable|availability|hold|personal)\b/i,
  cancelTitle: /\b(cancel+ed|cancel|no[- ]show|refunded)\b/i,
};

// The detailer named at the start of a title, after any SHORT NOTICE prefix:
// "Kris: Full Interior, Jane Doe" or
// "SHORT NOTICE, accept or decline: Kris: Full Interior, Jane Doe".
const DETAILER = /^(?:SHORT NOTICE[^:]*:\s*)?([A-Z][a-z]+):/;

// ZIP -> area. Matches the areas in the team brief's "value by area" table.
const AREAS = {
  'West side': ['45002', '45030', '45052', '45204', '45205', '45211', '45233', '45238', '45239', '45247', '45248', '45251', '45252'],
  'Northeast': ['45241', '45242', '45243', '45249'],
  'East / Clermont': ['45103', '45140', '45150', '45157', '45174', '45230', '45244', '45245', '45255'],
  'East-central': ['45207', '45208', '45209', '45212', '45213', '45226', '45227', '45236'],
  'North': ['45011', '45014', '45040', '45069', '45215', '45216', '45218', '45224', '45231', '45237', '45240', '45246'],
  'Uptown / Central': ['45206', '45217', '45219', '45220', '45223', '45225', '45229', '45232'],
  'Downtown / OTR': ['45202', '45203', '45214'],
};
const ZIP_AREA = Object.keys(AREAS).reduce(function (m, a) {
  AREAS[a].forEach(function (z) { m[z] = a; });
  return m;
}, {});

const HEADERS = ['Event ID', 'Date', 'Status', 'Title', 'Service', 'ZIP', 'Area', 'Total', 'Pre-tax',
  'Lead source', 'Detailer', 'Calendar', 'Price override', 'Area override', 'Last synced'];

/** Run once by hand: authorizes, does a first sync and installs the hourly trigger. */
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'syncJobs') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('syncJobs').timeBased().everyHours(1).create();
  syncJobs();
}

/** Adds a "513 Jobs" menu so the sync can be run on demand from the sheet. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('513 Jobs')
    .addItem('Sync jobs now', 'syncJobs')
    .addToUi();
}

function syncJobs() {
  if (typeof Calendar === 'undefined') {
    throw new Error('Turn on the Google Calendar API service first: Apps Script editor > Services > + > Google Calendar API > Add.');
  }
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName(CONFIG.jobsTab) || ss.insertSheet(CONFIG.jobsTab);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }

  // Existing rows by event ID, so overrides survive.
  const existing = {};
  const last = sheet.getLastRow();
  if (last > 1) {
    sheet.getRange(2, 1, last - 1, HEADERS.length).getValues().forEach(function (r, i) {
      if (r[0]) existing[r[0]] = { row: i + 2, priceOv: r[12], areaOv: r[13] };
    });
  }

  const end = new Date(Date.now() + CONFIG.daysAhead * 864e5);
  const now = new Date();
  const updates = [];
  const appends = [];
  const duplicates = [];
  const seenIds = {};          // the same event on two calendars
  const seenBookings = {};     // the website wrote the same booking twice (a retried submit)

  calendars().forEach(function (cal) {
    listEvents(cal.id, CONFIG.startDate, end).forEach(function (ev) {
      const row = jobRow(ev, cal, now);
      if (!row) return;
      const id = row[0];
      const bookingKey = (ev.extendedProperties && ev.extendedProperties.private &&
        ev.extendedProperties.private.bookingKey) || '';
      if (seenIds[id] || (bookingKey && seenBookings[bookingKey])) {
        // Counted once already. If an earlier sync gave it its own row,
        // mark that row so the area and month totals leave it out.
        if (existing[id] && !seenIds[id]) duplicates.push(existing[id].row);
        return;
      }
      seenIds[id] = true;
      if (bookingKey) seenBookings[bookingKey] = true;

      const prev = existing[id] || {};
      row[12] = prev.priceOv || '';
      row[13] = prev.areaOv || '';
      if (prev.row) updates.push({ row: prev.row, values: row });
      else appends.push(row);
    });
  });

  updates.forEach(function (u) { sheet.getRange(u.row, 1, 1, HEADERS.length).setValues([u.values]); });
  duplicates.forEach(function (r) { sheet.getRange(r, 3).setValue('Duplicate'); });
  if (appends.length) sheet.getRange(sheet.getLastRow() + 1, 1, appends.length, HEADERS.length).setValues(appends);
  if (sheet.getLastRow() > 2) sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).sort({ column: 2, ascending: true });
  sheet.getRange('B:B').setNumberFormat('yyyy-mm-dd h:mm am/pm');
  sheet.getRange('H:I').setNumberFormat('$#,##0.00');
  sheet.getRange('M:M').setNumberFormat('$#,##0.00');

  buildAreaTab(ss);
}

/**
 * One sheet row for a calendar event (Calendar API v3 shape), or null when
 * the event isn't a job. Price override and Area override are filled by the
 * caller from the existing row.
 */
function jobRow(ev, cal, now) {
  const title = ev.summary || '';
  const loc = ev.location || '';
  const desc = ev.description || '';
  if (ev.status === 'cancelled') return null;
  if (ev.transparency === 'transparent') return null;   // marked Free: fee blocks and the like
  if (CONFIG.skipTitle.test(title.trim())) return null;
  if (CONFIG.officeMatch.test(loc) || CONFIG.officeMatch.test(desc)) return null;
  const allDay = !ev.start.dateTime;
  if (allDay && !/\$\d/.test(title + desc)) return null;

  const start = eventTime(ev.start);
  const endTime = eventTime(ev.end);
  const zip = findZip(loc) || findZip(desc);
  const money = findMoney(title, desc);
  const status = CONFIG.cancelTitle.test(title) ? 'Cancelled'
    : (endTime < now ? 'Done' : 'Upcoming');
  return [
    eventId(ev),
    start,
    status,
    title.slice(0, 120),
    findService(title, desc),
    zip,
    areaFor(zip, loc),
    money.total,
    money.preTax,
    findBlock(desc, 'SOURCE') || findBlock(desc, 'HEARD ABOUT US') || '',
    (title.match(DETAILER) || [])[1] || cal.detailer,
    cal.name,
    '',
    '',
    now,
  ];
}

/** "Jobs by Area": live formulas over the jobs tab, plus a bar chart. */
function buildAreaTab(ss) {
  let t = ss.getSheetByName(CONFIG.areaTab);
  if (t) return; // formulas update themselves; build once
  t = ss.insertSheet(CONFIG.areaTab);
  const J = "'" + CONFIG.jobsTab + "'";
  // Effective area = override if set, else auto. Effective price = override if set, else pre-tax.
  t.getRange('A1').setValue('Done jobs by area (pre-tax). Updates on its own from ' + CONFIG.jobsTab + '.');
  t.getRange('A2').setFormula(
    '=QUERY({ARRAYFORMULA(IF(' + J + '!N2:N<>"",' + J + '!N2:N,' + J + '!G2:G)),' +
    'ARRAYFORMULA(IF(' + J + '!M2:M<>"",' + J + '!M2:M,' + J + '!I2:I)),' + J + '!C2:C},' +
    '"select Col1, count(Col1), sum(Col2), avg(Col2) where Col3 = \'Done\' and Col1 is not null ' +
    'group by Col1 order by avg(Col2) desc ' +
    'label Col1 \'Area\', count(Col1) \'Jobs\', sum(Col2) \'Revenue\', avg(Col2) \'Avg job\'", 0)');
  t.getRange('C:D').setNumberFormat('$#,##0');
  t.getRange('F1').setValue('Jobs by month');
  t.getRange('F2').setFormula(
    '=QUERY({ARRAYFORMULA(IF(' + J + '!B2:B="",,TEXT(' + J + '!B2:B,"yyyy-mm"))),' +
    'ARRAYFORMULA(IF(' + J + '!M2:M<>"",' + J + '!M2:M,' + J + '!I2:I)),' + J + '!C2:C},' +
    '"select Col1, count(Col1), sum(Col2) where Col3 = \'Done\' and Col1 is not null group by Col1 order by Col1 ' +
    'label Col1 \'Month\', count(Col1) \'Jobs\', sum(Col2) \'Revenue\'", 0)');
  t.getRange('H:H').setNumberFormat('$#,##0');
  t.getRange('A:H').setFontFamily('Arial');
  const chart = t.newChart().asBarChart()
    .addRange(t.getRange('A2:A12')).addRange(t.getRange('D2:D12'))
    .setOption('title', 'Average job by area (pre-tax)')
    .setOption('legend', { position: 'none' })
    .setPosition(15, 1, 0, 0).build();
  t.insertChart(chart);
}

/* ---------------- helpers ---------------- */

/** The calendars in CALENDARS that this account can read, each with a real ID. */
function calendars() {
  const out = [];
  CALENDARS.forEach(function (c) {
    let id = /^PASTE-/.test(c.id) ? '' : c.id;
    if (!id && c.name) {
      const found = CalendarApp.getCalendarsByName(c.name);
      if (found.length) id = found[0].getId();
    }
    if (!id) { console.warn('No calendar ID for "' + c.name + '": fill it in at the top of the script.'); return; }
    if (out.some(function (o) { return o.id === id; })) return;
    out.push({ id: id, name: c.name, detailer: c.detailer });
  });
  return out;
}

/** Every event in the window, recurring ones expanded, through the Calendar API. */
function listEvents(calendarId, from, to) {
  const items = [];
  let pageToken;
  try {
    do {
      const res = Calendar.Events.list(calendarId, {
        timeMin: from.toISOString(),
        timeMax: to.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 2500,
        pageToken: pageToken,
      });
      (res.items || []).forEach(function (e) { items.push(e); });
      pageToken = res.nextPageToken;
    } while (pageToken);
  } catch (err) {
    // Not shared with this account, or a wrong ID. The other calendars still sync.
    console.warn('Could not read calendar ' + calendarId + ': ' + err);
  }
  return items;
}

/**
 * The row key. The same ID the old CalendarApp version wrote (its getId() is
 * the iCalUID), so existing rows and their overrides carry over. A repeating
 * event shares one iCalUID across every date, so each date gets its own ID.
 */
function eventId(ev) {
  return ev.recurringEventId ? ev.id : (ev.iCalUID || ev.id);
}

/** A start or end: a time, or for an all-day event the local midnight of its date. */
function eventTime(t) {
  if (t.dateTime) return new Date(t.dateTime);
  const d = String(t.date).split('-');
  return new Date(Number(d[0]), Number(d[1]) - 1, Number(d[2]));
}

function areaFor(zip, loc) {
  if (ZIP_AREA[zip]) return ZIP_AREA[zip];
  if (zip.indexOf('41') === 0 || /\bKY\b|Kentucky/i.test(loc)) return 'Northern Kentucky';
  return zip ? 'Other (' + zip + ')' : 'Unknown';
}

function findZip(s) {
  const m = String(s).match(/\b(4[0-5]\d{3})(?:-\d{4})?\b/g);
  return m ? m[m.length - 1].slice(0, 5) : '';
}

/** Website bookings carry "TOTAL: $x" and a tax line; older manual events usually have one $ amount. */
function findMoney(title, desc) {
  const num = function (s) { return Number(String(s).replace(/[$,]/g, '')); };
  const total = desc.match(/TOTAL:\s*\$([\d,]+(?:\.\d\d)?)/i);
  if (total) {
    const tax = desc.match(/Sales tax[^:\n]*:\s*\$([\d,]+(?:\.\d\d)?)/i);
    const t = num(total[1]);
    return { total: t, preTax: tax ? Math.round((t - num(tax[1])) * 100) / 100 : t };
  }
  const any = (title + '\n' + desc).match(/\$\s?([\d,]+(?:\.\d\d)?)/);
  if (any) return { total: num(any[1]), preTax: num(any[1]) };
  return { total: '', preTax: '' };
}

/**
 * The service. A website booking's title lists its packages exactly
 * ("Kris: Full Interior + Full Exterior, Jane Doe"), so those names are used,
 * with "+ Steam" when the steam add-on is booked. Events typed by hand fall
 * back to keywords.
 */
function findService(title, desc) {
  const rest = title.replace(/^(?:SHORT NOTICE[^:]*:\s*)?(?:[A-Z][a-z]+:\s*)?/, '');
  if (/^HELP ME DECIDE\b/.test(rest)) return 'Help me decide';
  if (/(?:^|\n)WHO\s/.test(desc)) {   // written by the website
    const names = rest.split(', ')[0];
    if (!names || names === 'Detail') return '';
    return names + (/\n\s+\+ [^\n]*steam/i.test(desc) ? ' + Steam' : '');
  }
  const s = (title + ' ' + desc).toLowerCase();
  if (/help me decide/.test(s)) return 'Help me decide';
  if (/showroom/.test(s)) return 'Showroom Ready';
  if (/full interior|full int\b/.test(s)) return /steam/.test(s) ? 'Full Interior + Steam' : 'Full Interior';
  if (/basic interior|basic int\b/.test(s)) return 'Basic Interior';
  if (/exterior|wash|wax/.test(s)) return 'Exterior / Both';
  if (/basic/.test(s)) return 'Basic Interior';
  return '';
}

function findBlock(desc, heading) {
  const m = String(desc).match(new RegExp('(?:^|\\n)' + heading + '\\n\\s+([^\\n]+)'));
  return m ? m[1].trim() : '';
}
