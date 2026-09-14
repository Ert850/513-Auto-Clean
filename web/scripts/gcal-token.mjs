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
       Application type: DESKTOP APP.
       Copy the client ID and client secret.
`);

const clientId = await ask("Client ID:     ");
const clientSecret = await ask("Client secret: ");
if (!clientId || !clientSecret) {
  console.error("\nBoth are needed. Nothing was sent anywhere.");
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
    prompt: "consent",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });

console.log(`\nOpening your browser. If it does not open, paste this in:\n\n${authUrl}\n`);
spawn(process.platform === "win32" ? "cmd" : "open", process.platform === "win32" ? ["/c", "start", "", authUrl] : [authUrl], {
  stdio: "ignore",
  detached: true,
  shell: process.platform === "linux",
}).unref();

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
