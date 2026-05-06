/**
 * Migration: create quickbooks_tokens table
 * Run with: node scripts/migrate-qb-tokens.mjs
 *
 * Idempotent — safe to run multiple times. Uses CREATE TABLE IF NOT EXISTS.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SQL = `
CREATE TABLE IF NOT EXISTS quickbooks_tokens (
  id                  SERIAL PRIMARY KEY,
  realm_id            TEXT NOT NULL UNIQUE,
  access_token        TEXT NOT NULL,
  refresh_token       TEXT NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  refresh_expires_at  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
`;

console.log('🔧 Creating table quickbooks_tokens (if not exists)...');
await pool.query(SQL);

const check = await pool.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'quickbooks_tokens'
  ORDER BY ordinal_position;
`);

console.log('\n✅ Table is ready. Schema:\n');
check.rows.forEach(r => console.log(`   - ${r.column_name.padEnd(20)} ${r.data_type}`));

await pool.end();
console.log('\n🎉 Done.');
