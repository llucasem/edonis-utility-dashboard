/**
 * Gmail OAuth 2.0 authorization — one-time setup script
 *
 * How it works:
 *   1. This script generates an authorization URL
 *   2. Send that URL to the account owner
 *   3. They log in with their Google account
 *   4. Their browser will show a connection error (expected) but the URL contains a code
 *   5. They send back the full redirect URL
 *   6. Paste it here in the terminal and the script exchanges it for a refresh token
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');
const readline = require('readline');

// ── Load credentials ───────────────────────────────────────────────────────────
const credsPath = path.join(process.cwd(), 'Secret Key.com.json');

if (!fs.existsSync(credsPath)) {
  console.error('\n❌  Credentials file not found.\n');
  process.exit(1);
}

const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
const { client_id, client_secret } = creds.installed || creds.web;

// ── Configuration ─────────────────────────────────────────────────────────────
const REDIRECT_URI = 'http://localhost';
const SCOPE        = 'https://www.googleapis.com/auth/gmail.readonly';

const authUrl =
  `https://accounts.google.com/o/oauth2/v2/auth` +
  `?client_id=${encodeURIComponent(client_id)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&access_type=offline` +
  `&prompt=consent`;

// ── Print authorization URL ────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  STEP 1 — Send this URL to the account owner:');
console.log('══════════════════════════════════════════════════════════════\n');
console.log(authUrl);
console.log('\n══════════════════════════════════════════════════════════════');
console.log('  STEP 2 — After they log in, their browser will show a');
console.log('  connection error. That is EXPECTED.');
console.log('  Ask them to copy the full URL from the browser address bar');
console.log('  and send it back. It starts with: http://localhost/?code=...');
console.log('══════════════════════════════════════════════════════════════\n');

// ── Esperar que el usuario pegue la URL de respuesta ──────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('  STEP 3 — Paste the redirect URL here and press Enter:\n\n  > ', (input) => {
  rl.close();

  let code;
  try {
    const url = new URL(input.trim());
    code = url.searchParams.get('code');
  } catch {
    // Quizás pegaron solo el código directamente
    code = input.trim();
  }

  if (!code) {
    console.error('\n❌  No code found in the URL. Please try again.\n');
    process.exit(1);
  }

  console.log('\n⏳  Exchanging code for token...\n');

  // ── Exchange code for tokens ───────────────────────────────────────────────
  const postData = new URLSearchParams({
    code,
    client_id,
    client_secret,
    redirect_uri: REDIRECT_URI,
    grant_type:   'authorization_code',
  }).toString();

  const options = {
    hostname: 'oauth2.googleapis.com',
    path:     '/token',
    method:   'POST',
    headers:  {
      'Content-Type':   'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  const tokenReq = https.request(options, (tokenRes) => {
    let data = '';
    tokenRes.on('data', chunk => { data += chunk; });
    tokenRes.on('end', () => {
      const tokens = JSON.parse(data);

      if (tokens.error) {
        console.error(`\n❌  Error: ${tokens.error_description}\n`);
        if (tokens.error === 'invalid_grant') {
          console.error('    The code has already been used or expired (codes last 10 minutes).');
          console.error('    Re-run this script and repeat the process.\n');
        }
        return;
      }

      if (!tokens.refresh_token) {
        console.error('\n❌  No refresh_token received.');
        console.error('    The account owner has already authorized this app before.');
        console.error('    Fix: ask them to visit https://myaccount.google.com/permissions');
        console.error('    and revoke access to this app, then repeat the process.\n');
        return;
      }

      console.log('\n✅  Authorization complete! Add this to .env.local:\n');
      console.log('══════════════════════════════════════════════════════════════');
      console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
      console.log(`GMAIL_USER=email-de-edonis@sudominio.com`);
      console.log('══════════════════════════════════════════════════════════════');
      console.log('\n⚠️   Cambia "email-de-edonis@sudominio.com" por su email real.\n');
    });
  });

  tokenReq.on('error', (e) => console.error('Network error:', e.message));
  tokenReq.write(postData);
  tokenReq.end();
});
