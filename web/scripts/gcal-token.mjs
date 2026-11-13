/**
 * Mint a Google Calendar refresh token, once, on this laptop.
 *
 *   npm run gcal:token
 *
 * WHY THIS EXISTS. Writing a booking onto the calendar normally uses a
 * service account, which is a machine identity with its own downloadable key.
 * Google now enables `iam.disableServiceAccountKeyCreation` by default on a
 * lot of accounts, and lifting it takes organisation-level access a sole
 * trader with a Gmail address does not have. Being unable to download a key
 * file should not mean bookings never reach the calendar.
 *
 * So this does the other thing: you consent once, in a browser, to an app
 * that can write to your own calendar. Google hands back a REFRESH TOKEN,
 * which mints access tokens forever afterwards with nobody present. That is
 * the credential Netlify holds.
 *
 * WHAT IT NEVER DOES. It does not write the token anywhere, does not send it
 * anywhere, and does not keep it. It prints it once, into your terminal, and
 * exits. Copy it into Netlify and close the window.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import http from "node:http";
import { createInterface } from "node:readline/promises";
import { spawn } from "node:child_process";

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const PORT = 8976;
const REDIRECT = `http://localhost:${PORT}/callback`;

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = async (q) => (await rl.question(q)).trim();

console.log(`
Google Calendar refresh token
=============================

Before starting, in the Google Cloud console for the 513 Auto Clean project:

  1. APIs and Services, OAuth consent screen.
       User type EXTERNAL. Fill in the app name and your email.
       Add the scope ${SCOPE}
       Add yourself as a test user.

  2. PUBLISH IT. On the consent screen page, press "Publish app" so the
     status reads "In production" rather than "Testing".

     This matters more than it looks. A refresh token issued by an app in
     Testing expires after SEVEN DAYS, and bookings would silently stop
     reaching the calendar a week after you set this up. Published, it lasts
     until you revoke it. You will see an "unverified app" warning when you
     consent, which is expected and is yours to click past: you are the only
     user, and verification is only needed to remove that screen for
     strangers.

  3. Credentials, Create credentials, OAuth client ID.
       Application type: WEB APPLICATION. The refresh token is kept and
       used by a server (Netlify), which can keep the secret, so this is
       a confidential "web server" client in Google's terms.
       Authorized redirect URIs: http://localhost:${PORT}/callback
       (exactly; localhost is allowed over plain http).
       Copy the client ID and client secret.
`);

/*
 * EASIEST: pass the JSON file Google lets you download when the client is
 * created, and nothing has to be pasted:
 *   npm run gcal:token -- ~/Downloads/client_secret_XXXX.json
 *
 * Pasting is where it broke (November 11): a pasted ID can carry spaces,
 * quotes, the secret, or a terminal's invisible paste markers, and Google
 * answers that with a bare "400. That's an error. ... malformed". So both
 * values are cleaned, and the ID is checked for its shape before any link
 * is opened.
 */
