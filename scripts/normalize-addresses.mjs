/**
 * Normalize property addresses and unit numbers in account_mappings and utility_bills.
 * Run once with: node scripts/normalize-addresses.mjs
 *
 * What it does:
 *   Step 1 — Normalize units: "Apt 3", "APT 3", "#3" → "3"
 *   Step 2 — Extract apt from address: "607 2nd Ave Apt 2, NY" + no unit → address cleaned, unit = "2"
 *   Step 3 — Standardize partial addresses: "620 Santa Monica Blvd" → "620 Santa Monica Blvd, Santa Monica, CA 90401"
 *   Step 4 — Re-apply mappings to utility_bills
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();

  try {
    console.log('Starting address/unit normalization...\n');

    // ─── Step 1: Normalize unit field ────────────────────────────────────────
    console.log('Step 1: Normalizing unit field (stripping "Apt ", "#", etc.)...');

    const r1a = await client.query(`
      UPDATE account_mappings
      SET unit = TRIM(REGEXP_REPLACE(TRIM(unit), '^(apt\\.?\\s*|#\\s*)', '', 'ig'))
      WHERE unit ~* '^(apt|#)'
    `);
    console.log(`  account_mappings: ${r1a.rowCount} rows updated`);

    const r1b = await client.query(`
      UPDATE utility_bills
      SET unit = TRIM(REGEXP_REPLACE(TRIM(unit), '^(apt\\.?\\s*|#\\s*)', '', 'ig'))
      WHERE unit ~* '^(apt|#)'
    `);
    console.log(`  utility_bills:    ${r1b.rowCount} rows updated`);

    // ─── Step 2: Extract apt number embedded in property_address ─────────────
    // e.g. "607 2nd Ave Apt 2, New York, NY 10016" → address="607 2nd Ave, New York, NY 10016", unit="2"
    console.log('\nStep 2: Extracting apartment numbers embedded in address...');

    // First preview what will change
    const preview2 = await client.query(`
      SELECT id, property_address, unit
      FROM account_mappings
      WHERE property_address ~* '\\s+apt\\.?\\s+\\w+'
        AND (unit IS NULL OR TRIM(unit) = '')
    `);
    console.log(`  Found ${preview2.rowCount} rows with apt in address and no unit`);

    if (preview2.rowCount > 0) {
      for (const row of preview2.rows) {
        const aptMatch = row.property_address.match(/\s+apt\.?\s+(\w+)/i);
        if (aptMatch) {
          const extractedUnit = aptMatch[1];
          const cleanedAddress = row.property_address.replace(/,?\s+apt\.?\s+\w+/i, '').trim();
          await client.query(
            `UPDATE account_mappings SET property_address = $1, unit = $2 WHERE id = $3`,
            [cleanedAddress, extractedUnit, row.id]
          );
          console.log(`    "${row.property_address}" → address="${cleanedAddress}", unit="${extractedUnit}"`);
        }
      }

      // Same for utility_bills
      const preview2b = await client.query(`
        SELECT id, property_address, unit
        FROM utility_bills
        WHERE property_address ~* '\\s+apt\\.?\\s+\\w+'
          AND (unit IS NULL OR TRIM(unit) = '')
      `);
      for (const row of preview2b.rows) {
        const aptMatch = row.property_address.match(/\s+apt\.?\s+(\w+)/i);
        if (aptMatch) {
          const extractedUnit = aptMatch[1];
          const cleanedAddress = row.property_address.replace(/,?\s+apt\.?\s+\w+/i, '').trim();
          await client.query(
            `UPDATE utility_bills SET property_address = $1, unit = $2 WHERE id = $3`,
            [cleanedAddress, extractedUnit, row.id]
          );
        }
      }
    }

    // ─── Step 3: Standardize partial addresses ───────────────────────────────
    // "620 Santa Monica Blvd" → "620 Santa Monica Blvd, Santa Monica, CA 90401"
    // Find pairs where one address is a prefix of another (A LIKE B || ',%')
    console.log('\nStep 3: Standardizing partial addresses (prefix matching)...');

    const pairs = await client.query(`
      SELECT DISTINCT a.property_address AS short_addr, b.property_address AS long_addr
      FROM account_mappings a
      JOIN account_mappings b
        ON b.property_address LIKE a.property_address || ',%'
       AND a.property_address != b.property_address
    `);
    console.log(`  Found ${pairs.rowCount} prefix pairs`);

    for (const pair of pairs.rows) {
      console.log(`    "${pair.short_addr}" → "${pair.long_addr}"`);

      // Update account_mappings
      const r3a = await client.query(
        `UPDATE account_mappings SET property_address = $1 WHERE property_address = $2`,
        [pair.long_addr, pair.short_addr]
      );
      // Update utility_bills
      const r3b = await client.query(
        `UPDATE utility_bills SET property_address = $1 WHERE property_address = $2`,
        [pair.long_addr, pair.short_addr]
      );
      console.log(`      → ${r3a.rowCount} mappings + ${r3b.rowCount} bills updated`);
    }

    // ─── Step 4: Re-apply mappings to utility_bills ──────────────────────────
    // Ensure utility_bills reflects the canonical address/unit from account_mappings
    console.log('\nStep 4: Re-applying canonical address+unit from account_mappings to utility_bills...');

    const r4 = await client.query(`
      UPDATE utility_bills ub
      SET
        property_address = am.property_address,
        unit             = am.unit
      FROM account_mappings am
      WHERE ub.account_last4 = am.account_last4
        AND ub.utility_type  = am.utility_type
        AND (
          ub.property_address IS DISTINCT FROM am.property_address
          OR ub.unit IS DISTINCT FROM am.unit
        )
    `);
    console.log(`  ${r4.rowCount} bills updated`);

    // ─── Summary ─────────────────────────────────────────────────────────────
    console.log('\n✓ Normalization complete.');

    // Quick stats
    const stats = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE property_address IS NULL)   AS null_address,
        COUNT(*) FILTER (WHERE property_address IS NOT NULL) AS mapped,
        COUNT(DISTINCT property_address)                   AS distinct_addresses
      FROM utility_bills
    `);
    const s = stats.rows[0];
    console.log(`\nDatabase state:`);
    console.log(`  Mapped bills:       ${s.mapped}`);
    console.log(`  Unmapped bills:     ${s.null_address}`);
    console.log(`  Distinct addresses: ${s.distinct_addresses}`);

  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
