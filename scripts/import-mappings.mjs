/**
 * Import account mappings from Jake's CSV into account_mappings table.
 * Run with: node scripts/import-mappings.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath }               from 'url';
import { dirname, join }               from 'path';
import pg                              from 'pg';

// Load .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Proper CSV parser (handles newlines inside quoted fields) ─────────────────
function parseCSV(content) {
  const rows    = [];
  let   row     = [];
  let   field   = '';
  let   inQuote = false;

  for (let i = 0; i < content.length; i++) {
    const c    = content[i];
    const next = content[i + 1];

    if (c === '"') {
      if (inQuote && next === '"') { field += '"'; i++; }   // escaped ""
      else                         { inQuote = !inQuote; }
    } else if (c === ',' && !inQuote) {
      row.push(field.trim());
      field = '';
    } else if ((c === '\n' || c === '\r') && !inQuote) {
      if (c === '\r' && next === '\n') i++;                 // skip \r\n
      row.push(field.trim());
      if (row.some(f => f)) rows.push(row);
      row   = [];
      field = '';
    } else {
      // Replace in-field newlines with a space
      field += (inQuote && (c === '\n' || c === '\r')) ? ' ' : c;
    }
  }
  if (field || row.length) { row.push(field.trim()); if (row.some(f => f)) rows.push(row); }
  return rows;
}

// ── Provider normalization (handles plain names and URL formats) ───────────────
function normalizeProvider(raw) {
  if (!raw || raw === '-') return null;
  const r = raw.trim();
  if (r.startsWith('http')) {
    if (r.includes('coned'))    return 'ConEd';
    if (r.includes('sce.com'))  return 'SCE';
    if (r.includes('ladwp'))    return 'Ladwp';
    if (r.includes('socalgas')) return 'SoCalGas';
    if (r.includes('spectrum')) return 'Spectrum';
    if (r.includes('att.com'))  return 'AT&T';
    return null;
  }
  return r || null;
}

// ── Clean account number (strip name prefixes, skip non-accounts) ─────────────
function cleanAccount(raw) {
  if (!raw || raw === '-') return null;
  const s = raw.replace(/^[A-Za-z]+\s*-\s*/, '').trim();   // strip "Mike - " etc.
  const SKIP = ['gigstreem', 'with rent', 'get info', 'add autopay'];
  if (SKIP.some(x => s.toLowerCase().includes(x))) return null;
  if (/\dE\+\d/i.test(s)) return null;                      // Excel scientific notation
  if (!s) return null;
  return s;
}