const clean = (v) => String(v ?? "")
  .replace(/\x1b\[20[01]~/g, "")        // bracketed-paste markers
  .replace(/[\x00-\x1f\x7f]/g, "")       // any other control character
  .trim()
  .replace(/^["'](.*)["']$/, "$1")
  .trim();
const ID_SHAPE = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

let clientId = "", clientSecret = "";
const file = process.argv[2];
if (file) {
  try {
    const j = JSON.parse(fs.readFileSync(file.replace(/^~(?=\/)/, os.homedir()), "utf8"));
    const c = j.web || j.installed || j;
    clientId = clean(c.client_id);
    clientSecret = clean(c.client_secret);
    if (j.web && !(c.redirect_uris || []).includes(REDIRECT)) {
      console.error(`\nThis Web client does not list ${REDIRECT} under Authorized redirect URIs.\n` +
        "Add it exactly in Google Cloud (Clients, this client), save, wait a few minutes, and run this again.");
      process.exit(1);
    }
  } catch (e) {
    console.error(`\nCould not read ${file}: ${e.message}`);
    process.exit(1);
  }
} else {
  clientId = clean(await ask("Client ID:     "));
  clientSecret = clean(await ask("Client secret: "));
}
if (!clientId || !clientSecret) {
  console.error("\nBoth are needed. Nothing was sent anywhere.");
  process.exit(1);
}
if (!ID_SHAPE.test(clientId)) {
  console.error("\nThat Client ID does not look right. It should look like\n" +
    "  123456789012-abc123def456.apps.googleusercontent.com\n" +
    "with nothing before or after it. Nothing was sent anywhere. Easiest: pass the downloaded JSON file instead.");
  process.exit(1);
}

// PKCE, because a "desktop app" client secret is not really a secret and
// Google recommends the challenge for these clients.
const verifier = crypto.randomBytes(32).toString("base64url");
const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
const state = crypto.randomBytes(16).toString("base64url");

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: SCOPE,
    // Both are required to get a refresh token at all. Without `consent`
    // Google returns only an access token on the second and later runs,
    // which looks like the script quietly failing.
    access_type: "offline",
    prompt: "consent select_account",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

// Never opened automatically: the default browser is often signed in as the
// wrong Google account (November 11: it opened in another person's profile).
// The link goes on the clipboard, to paste into the Chrome profile signed in
// as the calendars' owner, and Google is asked to show the account picker.
let copied = false;
if (process.platform === "darwin") {
  try {
    const pb = spawn("pbcopy", [], { stdio: ["pipe", "ignore", "ignore"] });
    pb.on("error", () => {});
    pb.stdin.end(authUrl);
    copied = true;
  } catch { copied = false; }
}
console.log(
  "\nOpen this link in the Chrome profile signed in as the account that owns the calendars" +
  (copied ? " (it is already on your clipboard: paste it into that profile's address bar):" : ":") +
  `\n\n${authUrl}\n\nOn Google's page, choose that account, then Allow.\n`,
);

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }

    const err = url.searchParams.get("error");
    const got = url.searchParams.get("code");
    const back = url.searchParams.get("state");

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      `<!doctype html><meta charset="utf-8"><title>513 Auto Clean</title>` +
      `<body style="font:16px/1.6 system-ui;padding:3rem;max-width:34rem;margin:0 auto">` +
      (err || !got || back !== state
        ? `<h1 style="color:#c41414">Not this time</h1><p>${err ? String(err) : "The response did not match the request."} Nothing was saved. Run the command again.</p>`
        : `<h1>Done</h1><p>Close this tab. The refresh token is in your terminal.</p>`) +
      `</body>`,
    );

    server.close();
    if (err) reject(new Error(String(err)));
    else if (back !== state) reject(new Error("state mismatch, the response did not match the request"));
    else if (!got) reject(new Error("no code returned"));
    else resolve(got);
  });
  server.listen(PORT, () => console.log(`Waiting for Google on ${REDIRECT} ...`));
  setTimeout(() => { server.close(); reject(new Error("timed out after five minutes")); }, 300_000);
});

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
    code_verifier: verifier,
  }),
});

const token = await res.json();
if (!res.ok || !token.refresh_token) {
  console.error(`\nGoogle refused the exchange: ${JSON.stringify(token).slice(0, 400)}`);
  if (!token.refresh_token && res.ok) {
    console.error(
      "\nAn access token came back but no refresh token. That happens when this " +
      "app was already authorised once. Revoke it at " +
      "https://myaccount.google.com/permissions and run this again.",
    );
  }
  rl.close();
  process.exit(1);
}

console.log(`
Done. Put these three into Netlify, Site configuration, Environment variables,
then REDEPLOY. Netlify only injects variables into functions at deploy time.

  GOOGLE_OAUTH_CLIENT_ID       ${clientId}
  GOOGLE_OAUTH_CLIENT_SECRET   ${clientSecret}     (mark secret)
  GOOGLE_OAUTH_REFRESH_TOKEN   ${token.refresh_token}     (mark secret)

The refresh token is a password for your calendar. It is printed here and
nowhere else: not saved to disk, not sent anywhere. Copy it now, then close
this window.

One more step: the calendar itself. This token acts as YOU, so it can already
write to any calendar you own. No sharing needed.

Check it worked by making a test booking. The response carries
calendar: { ok: true } when the event was written.
`);
rl.close();
