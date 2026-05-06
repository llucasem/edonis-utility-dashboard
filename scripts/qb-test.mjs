/**
 * Quick smoke-test: read tokens from Neon and fetch QuickBooks CompanyInfo.
 * Run with: node scripts/qb-test.mjs
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

const QB_ENV   = (env['QB_ENV'] || 'production').toLowerCase();
const API_BASE = QB_ENV === 'sandbox'
  ? 'https://sandbox-quickbooks.api.intuit.com'
  : 'https://quickbooks.api.intuit.com';

const { Pool } = pg;
const pool = new Pool({ connectionString: env['DATABASE_URL'], ssl: { rejectUnauthorized: false } });

const r = await pool.query(`SELECT realm_id, access_token, expires_at FROM quickbooks_tokens ORDER BY updated_at DESC LIMIT 1`);
if (r.rows.length === 0) {
  console.error('No tokens found in quickbooks_tokens');
  process.exit(1);
}
const { realm_id, access_token, expires_at } = r.rows[0];
console.log(`Realm ID:       ${realm_id}`);
console.log(`Token expires:  ${new Date(expires_at).toISOString()}`);
console.log(`API base:       ${API_BASE}`);
console.log('');

const url = `${API_BASE}/v3/company/${realm_id}/companyinfo/${realm_id}?minorversion=70`;
const res = await fetch(url, {
  headers: { 'Authorization': `Bearer ${access_token}`, 'Accept': 'application/json' },
});

if (!res.ok) {
  console.error(`❌ QuickBooks API error (${res.status}):`);
  console.error(await res.text());
  await pool.end();
  process.exit(1);
}

const data = await res.json();
const ci   = data?.CompanyInfo || {};
console.log('✅ Connected to QuickBooks!');
console.log(`   Company:    ${ci.CompanyName}`);
console.log(`   Legal name: ${ci.LegalName || '—'}`);
console.log(`   Country:    ${ci.Country || '—'}`);
console.log(`   Email:      ${ci.Email?.Address || '—'}`);
console.log(`   Currency:   ${ci.SupportedLanguages || '—'}`);

await pool.end();
