/**
 * Gmail investigation — run with: node scripts/investigate-emails.mjs
 *
 * Reports (read-only, no DB writes):
 *  1. All Gmail labels (folders)
 *  2. Insurance candidates: keyword and known-provider matches since 2025-10-01
 *  3. Rent candidates: keyword and known-provider matches since 2025-10-01
 *
 * Output: prints a structured summary to stdout. Save with `> investigation.txt`.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const oauth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
oauth.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
const gmail  = google.gmail({ version: 'v1', auth: oauth });
const userId = process.env.GMAIL_USER;

// ─── Search queries ────────────────────────────────────────────────────────────
const SINCE = 'after:2025/10/01';

const INSURANCE_QUERIES = [
  { label: 'Keyword: "insurance"',        q: `${SINCE} (insurance OR "insurance policy")` },
  { label: 'Keyword: "policy renewal"',   q: `${SINCE} ("policy renewal" OR "policy is renewing" OR "your policy")` },
  { label: 'Keyword: "premium" / "coverage"', q: `${SINCE} (premium OR coverage OR underwriting)` },
  { label: 'Provider: Allstate',          q: `${SINCE} (from:allstate.com OR from:myaccount.allstate.com)` },
  { label: 'Provider: State Farm',        q: `${SINCE} (from:statefarm.com)` },
  { label: 'Provider: Geico',             q: `${SINCE} (from:geico.com)` },
  { label: 'Provider: Liberty Mutual',    q: `${SINCE} (from:libertymutual.com)` },
  { label: 'Provider: Progressive',       q: `${SINCE} (from:progressive.com)` },
  { label: 'Provider: Lemonade',          q: `${SINCE} (from:lemonade.com)` },
  { label: 'Provider: Travelers',         q: `${SINCE} (from:travelers.com)` },
  { label: 'Provider: Farmers',           q: `${SINCE} (from:farmers.com)` },
  { label: 'Provider: Nationwide',        q: `${SINCE} (from:nationwide.com)` },
  { label: 'Provider: Hippo',             q: `${SINCE} (from:hippo.com)` },
  { label: 'Provider: Steadily / Obie / Proper (STR)', q: `${SINCE} (from:steadily.com OR from:obierisk.com OR from:proper.insure)` },
];

const RENT_QUERIES = [
  { label: 'Keyword: rent / lease / landlord', q: `${SINCE} (rent OR "monthly rent" OR landlord OR lease)` },
  { label: 'Keyword: payment received / receipt', q: `${SINCE} ("rent payment" OR "rent receipt" OR "payment receipt" OR "payment confirmation")` },
  { label: 'Provider: Buildium',          q: `${SINCE} (from:buildium.com)` },
  { label: 'Provider: AppFolio',          q: `${SINCE} (from:appfolio.com)` },
  { label: 'Provider: RentManager',       q: `${SINCE} (from:rentmanager.com)` },
  { label: 'Provider: Yardi / Rentcafe',  q: `${SINCE} (from:yardi.com OR from:rentcafe.com)` },
  { label: 'Provider: TenantCloud',       q: `${SINCE} (from:tenantcloud.com)` },
  { label: 'Provider: Avail',             q: `${SINCE} (from:avail.co)` },
  { label: 'Provider: Cozy / Apartments.com', q: `${SINCE} (from:cozy.co OR from:apartments.com)` },
  { label: 'Provider: PayLease / Zego',   q: `${SINCE} (from:paylease.com OR from:gozego.com)` },
  { label: 'Provider: Stripe (rent ACH)', q: `${SINCE} (from:stripe.com rent)` },
  { label: 'Provider: PayPal (rent)',     q: `${SINCE} (from:paypal.com rent)` },
  { label: 'Provider: Zelle (rent)',      q: `${SINCE} (zelle rent)` },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
async function listAllLabels() {
  const res = await gmail.users.labels.list({ userId });
  return res.data.labels || [];
}

async function searchTopMessages(q, maxResults = 8) {
  const res = await gmail.users.messages.list({ userId, q, maxResults });
  const ids = res.data.messages || [];
  const total = res.data.resultSizeEstimate || ids.length;

  const samples = [];
  for (const { id } of ids.slice(0, 5)) {
    const m = await gmail.users.messages.get({
      userId, id, format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'Date'],
    });
    const headers = m.data.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
    const from    = headers.find(h => h.name === 'From')?.value    || '(unknown)';
    const date    = headers.find(h => h.name === 'Date')?.value    || '';
    samples.push({ id, subject, from, date, snippet: (m.data.snippet || '').slice(0, 120), labelIds: m.data.labelIds || [] });
  }
  return { total, samples };
}

// ─── Main ──────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('GMAIL INVESTIGATION — Edonis utility dashboard');
console.log(`User: ${userId}`);
console.log(`Date range: since 2025-10-01`);
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('### 1) ALL GMAIL LABELS\n');
const labels = await listAllLabels();
const labelMap = new Map(labels.map(l => [l.id, l.name]));
const userLabels = labels.filter(l => l.type === 'user').sort((a, b) => a.name.localeCompare(b.name));
const systemLabels = labels.filter(l => l.type === 'system').map(l => l.name).sort();
console.log(`User-defined labels (${userLabels.length}):`);
userLabels.forEach(l => console.log(`  - ${l.name}`));
console.log(`\nSystem labels: ${systemLabels.join(', ')}\n`);

async function runSection(title, queries) {
  console.log(`\n### ${title}\n`);
  for (const { label, q } of queries) {
    process.stderr.write(`  Searching: ${label}...\n`);
    try {
      const { total, samples } = await searchTopMessages(q);
      if (total === 0) {
        console.log(`[${label}] → 0 results`);
        continue;
      }
      console.log(`\n[${label}] → ~${total} results`);
      console.log(`  Query: ${q}`);
      samples.forEach((s, i) => {
        const lblNames = s.labelIds.map(id => labelMap.get(id) || id).filter(n => !['UNREAD', 'INBOX', 'IMPORTANT', 'CATEGORY_PERSONAL', 'CATEGORY_UPDATES', 'CATEGORY_PROMOTIONS', 'CATEGORY_FORUMS'].includes(n));
        console.log(`  ${i + 1}. [${s.date}] ${s.from}`);
        console.log(`     "${s.subject}"`);
        console.log(`     Labels: ${lblNames.join(', ') || '(none)'}`);
        console.log(`     Snippet: ${s.snippet}`);
      });
    } catch (e) {
      console.log(`[${label}] → ERROR: ${e.message}`);
    }
  }
}

await runSection('2) INSURANCE CANDIDATES', INSURANCE_QUERIES);
await runSection('3) RENT CANDIDATES', RENT_QUERIES);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('Investigation complete.');
console.log('═══════════════════════════════════════════════════════════════');