// Extract last 4 digits
function last4(account) {
  if (!account) return null;
  const digits = account.replace(/[^0-9]/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

// Clean property address (remove stray suffixes like "(72%)")
function cleanAddress(addr) {
  return (addr || '').replace(/\s*-\s*\(\d+%\)\s*$/, '').replace(/\s+/g, ' ').trim();
}

const isLADWP = (p) => (p || '').toLowerCase().includes('ladwp');

// ── Parse CSV ─────────────────────────────────────────────────────────────────
const csvPath = join(__dirname, '..', 'Utilities backup - Sheet1.csv');
const rows    = parseCSV(readFileSync(csvPath, 'utf-8').replace(/\r\n/g, '\n'));

// Row 0 = section headers, Row 1 = column headers, Row 2+ = data
const dataRows = rows.slice(2);

// CSV column layout:
// 0:address  1:name  2:apt
// 3:internet_provider 4:email 5:password 6:internet_account 7:internet_autopay  8:sep
// 9:elec_provider 10:email 11:password 12:elec_account 13:elec_autopay  14:sep
// 15:gas_provider 16:email 17:password 18:gas_account  19:gas_autopay

const toImport = [];
const flagged  = [];

for (const c of dataRows) {
  if (c.length < 3) continue;

  const address = cleanAddress(c[0]);
  const apt     = (c[2] || '').trim();
  if (!address || address === '-') continue;

  // ── ELECTRICITY ────────────────────────────────────────────────────────────
  const elecProvider  = normalizeProvider(c[9]);
  const elecAccountRaw = (c[12] || '').trim();

  if (elecProvider) {
    if (!elecAccountRaw || elecAccountRaw === '-' ||
        elecAccountRaw.toLowerCase().includes('get info')) {
      flagged.push({
        tag: 'missing_account', utility_type: 'electricity',
        provider: elecProvider, address, unit: apt,
        note: elecAccountRaw || 'No account number in spreadsheet',
      });
    } else if (elecAccountRaw.includes('/')) {
      // Two accounts — import last one (matches DB bills), flag for review
      const parts   = elecAccountRaw.split('/').map(s => s.trim());
      const primary = parts[parts.length - 1];
      const l4      = last4(primary);
      if (l4) {
        toImport.push({ utility_type: 'electricity', provider: elecProvider, account_last4: l4, property_address: address, unit: apt });
        if (isLADWP(elecProvider))
          toImport.push({ utility_type: 'water', provider: elecProvider, account_last4: l4, property_address: address, unit: apt });
      }
      flagged.push({
        tag: 'dual_account', utility_type: 'electricity',
        provider: elecProvider, address, unit: apt,
        note: `Two accounts: ${parts[0]} and ${parts[1]}. Imported second (···${l4 || '?'}). Verify which is active.`,
      });
    } else {
      const clean = cleanAccount(elecAccountRaw);
      const l4    = last4(clean);
      if (l4) {
        toImport.push({ utility_type: 'electricity', provider: elecProvider, account_last4: l4, property_address: address, unit: apt });
        if (isLADWP(elecProvider))
          toImport.push({ utility_type: 'water', provider: elecProvider, account_last4: l4, property_address: address, unit: apt });
      }
    }
  }

  // ── GAS ────────────────────────────────────────────────────────────────────
  const gasProvider   = normalizeProvider(c[15]);
  const gasAccountRaw = (c[18] || '').trim();

  if (gasProvider && gasProvider !== '-') {
    const clean = cleanAccount(gasAccountRaw);
    const l4    = last4(clean);
    if (l4) {
      toImport.push({ utility_type: 'gas', provider: gasProvider, account_last4: l4, property_address: address, unit: apt });
    } else if (gasAccountRaw && gasAccountRaw !== '-') {
      flagged.push({
        tag: 'missing_account', utility_type: 'gas',
        provider: gasProvider, address, unit: apt,
        note: gasAccountRaw || 'No account number in spreadsheet',
      });
    }
  }
}

// ── Detect collisions (same utility_type + last4, different addresses) ─────────
const seen        = new Map();
const collisions  = new Map();
const finalImport = [];

for (const m of toImport) {
  const k = `${m.utility_type}__${m.account_last4}`;
  if (seen.has(k)) {
    const prev = seen.get(k);
    if (prev.property_address !== m.property_address) {
      if (!collisions.has(k)) collisions.set(k, [prev]);
      collisions.get(k).push(m);
    }
  } else {
    seen.set(k, m);
    finalImport.push(m);
  }
}

// Remove collided entries and build flags
for (const [k, entries] of collisions) {
  const [type] = k.split('__');
  const l4     = k.split('__')[1];
  const idx    = finalImport.findIndex(m => m.utility_type === type && m.account_last4 === l4);
  if (idx !== -1) finalImport.splice(idx, 1);
  flagged.push({
    tag:           'collision',
    utility_type:  entries[0].utility_type,
    provider:      entries[0].provider,
    account_last4: l4,
    note:          `Two properties share ···${l4}: "${entries[0].property_address} Apt ${entries[0].unit}" AND "${entries[entries.length - 1].property_address} Apt ${entries[entries.length - 1].unit}". Cannot auto-assign. Jake must verify in ${entries[0].provider} portal.`,
    addresses:     entries.map(e => ({ address: e.property_address, unit: e.unit })),
  });
}

console.log(`\nReady to import: ${finalImport.length} mappings`);
console.log(`Flagged for review: ${flagged.length} items\n`);
console.log('Flags:', flagged.map(f => `[${f.tag}] ${f.utility_type} ${f.address} Apt ${f.unit}`).join('\n       '));
console.log();

// ── Import ────────────────────────────────────────────────────────────────────
let totalMappings = 0;
let totalBills    = 0;

for (const m of finalImport) {
  try {
    await pool.query(
      `INSERT INTO account_mappings (utility_type, provider, account_last4, property_address, unit)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (utility_type, account_last4) DO UPDATE
         SET provider = EXCLUDED.provider, property_address = EXCLUDED.property_address, unit = EXCLUDED.unit`,
      [m.utility_type, m.provider, m.account_last4, m.property_address, m.unit || null]
    );
    totalMappings++;

    const upd = await pool.query(
      `UPDATE utility_bills
       SET property_address = $1, unit = COALESCE(unit, $2)
       WHERE utility_type = $3 AND account_last4 = $4
         AND (property_address IS NULL OR property_address = '' OR property_address = '(no address)')
       RETURNING id`,
      [m.property_address, m.unit || null, m.utility_type, m.account_last4]
    );
    totalBills += upd.rowCount;

    const marker = upd.rowCount > 0 ? `✓ ${upd.rowCount} bills` : '  (no bills yet)';
    console.log(`${marker.padEnd(14)} ${m.utility_type.padEnd(12)} ···${m.account_last4}  →  ${m.property_address} Apt ${m.unit}`);
  } catch (err) {
    console.error(`✗ Error ${m.utility_type} ···${m.account_last4}: ${err.message}`);
  }
}

// ── Save flags for admin UI ───────────────────────────────────────────────────
const outPath = join(__dirname, '..', 'data', 'review-flags.json');
writeFileSync(outPath, JSON.stringify(flagged, null, 2));

console.log(`\n${'─'.repeat(70)}`);
console.log(`✅ Done!  Mappings: ${totalMappings}  |  Bills updated: ${totalBills}`);
console.log(`⚠️  Review flags saved → data/review-flags.json (${flagged.length} items)`);
await pool.end();
