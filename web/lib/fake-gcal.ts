/**
 * A stand-in for Google Calendar (and Resend), for the master calendar tests.
 * Nothing here reaches a real service: install() replaces globalThis.fetch
 * and restore() puts it back.
 *
 * Enough of the Calendar API to be honest about what the code relies on:
 * events.list (time window, singleEvents, privateExtendedProperty, pages),
 * events.get (a deleted event reads as status "cancelled", as Google keeps
 * it), insert with a chosen id (409 when the id is taken, deleted or not),
 * update, patch (nested objects merge), delete.
 */
export interface FakeEvent {
  id: string;
  status?: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  transparency?: string;
  colorId?: string;
  extendedProperties?: { private?: Record<string, string> };
}

interface Cal {
  summary: string;
  events: Map<string, FakeEvent>;
  failList?: boolean;
  failGet?: boolean;
  failWrite?: boolean;
  hang?: boolean;
}

export interface Call { method: string; url: string; calendarId: string | null; body: unknown }

const res = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const ms = (t: FakeEvent["start"]) => (t?.dateTime ? Date.parse(t.dateTime) : t?.date ? Date.parse(`${t.date}T00:00:00Z`) : NaN);

export function fakeGoogle({ pageSize = 250 } = {}) {
  const cals = new Map<string, Cal>();
  const calls: Call[] = [];
  const emails: { to: string[]; subject: string; html: string }[] = [];
  let n = 0;
  let saved: typeof fetch | null = null;

  const cal = (id: string, summary = id): Cal => {
    if (!cals.has(id)) cals.set(id, { summary, events: new Map() });
    return cals.get(id)!;
  };

  const handle = async (url: string, init?: RequestInit): Promise<Response> => {
    const u = new URL(url);
    const method = (init?.method || "GET").toUpperCase();
    const body = typeof init?.body === "string" && init.body ? JSON.parse(init.body) : undefined;
    const m = /^\/calendar\/v3\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/.exec(u.pathname);
    const calendarId = m ? decodeURIComponent(m[1]!) : null;
    calls.push({ method, url, calendarId, body });

    if (u.host === "oauth2.googleapis.com") return res(200, { access_token: "t", expires_in: 3600 });
    if (u.host === "api.resend.com") { emails.push(body); return res(200, { id: "mail" }); }
    if (!m || u.host !== "www.googleapis.com") return res(404, {});

    const c = cals.get(calendarId!);
    if (!c) return res(404, { error: { code: 404, message: "Not Found" } });
    if (c.hang) return new Promise<Response>(() => {});
    const evId = m[2] ? decodeURIComponent(m[2]) : null;

    if (method === "GET" && !evId) {
      if (c.failList) return res(500, { error: { code: 500 } });
      const q = u.searchParams;
      const from = q.get("timeMin") ? Date.parse(q.get("timeMin")!) : -Infinity;
      const to = q.get("timeMax") ? Date.parse(q.get("timeMax")!) : Infinity;
      const prop = q.get("privateExtendedProperty");
      const all = [...c.events.values()]
        .filter((e) => q.get("showDeleted") === "true" || e.status !== "cancelled")
        .filter((e) => ms(e.end) > from && ms(e.start) < to)
        .filter((e) => {
          if (!prop) return true;
          const [k, v] = prop.split("=");
          return e.extendedProperties?.private?.[k!] === v;
        })
        .sort((a, b) => ms(a.start) - ms(b.start));
      const size = Math.min(Number(q.get("maxResults") || 250), pageSize);
      const offset = Number(q.get("pageToken") || 0);
      const items = all.slice(offset, offset + size).map((e) => structuredClone(e));
      const next = offset + size < all.length ? String(offset + size) : undefined;
      return res(200, { summary: c.summary, items, ...(next ? { nextPageToken: next } : {}) });
    }
    if (method === "GET") {
      if (c.failGet) return res(500, { error: { code: 500 } });
      const e = c.events.get(evId!);
      return e ? res(200, structuredClone(e)) : res(404, { error: { code: 404 } });
    }
    if (c.failWrite) return res(503, { error: { code: 503 } });
    if (method === "POST") {
      const id = body.id || `ev${++n}`;
      if (c.events.has(id)) return res(409, { error: { code: 409, message: "The requested identifier already exists." } });
      const e = { ...body, id, status: body.status || "confirmed" };
      c.events.set(id, e);
      return res(200, e);
    }
    const have = c.events.get(evId!);
    if (!have) return res(404, { error: { code: 404 } });
    if (method === "PUT") {
      const e = { ...body, id: evId!, status: body.status || "confirmed" };
      c.events.set(evId!, e);
      return res(200, e);
    }
    if (method === "PATCH") {
      const e: FakeEvent = { ...have, ...body, id: evId! };
      if (body.extendedProperties?.private) {
        e.extendedProperties = { private: { ...(have.extendedProperties?.private ?? {}), ...body.extendedProperties.private } };
      }
      c.events.set(evId!, e);
      return res(200, e);
    }
    if (method === "DELETE") {
      if (have.status === "cancelled") return res(410, { error: { code: 410 } });
      have.status = "cancelled";
      return new Response(null, { status: 204 });
    }
    return res(400, {});
  };

  return {
    cals,
    cal,
    calls,
    emails,
    /** Put an event on a calendar as a detailer would, from a phone. */
    add(calendarId: string, e: Partial<FakeEvent> & { startMs: number; endMs: number }) {
      const { startMs, endMs, ...rest } = e;
      const id = rest.id || `orig${++n}`;
      const ev: FakeEvent = {
        status: "confirmed",
        ...rest,
        id,
        start: { dateTime: new Date(startMs).toISOString(), timeZone: "America/New_York" },
        end: { dateTime: new Date(endMs).toISOString(), timeZone: "America/New_York" },
      };
      cal(calendarId).events.set(id, ev);
      return ev;
    },
    live(calendarId: string) {
      return [...(cals.get(calendarId)?.events.values() ?? [])].filter((e) => e.status !== "cancelled");
    },
    writes() {
      return calls.filter((c) => c.calendarId && c.method !== "GET");
    },
    install() {
      saved = globalThis.fetch;
      globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => handle(String(url), init)) as typeof fetch;
    },
    restore() {
      if (saved) globalThis.fetch = saved;
      saved = null;
    },
  };
}
