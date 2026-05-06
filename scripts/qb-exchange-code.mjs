/**
 * Exchange a QuickBooks authorization code + realmId for tokens, save to Neon.
 *
 * Usage:
 *   node scripts/qb-exchange-code.mjs <code> <realmId>
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, '..', '.env.local');
const env = {};
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const CLIENT_ID     = env['QB_CLIENT_ID'];
const CLIENT_SECRET = env['QB_CLIENT_SECRET'];
const REDIRECT_URI  = env['QB_REDIRECT_URI'] || 'https://developer.intuit.com/v2/OAuth2Playground/RedirectUrl';
const DATABASE_URL  = env['DATABASE_URL'];

const [, , code, realmId] = process.argv;
if (!code || !realmId) {
  console.error('Usage: node scripts/qb-exchange-code.mjs <code> <realmId>');
  process.exit(1);
}
if (!CLIENT_ID || !CLIENT_SECRET || !DATABASE_URL) {
  console.error('Missing QB_CLIENT_ID / QB_CLIENT_SECRET / DATABASE_URL in .env.local');
  process.exit(1);
}

const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
const body = new URLSearchParams({
  grant_type:   'authorization_code',
  code,
  redirect_uri: REDIRECT_URI,
});

console.log('Exchanging code for tokens...');
const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
  method: 'POST',
  headers: {
    'Accept':        'application/json',
    'Content-Type':  'application/x-www-form-urlencoded',
    'Authorization': `Basic ${basicAuth}`,
  },
  body,
});

const tokens = await res.json();
if (!res.ok || tokens.error) {
  console.error(`\nIntuit error (${res.status}):`, tokens);
  process.exit(1);
}

const expiresAt        = new Date(Date.now() + (tokens.expires_in * 1000));
const refreshExpiresAt = new Date(Date.now() + (tokens.x_refresh_token_expires_in * 1000));

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });

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

console.log('\n✅ Tokens saved to Neon.');
console.log(`   Realm ID:        ${realmId}`);
console.log(`   Access expires:  ${expiresAt.toISOString()}`);
console.log(`   Refresh expires: ${refreshExpiresAt.toISOString()}`);
