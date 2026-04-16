/**
 * Full historical sync — run with: node scripts/run-sync.mjs
 * Processes all Utilities emails since January 1st with no timeout.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';
import pg from 'pg';

// Load .env.local manually (no dotenv dependency)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const { Pool } = pg;
const pool  = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const ai    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Gmail ──────────────────────────────────────────────────────────────────────
function getOAuth() {
  const c = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  c.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return c;
}

function decodeBody(part) {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data)
    return Buffer.from(part.body.data, 'base64url').toString('utf-8');
  if (part.mimeType === 'text/html' && part.body?.data)
    return Buffer.from(part.body.data, 'base64url').toString('utf-8').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (part.parts) {
    for (const p of part.parts) { const t = decodeBody(p); if (t) return t; }
  }
  return '';
}

function findPdf(part) {
  if (!part) return null;
  if (part.mimeType === 'application/pdf' && part.body?.attachmentId)
    return { filename: part.filename, attachmentId: part.body.attachmentId };
  if (part.parts) { for (const p of part.parts) { const r = findPdf(p); if (r) return r; } }
  return null;
}

// ── Parser ─────────────────────────────────────────────────────────────────────
const SYSTEM = `You are a utility bill data extractor. Extract fields from a utility bill email or PDF and return ONLY a valid JSON object.
Fields: utility_type (electricity/internet/gas/water/rent/insurance/other), property_address (service address or null), unit (or null), account_last4 (last 4 digits or null), amount_due (number or null), due_date (YYYY-MM-DD or null).
Return ONLY the JSON, no markdown.`;

async function parseEmail(email) {
  let content;
  const pdfIsSmall = email.pdfBase64 && email.pdfBase64.length < 200000;

  if (pdfIsSmall) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: email.pdfBase64 } },
      { type: 'text', text: `Subject: ${email.subject}\nFrom: ${email.from}\nDate: ${email.date}` },
    ];
  } else {
    content = [{ type: 'text', text: `Subject: ${email.subject}\nFrom: ${email.from}\nDate: ${email.date}\n\n${email.body || email.snippet}` }];
  }

  const res  = await ai.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 512, system: SYSTEM, messages: [{ role: 'user', content }] });
  const text = res.content[0]?.text || '';
  try { return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()); }
  catch { return null; }
}

// ── Main ───────────────────────────────────────────────────────────────────────
const gmail  = google.gmail({ version: 'v1', auth: getOAuth() });
const userId = process.env.GMAIL_USER;

console.log('🔍 Looking for Utilities label in Gmail...');
const labelsRes = await gmail.users.labels.list({ userId });
const utLabel   = labelsRes.data.labels?.find(l => l.name.toLowerCase() === 'utilities');
if (!utLabel) { console.error('❌ Gmail label "Utilities" not found'); process.exit(1); }

console.log('📬 Fetching email list since January 1st...');
const messages = [];
let pageToken  = undefined;
do {
  const r = await gmail.users.messages.list({ userId, labelIds: [utLabel.id], maxResults: 500, q: 'after:2026/01/01', ...(pageToken ? { pageToken } : {}) });
  messages.push(...(r.data.messages || []));
  pageToken = r.data.nextPageToken;
} while (pageToken);

console.log(`📨 Total emails found: ${messages.length}`);

// Payment confirmation subjects — skip before calling Claude
const SKIP_SUBJECTS = [
  'automatic monthly payment is scheduled',
  'thanks for paying your con edison bill',
  'thank you for your payment',
];

let saved = 0, skipped = 0, errors = 0;

for (let i = 0; i < messages.length; i++) {
  const { id } = messages[i];
  process.stdout.write(`\r⏳ Processing ${i + 1}/${messages.length} — saved: ${saved} errors: ${errors}`);

  // Fetch full email
  let email;
  try {
    const msgRes  = await gmail.users.messages.get({ userId, id, format: 'full' });
    const msg     = msgRes.data;
    const headers = msg.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const from    = headers.find(h => h.name === 'From')?.value    || '';
    const dateStr = headers.find(h => h.name === 'Date')?.value    || '';
    const body    = decodeBody(msg.payload);
    const pdfRef  = findPdf(msg.payload);
    let pdfBase64 = null;
    if (pdfRef) {
      const att = await gmail.users.messages.attachments.get({ userId, messageId: id, id: pdfRef.attachmentId });
      pdfBase64 = att.data.data?.replace(/-/g, '+').replace(/_/g, '/') || null;
    }
    email = { id, subject, from, date: dateStr ? new Date(dateStr).toISOString() : null, snippet: msg.snippet || '', body, pdfBase64 };
  } catch (e) {
    errors++;
    continue;
  }

  // Skip payment confirmation emails before calling Claude
  if (SKIP_SUBJECTS.some(s => email.subject.toLowerCase().includes(s))) {
    skipped++;
    continue;
  }

  // Parse with Claude
  let parsed;
  try {
    parsed = await parseEmail(email);
  } catch (e) {
    if (e.message?.includes('429')) await new Promise(r => setTimeout(r, 60000));
    errors++;
    continue;
  }

  if (!parsed) { errors++; continue; }

  // Save to Neon
  try {
    const res = await pool.query(
      `INSERT INTO utility_bills (gmail_message_id, utility_type, property_address, unit, account_last4, amount_due, due_date, email_received_at, email_subject, email_from, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') ON CONFLICT (gmail_message_id) DO NOTHING`,
      [id, parsed.utility_type || 'other', parsed.property_address || null, parsed.unit || null, parsed.account_last4 || null, parsed.amount_due || null, parsed.due_date || null, email.date, email.subject, email.from || null]
    );
    if (res.rowCount === 0) skipped++; else saved++;
  } catch (e) { errors++; }

  await new Promise(r => setTimeout(r, 1500));
}

console.log(`\n\n✅ Sync complete:`);
console.log(`   Saved:    ${saved}`);
console.log(`   Skipped:  ${skipped} (already existed)`);
console.log(`   Errors:   ${errors}`);
await pool.end();
