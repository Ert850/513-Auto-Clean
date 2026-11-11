# Handoff: preview the 513 Auto Clean website from the `eNov6` branch

**To the agent reading this:** the owner of 513 Auto Clean wants to see the newest version of the website on their own computer, before any of it goes live. Your job is to get the `eNov6` branch from GitHub, build it, serve it locally, and open it for them. You only **read and run**: nothing gets edited, committed, pushed or deployed.

- **Repository:** <https://github.com/Ert850/513-Auto-Clean> (public, so no sign-in is needed)
- **Branch:** `eNov6`. The live site runs from `main`, which stays untouched until the owner approves a merge.
- **Tested:** a fresh clone of `eNov6` built and ran with these exact steps on macOS with Node 22, on November 12, 2026.

---

## Rules (read first)

1. **Don't submit the booking form or the Contact form.** Both send real emails to the business inbox straight from the browser, even on a local preview. The owner can click through every step and stop at the last one. "Confirm booking", "Send request" and the Contact page's "Send" are the buttons not to press.
2. **Don't change anything in the repository.** Don't commit, push, open pull requests, merge or deploy. The build rewrites a few files in the working copy, and that's expected. Leave them alone.
3. **Never put keys or passwords in any file.** The preview works without them (see "What the local preview can't do").
4. **Don't run `npm run gcal:token` or anything under `netlify/`.** Those touch the business's Google Calendar and email accounts.

---

## Steps

### 1. Check the tools

```bash
git --version
node --version
```

You need **Node 22** (what the site is built and tested with; 20 will probably work but hasn't been tried). If Node is missing or older, ask the owner before installing it, for example from <https://nodejs.org> (LTS) or `brew install node@22` on a Mac.

### 2. Get the branch

First time:

```bash
git clone --branch eNov6 --single-branch https://github.com/Ert850/513-Auto-Clean.git 513-auto-clean
cd 513-auto-clean
```

If it's already cloned:

```bash
cd 513-auto-clean
git fetch origin eNov6
git checkout eNov6
git reset --hard origin/eNov6
```

`reset --hard` throws away local changes in that folder, including the files the last build rewrote. Run it only in a folder used for previewing.

Check you have the newest version: `git log --oneline -1` should show the latest commit on <https://github.com/Ert850/513-Auto-Clean/commits/eNov6>.

### 3. Build

```bash
npm run build
```

This takes about a minute and downloads the build tools the first time. It's fine for the log to say keys are missing (calendar, payments, analytics): the preview runs without them. The finished site is written to the `dist/` folder.

### 4. Serve it

```bash
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Without Python, use `npx --yes http-server dist -p 8080 -a 127.0.0.1 -c-1` instead. On Windows, `py -m http.server 8080 --bind 127.0.0.1 --directory dist`.

If port 8080 is taken, use another (8081, 8090 and so on) in both the command and the address. Leave the server running while the owner looks, and stop it with Ctrl+C afterwards.

### 5. Open it for the owner

Open <http://127.0.0.1:8080> in their browser. After any rebuild, **hard-reload** (Cmd+Shift+R on a Mac, Ctrl+Shift+R on Windows), or the browser keeps showing the old version.

To see a newer version later: repeat steps 2 (the "already cloned" part), 3 and 4, then hard-reload.

---

## What the local preview can't do

The live site gets its keys from Netlify, and a local copy has none, so:

| On the live site | In this preview |
|---|---|
| Real openings from the detailers' Google calendars | Standard working hours, so the times offered are examples |
| Address suggestions as you type | Type the address by hand |
| Travel fee measured from the exact drive | Estimated from the ZIP code |
| Booking confirmation, travel and payment functions | Not running |
| Analytics | Off |

Everything else is the real site: the pages, the header, prices, the booking form's screens and wording, the time picker, Review, and the phone layout (make the window narrow, or use the browser's device toolbar).

---

## What's new to look at

The full list with reasons is in `docs/STATUS-2026-11-11.pdf` and `docs/SESSION-CHANGES-pipeline.md` (newest round first). The highlights:

- **Header:** drag the window narrower. Links that don't fit move into a "More" menu, Book Now always stays in view, and the menu button takes over on small windows and phones.
- **Booking form (any Book Now):**
  - a shorter checkout (Contact, Address, Time, Review), with Continue always at the bottom right;
  - on a laptop, the time picker's "See additional times" shows one day as half-hour rows, with a card describing the time you point at;
  - Review and book; stop before Confirm.
- **Results carousel** on the home page: before and after photos on one shared 8 second cycle.

The owner's open questions are in `docs/OWNER-QUESTIONS-MAGAZINES.pdf`.

---

## If something goes wrong

- **`npm run build` fails:** check `node --version` says 22, then run it again (the first run can fail on a flaky network). Send the last 20 lines of the output to whoever sent this file.
- **The page is blank or looks old:** hard-reload. Make sure the address uses the port the server printed.
- **"Address already in use":** another program has the port; pick another number.
