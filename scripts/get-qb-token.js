/**
 * QuickBooks Online OAuth 2.0 — one-time setup script
 *
 * How it works:
 *   1. This script generates an authorization URL
 *   2. Open that URL in your browser (or send it to whoever has QB access)
 *   3. Log in to QuickBooks and authorize the app
 *   4. The browser will show a connection error — that is EXPECTED
 *   5. Copy the full URL from the browser address bar and paste it here
 *   6. The script exchanges it for a refresh token + realm ID
 *
 * BEFORE RUNNING:
 *   In developer.intuit.com → your app → Development Settings → Redirect URIs
 *   Add exactly: http://localhost
 *   Then save and run this script.
 */

const https    = require('https');
const path     = require('path');
const fs       = require('fs');
const readline = require('readline');

// ── Load credentials from .env.local ─────────────────────────────────────────
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('\n❌  .env.local not found. Run from the project root.\n');
  process.exit(1);
}

const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const CLIENT_ID     = env['QB_CLIENT_ID'];
const CLIENT_SECRET = env['QB_CLIENT_SECRET'];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌  QB_CLIENT_ID or QB_CLIENT_SECRET missing in .env.local\n');
  process.exit(1);
}

// ── Configuration ─────────────────────────────────────────────────────────────
const REDIRECT_URI = 'http://localhost';
const SCOPE        = 'com.intuit.quickbooks.accounting';
const STATE        = Math.random().toString(36).substring(2);

const authUrl =
  'https://appcenter.intuit.com/connect/oauth2' +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&state=${STATE}`;

// ── Print instructions ────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  QuickBooks Online — OAuth 2.0 Setup');
console.log('══════════════════════════════════════════════════════════════\n');
console.log('  STEP 1 — Open this URL in the browser (your account or QB owner):');
console.log('\n  ' + authUrl + '\n');
console.log('══════════════════════════════════════════════════════════════');
console.log('  STEP 2 — Log in to QuickBooks and click "Connect".');
console.log('  The browser will show a connection error — that is EXPECTED.');
console.log('  Copy the full URL from the browser address bar.');
console.log('  It will start with: http://localhost/?code=...');
console.log('══════════════════════════════════════════════════════════════\n');

// ── Wait for redirect URL ─────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('  STEP 3 — Paste the full redirect URL here and press Enter:\n\n  > ', (input) => {
  rl.close();

  let code, realmId;
  try {
    const url = new URL(input.trim());
    code    = url.searchParams.get('code');
    realmId = url.searchParams.get('realmId');
  } catch {
    console.error('\n❌  Could not parse the URL. Make sure you pasted the full URL.\n');
    process.exit(1);
  }

  if (!code) {
    console.error('\n❌  No "code" found in the URL. Please try again.\n');
    process.exit(1);
  }

  if (!realmId) {
    console.error('\n❌  No "realmId" found in the URL.');
    console.error('    Make sure you authorized the app from inside a QuickBooks company.\n');
    process.exit(1);
  }

  console.log('\n⏳  Exchanging code for tokens...\n');

  // ── Exchange code for tokens ──────────────────────────────────────────────
  const postData = new URLSearchParams({
    grant_type:   'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
  }).toString();

  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const options = {
    hostname: 'oauth.platform.intuit.com',
    path:     '/oauth2/v1/tokens/bearer',
    method:   'POST',
    headers:  {
      'Accept':         'application/json',
      'Content-Type':   'application/x-www-form-urlencoded',
      'Authorization':  `Basic ${basicAuth}`,
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
      let tokens;
      try { tokens = JSON.parse(data); } catch {
        console.error('\n❌  Unexpected response from Intuit:\n', data, '\n');
        return;
      }

      if (tokens.error) {
        console.error(`\n❌  Error: ${tokens.error}`);
        if (tokens.error_description) console.error(`    ${tokens.error_description}`);
        if (tokens.error === 'invalid_grant') {
          console.error('\n    The code has expired (codes last 10 minutes).');
          console.error('    Re-run this script and repeat the process.\n');
        }
        return;
      }

      console.log('\n✅  Authorization complete! Add these to .env.local:\n');
      console.log('══════════════════════════════════════════════════════════════');
      console.log(`QB_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log(`QB_REALM_ID=${realmId}`);
      console.log('══════════════════════════════════════════════════════════════\n');
    });
  });

  req.on('error', (e) => console.error('\n❌  Network error:', e.message, '\n'));
  req.write(postData);
  req.end();
});
