/**
 * Manual address normalization — fixes all known address variants in utility_bills.
 * Run once with: node scripts/fix-addresses-manual.mjs
 *
 * For each property group we pick one canonical form (full address, no apt embedded)
 * and update all variants to match it. Embedded apt numbers are extracted to the unit field.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}
const pool   = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

// ─── Helpers ────────────────────────────────────────────────────────────────

async function updateAddress(variants, canonical) {
  if (!variants.length) return 0;
  const res = await client.query(
    `UPDATE utility_bills SET property_address = $1 WHERE property_address = ANY($2::text[])`,
    [canonical, variants]
  );
  return res.rowCount;
}

// For embedded-apt addresses: set canonical address + extract unit (only if unit is empty)
async function extractAptAndNormalize(embeddedAptAddresses, canonical) {
  let total = 0;
  for (const addr of embeddedAptAddresses) {
    const aptMatch = addr.match(/\s+apt\.?\s+([^\s,]+)/i);
    const unit = aptMatch ? aptMatch[1] : null;
    if (unit) {
      // Update address + set unit where currently empty
      const r1 = await client.query(
        `UPDATE utility_bills SET property_address = $1, unit = $2
         WHERE property_address = $3 AND (unit IS NULL OR TRIM(unit) = '')`,
        [canonical, unit, addr]
      );
      // Update address only where unit is already set
      const r2 = await client.query(
        `UPDATE utility_bills SET property_address = $1
         WHERE property_address = $2 AND unit IS NOT NULL AND TRIM(unit) != ''`,
        [canonical, addr]
      );
      total += r1.rowCount + r2.rowCount;
    } else {
      const r = await client.query(
        `UPDATE utility_bills SET property_address = $1 WHERE property_address = $2`,
        [canonical, addr]
      );
      total += r.rowCount;
    }
  }
  return total;
}

// ─── Address groups ──────────────────────────────────────────────────────────

let grandTotal = 0;

async function fix(label, canonical, plain_variants, apt_variants = []) {
  const n1 = await updateAddress(plain_variants, canonical);
  const n2 = await extractAptAndNormalize(apt_variants, canonical);
  const total = n1 + n2;
  grandTotal += total;
  if (total > 0) console.log(`  [${total}] ${label}`);
}

console.log('Fixing address variants in utility_bills...\n');

// ── 13273 Fiji Way ──────────────────────────────────────────────────────────
await fix(
  '13273 Fiji Way',
  '13273 Fiji Way, Marina Del Rey, CA 90292',
  ['13273 Fiji Way'],
  ['13273 Fiji Way Apt 403 Marina Del Rey, CA 90292']
);

// ── 13488 Maxella Ave ────────────────────────────────────────────────────────
await fix(
  '13488 Maxella Ave',
  '13488 Maxella Ave, Marina Del Rey, CA 90292',
  ['13488 Maxella Ave'],
  ['13488 Maxella Ave Apt 469 Marina Del Rey, CA 90292']
);

// ── 1418 7th St ──────────────────────────────────────────────────────────────
await fix(
  '1418 7th St',
  '1418 7th St, Santa Monica, CA 90401',
  ['1418 7th St', '1418 7th St, Santa Monica CA 90401'],
  ['1418 7th St Apt 307 Santa Monica, CA 90401']
);

// ── 1420 5th St ──────────────────────────────────────────────────────────────
await fix(
  '1420 5th St',
  '1420 5th St, Santa Monica, CA 90401',
  ['1420 5th St', '1420 5TH ST, 501 SANTA MONICA, CA 90401'],
  ['1420 5th St Apt 501 Santa Monica, CA 90401']
);

// ── 1450 5th St ──────────────────────────────────────────────────────────────
await fix(
  '1450 5th St',
  '1450 5th St, Santa Monica, CA 90401',
  ['1450 5th St'],
  ['1450 5th St Apt 410 Santa Monica, CA 90401']
);

// ── 1528 6th St ──────────────────────────────────────────────────────────────
await fix(
  '1528 6th St',
  '1528 6th St, Santa Monica, CA 90401',
  ['1528 6th St', '1528 6th St, Santa Monica CA 90401'],
  ['1528 6th St Apt 209 Santa Monica, CA 90401']
);

// ── 1548 6th St ──────────────────────────────────────────────────────────────
await fix(
  '1548 6th St',
  '1548 6th St, Santa Monica, CA 90401',
  ['1548 6th St'],
  ['1548 6th St Apt 306 Santa Monica, CA 90401']
);

// ── 175 W 107th St ───────────────────────────────────────────────────────────
await fix(
  '175 W 107th St',
  '175 W 107th St, New York, NY 10025',
  ['175 W 107th, New York, NY 10025'],
  [
    '175 W 107th St Apt 1 New York, NY 10025',
    '175 W 107th St Apt 1, New York, NY 10025',
  ]
);

// ── 1880 3rd Ave ─────────────────────────────────────────────────────────────
await fix(
  '1880 3rd Ave',
  '1880 3rd Ave, New York, NY 10029',
  ['1880 3rd Ave', '1880 3rd Avenue, New York, NY 10029'],
  [
    '1880 3rd Ave Apt 2b New York, NEW YORK 10029',
    '1880 3rd Ave Apt 2b New York, NY 10029',
    '1880 3rd Ave Apt 2f New York, NY 10029',
    '1880 3rd Ave Apt 2f Sb New York, NEW YORK 10029',
    '1880 3rd Ave Apt 2f, New York, NY 10029',
  ]
);

// ── 2200 Colorado Ave ────────────────────────────────────────────────────────
await fix(
  '2200 Colorado Ave',
  '2200 Colorado Ave, Santa Monica, CA 90404',
  ['2200 Colorado Ave'],
  [
    '2200 Colorado Ave Apt 337 Santa Monica, CA 90404',
    '2200 Colorado Ave Apt 540 Santa Monica, CA 90404',
    '2200 Colorado Ave Apt 627 Santa Monica, CA 90404',
    '2200 Colorado Ave Apt 630 Santa Monica, CA 90404',
    '2200 Colorado Ave Apt 630, Santa Monica, CA 90404',
  ]
);

// ── 226 S Gale Dr ────────────────────────────────────────────────────────────
await fix(
  '226 S Gale Dr',
  '226 S Gale Dr, Beverly Hills, CA 90211',
  [
    '226 S Gale Dr',
    '226 S Gale Dr Beverly Hills, CA 90211',
    '226 S Gale Dr Apt C Beverly Hills, CA 90211-3485',
  ],
  ['226 S Gale Dr Apt C Beverly Hills, CA 90211']
);

// ── 3221 Carter Ave ──────────────────────────────────────────────────────────
await fix(
  '3221 Carter Ave',
  '3221 Carter Ave, Marina Del Rey, CA 90292',
  [
    '3221 Carter Ave',
    '3221 Carter Ave Marina Del Rey, CA 90292',
    '3221 Carter Avenue, Marina Del Rey, CA 90292',
  ],
  ['3221 Carter Ave Unit 447 Marina Del Rey, CA 90292']
);

// ── 360 W Pico Rd ────────────────────────────────────────────────────────────
await fix(
  '360 W Pico Rd',
  '360 W Pico Rd, Palm Springs, CA 92262',
  ['360 W Pico Rd Palm Springs, CA 92262']
);

// ── 4 Irving Place ───────────────────────────────────────────────────────────
await fix(
  '4 Irving Place',
  '4 Irving Place, New York, NY 10003',
  [
    '4 Irving Place, New York, New York 10003',
    '4 Irving place, New York, NY 10003',
  ]
);

// ── 4241 Redwood Ave ─────────────────────────────────────────────────────────
await fix(
  '4241 Redwood Ave',
  '4241 Redwood Ave, Los Angeles, CA 90066',
  ['4241 Redwood Avenue Los Angeles CA, 90066']
);

// ── 4250 Glencoe Ave ─────────────────────────────────────────────────────────
await fix(
  '4250 Glencoe Ave',
  '4250 Glencoe Ave, Marina Del Rey, CA 90292',
  ['4250 Glencoe Ave Marina del Rey CA 90292']
);

// ── 439 W 51st St ────────────────────────────────────────────────────────────
await fix(
  '439 W 51st St',
  '439 W 51st St, New York, NY 10019',
  ['439 W 51st St', '439 West 51st Street, New York, NY 10019'],
  ['439 W 51st St Apt 2w New York, NY 10019']
);

// ── 4572 Via Marina ──────────────────────────────────────────────────────────
await fix(
  '4572 Via Marina',
  '4572 Via Marina, Marina Del Rey, CA 90292',
  [],
  ['4572 Via Marina Apt 102 Marina Del Rey, CA 90292']
);

// ── 472 9th Ave ──────────────────────────────────────────────────────────────
await fix(
  '472 9th Ave',
  '472 9th Ave, New York, NY 10018',
  ['472 9th Ave', '472 9th Ave New York, NY 10018'],
  [
    '472 9th Ave Apt 2 New York, NY 10018',
    '472 9th Ave Apt 3 New York, NY 10018',
  ]
);

// ── 474 9th Ave ──────────────────────────────────────────────────────────────
await fix(
  '474 9th Ave',
  '474 9th Ave, New York, NY 10018',
  ['474 9th Ave', '474 9th Ave New York, NY 10018'],
  [
    '474 9th Ave Apt 3d New York, NY 10018',
    '474 9th Ave Apt 4d New York, NY 10018',
    '474 9th Ave, Apt 3d, New York, NY 10018',
  ]
);

// ── 4750 Lincoln Blvd ────────────────────────────────────────────────────────
await fix(
  '4750 Lincoln Blvd',
  '4750 Lincoln Blvd, Marina Del Rey, CA 90292',
  ['4750 Lincoln Blvd'],
  [
    '4750 Lincoln Blvd Apt 183 Marina Del Rey, CA 90292',
    '4750 Lincoln Blvd Apt 382 Marina Del Rey, CA 90292',
    '4750 Lincoln Blvd Apt 461 Marina Del Rey, CA 90292',
  ]
);

// ── 478 9th Ave ──────────────────────────────────────────────────────────────
await fix(
  '478 9th Ave',
  '478 9th Ave, New York, NY 10018',
  ['478 9th Ave', '478 9th Ave New York, NY 10018'],
  ['478 9th Ave Apt 2 New York, NY 10018']
);

// ── 501 E 116th St ───────────────────────────────────────────────────────────
await fix(
  '501 E 116th St',
  '501 E 116th St, New York, NY 10029',
  ['501 E 116th St'],
  [
    '501 E 116th St Apt 4 New York, NY 10029',
    '501 E 116th St Apt 4, New York, NY 10029',
  ]
);

// ── 507 Wilshire Blvd ────────────────────────────────────────────────────────
await fix(
  '507 Wilshire Blvd',
  '507 Wilshire Blvd, Santa Monica, CA 90401',
  ['507 Wilshire Blvd'],
  [
    '507 Wilshire Blvd Apt 313 Santa Monica, CA 90401',
    '507 Wilshire Blvd Apt 313, Santa Monica, CA 90401',
  ]
);

// ── 607 2nd Ave ──────────────────────────────────────────────────────────────
await fix(
  '607 2nd Ave',
  '607 2nd Ave, New York, NY 10016',
  ['607 2nd Ave', '607 2nd AveNew York, NY 10016'],
  [
    '607 2nd Ave Apt 2 New York, NY 10016',
    '607 2nd Ave Apt 2, New York, NY 10016',
  ]
);

// ── 620 Santa Monica Blvd ────────────────────────────────────────────────────
await fix(
  '620 Santa Monica Blvd',
  '620 Santa Monica Blvd, Santa Monica, CA 90401',
  ['620 Santa Monica Blvd'],
  [
    '620 Santa Monica Blvd Apt 510 Santa Monica, CA 90401',
    '620 Santa Monica Blvd Apt 510, Santa Monica, CA 90401',
  ]
);

// ── 6677 Santa Monica Blvd ───────────────────────────────────────────────────
await fix(
  '6677 Santa Monica Blvd',
  '6677 Santa Monica Blvd, Los Angeles, CA 90038',
  [
    '6677 Santa Monica Blvd',
    '6677 Santa Monica Blvd, Los Angeles CA 90038',
  ],
  [
    '6677 Santa Monica Blvd Apt 4522 Los Angeles CA, 90038',
    '6677 Santa Monica Blvd Apt 4522 Los Angeles, CA 90038',
  ]
);

// ── 7141 Santa Monica Blvd ───────────────────────────────────────────────────
await fix(
  '7141 Santa Monica Blvd',
  '7141 Santa Monica Blvd, West Hollywood, CA 90046',
  ['7141 Santa Monica Blvd W Hollywood CA 90046']
);

// ── 939 S Broadway ───────────────────────────────────────────────────────────
await fix(
  '939 S Broadway',
  '939 S Broadway, Los Angeles, CA 90015',
  ['939 S Broadway', '939 S Broadway, Los Angeles CA 90015'],
  [
    '939 S Broadway Apt 202 Los Angeles, CA 90015',
    '939 S Broadway Apt 408 Los Angeles, CA 90015',
    '939 S Broadway Apt 508 Los Angeles, CA 90015',
    '939 S Broadway Apt 607 Los Angeles, CA 90015',
    '939 S Broadway Apt 806 Los Angeles, CA 90015',
    '939 S Broadway Apt M3 Los Angeles, CA 90015',
  ]
);

// ── 243 E 60th St ────────────────────────────────────────────────────────────
await fix(
  '243 E 60th St',
  '243 E 60th St, New York, NY 10022',
  [],
  ['243 E 60th St Apt 3b, New York, NY, 10022-1450']
);

// ─── Final stats ─────────────────────────────────────────────────────────────
console.log(`\nTotal bills updated: ${grandTotal}`);

const stats = await client.query(`
  SELECT COUNT(DISTINCT property_address) AS distinct_addresses
  FROM utility_bills WHERE property_address IS NOT NULL
`);
console.log(`Distinct addresses now: ${stats.rows[0].distinct_addresses}`);

client.release();
await pool.end();
