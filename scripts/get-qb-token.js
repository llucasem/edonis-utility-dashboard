/**
 * QuickBooks Online OAuth 2.0 — one-time setup script (PRODUCTION READY)
 *
 * How it works:
 *   1. This script generates an authorization URL
 *   2. Open that URL in a browser (Edonis, or whoever has admin access to the QB company)
 *   3. Log in to QuickBooks and click "Connect"
 *   4. The browser redirects to the Intuit OAuth Playground showing code + realmId
 *   5. Copy the FULL redirect URL from the address bar
 *   6. Paste it here — the script exchanges it for tokens AND saves them to Neon
 *
 * Required in .env.local:
 *   QB_CLIENT_ID, QB_CLIENT_SECRET   (from developer.intuit.com → Production)
 *   DATABASE_URL                      (Neon connection string)
 *
 * Optional override:
 *   QB_REDIRECT_URI  (default: Intuit OAuth Playground)
 *   QB_ENV           (default: production — values: production | sandbox)
 */

const https    = require('https');
const path     = require('path');
const fs       = require('fs');
const readline = require('readline');
const { Pool } = require('pg');

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
const DATABASE_URL  = env['DATABASE_URL'];
const REDIRECT_URI  = env['QB_REDIRECT_URI'] || 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl';
const QB_ENV        = (env['QB_ENV'] || 'production').toLowerCase();

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('\n❌  QB_CLIENT_ID or QB_CLIENT_SECRET missing in .env.local\n');
  process.exit(1);
}
if (!DATABASE_URL) {
  console.error('\n❌  DATABASE_URL missing in .env.local\n');
  process.exit(1);
}

// ── Configuration ─────────────────────────────────────────────────────────────
const SCOPE = 'com.intuit.quickbooks.accounting';
const STATE = Math.random().toString(36).substring(2);

const authUrl =
  'https://appcenter.intuit.com/connect/oauth2' +
  `?client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&response_type=code` +
  `&state=${STATE}`;

// ── Print instructions ────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════');
console.log(`  QuickBooks Online — OAuth 2.0 Setup  (${QB_ENV.toUpperCase()})`);
console.log('══════════════════════════════════════════════════════════════\n');
console.log('  STEP 1 — Open this URL in the browser of the QB account owner:');
console.log('\n  ' + authUrl + '\n');
console.log('══════════════════════════════════════════════════════════════');
console.log('  STEP 2 — Log in to QuickBooks and click "Connect".');
console.log('  The browser will land on the Intuit OAuth Playground page,');
console.log('  which will show "code", "state" and "realmId" in the URL.');
console.log('  Copy the FULL URL from the browser address bar.');
console.log('══════════════════════════════════════════════════════════════\n');

// ── Wait for redirect URL ─────────────────────────────────────────────────────
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('  STEP 3 — Paste the full redirect URL here and press Enter:\n\n  > ', async (input) => {
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
    console.error('    Make sure the user authorized from inside a QuickBooks company.\n');
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

  const tokens = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth.platform.intuit.com',
      path:     '/oauth2/v1/tokens/bearer',
      method:   'POST',
      headers: {
        'Accept':         'application/json',
        'Content-Type':   'application/x-www-form-urlencoded',
        'Authorization':  `Basic ${basicAuth}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Unexpected response: ' + data)); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  }).catch(err => {
    console.error('\n❌  Network error:', err.message, '\n');
    process.exit(1);
  });

  if (tokens.error) {
    console.error(`\n❌  Error: ${tokens.error}`);
    if (tokens.error_description) console.error(`    ${tokens.error_description}`);
    if (tokens.error === 'invalid_grant') {
      console.error('\n    The code has expired (codes last ~10 minutes).');
      console.error('    Re-run this script and repeat the process quickly.\n');
    }
    process.exit(1);
  }

  // ── Save tokens to Neon ───────────────────────────────────────────────────
  const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

  const expiresAt        = new Date(Date.now() + (tokens.expires_in        * 1000));
  const refreshExpiresAt = new Date(Date.now() + (tokens.x_refresh_token_expires_in * 1000));

  await pool.query(`
    INSERT INTO quickbooks_tokens (realm_id, access_token, refresh_token, expires_at, refresh_expires_at)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (realm_id) DO UPDATE SET
      access_token       = EXCLUDED.access_token,
      refresh_token      = EXCLUDED.refresh_token,
      expires_at         = EXCLUDED.expires_at,
      refresh_expires_at = EXCLUDED.refresh_expires_at,
      updated_at         = NOW()
  `, [realmId, tokens.access_token, tokens.refresh_token, expiresAt, refreshExpiresAt]);

  await pool.end();

  console.log('══════════════════════════════════════════════════════════════');
  console.log(`✅  Authorization complete and tokens saved to Neon.`);
  console.log(`    Realm ID:     ${realmId}`);
  console.log(`    Access expires:  ${expiresAt.toISOString()}`);
  console.log(`    Refresh expires: ${refreshExpiresAt.toISOString()}`);
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`    The app will refresh tokens automatically going forward.\n`);
});
