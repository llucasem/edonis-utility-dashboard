/**
 * Deep email investigation — run with: node scripts/deep-investigate.mjs
 *
 * Reads ALL emails between 2026-04-01 and 2026-04-06 from Edonis Gmail
 * and asks Claude Haiku to classify each one as rent / insurance / other.
 *
 * Output: deep-investigation.txt with hits, summary, and recurring senders.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync } from 'fs';
import { google } from 'googleapis';
import Anthropic from '@anthropic-ai/sdk';

// ─── Setup ─────────────────────────────────────────────────────────────────────
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

const ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Date range ────────────────────────────────────────────────────────────────
const SEARCH_QUERY = 'after:2026/04/01 before:2026/04/07';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function decodeBody(part) {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data)
    return Buffer.from(part.body.data, 'base64url').toString('utf-8');
  if (part.mimeType === 'text/html' && part.body?.data)
    return Buffer.from(part.body.data, 'base64url').toString('utf-8')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  if (part.parts) {
    for (const p of part.parts) { const t = decodeBody(p); if (t) return t; }
  }
  return '';
}

async function listAllMessages() {
  const ids = [];
  let pageToken;
  do {
    const r = await gmail.users.messages.list({
      userId, q: SEARCH_QUERY, maxResults: 500,
      ...(pageToken ? { pageToken } : {}),
    });
    ids.push(...(r.data.messages || []));
    pageToken = r.data.nextPageToken;
  } while (pageToken);
  return ids;
}

async function getEmail(id) {
  const r = await gmail.users.messages.get({ userId, id, format: 'full' });
  const msg = r.data;
  const headers = msg.payload?.headers || [];
  const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
  const from    = headers.find(h => h.name === 'From')?.value    || '(unknown)';
  const date    = headers.find(h => h.name === 'Date')?.value    || '';
  const body    = decodeBody(msg.payload);
  return {
    id, subject, from, date,
    snippet: msg.snippet || '',
    body: body.slice(0, 5000), // cap to control token usage
    labelIds: msg.labelIds || [],
  };
}

// ─── Classifier ────────────────────────────────────────────────────────────────
const SYSTEM = `You classify emails for a US short-term rental property management company (67 properties in Oslo, NYC, LA, Palm Springs).

Your job: identify ONLY emails that are about RENT PAYMENTS or INSURANCE for the company's properties (not personal cars, not phone bills, not utilities).

Reply with ONLY a valid JSON object, no markdown:
{
  "is_rent": boolean,           // true if email is rent payment confirmation, rent receipt, rent invoice, rent due notice for a property
  "is_insurance": boolean,      // true if email is property insurance bill, payment, renewal, policy doc (NOT auto/health/life insurance)
  "category": string,           // "rent_payment" | "rent_receipt" | "rent_due" | "insurance_bill" | "insurance_payment" | "insurance_renewal" | "rent_portal_login" | "none"
  "provider": string|null,      // company/portal name (e.g. "AppFolio", "Steadily")
  "amount": number|null,        // dollar amount if visible
  "property_address": string|null,
  "unit": string|null,
  "confidence": number,         // 0 to 1
  "reason": string              // <100 chars explaining the decision
}

Be strict: if you're not sure, set is_rent=false, is_insurance=false, category="none".
2FA codes for rent portals → category="rent_portal_login" (still useful info).`;

async function classify(email) {
  const prompt = `From: ${email.from}\nSubject: ${email.subject}\nDate: ${email.date}\n\n${email.body || email.snippet}`;
  const res = await ai.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = res.content[0]?.text || '';
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try {
    return { parsed: JSON.parse(cleaned), usage: res.usage };
  } catch {
    return { parsed: null, usage: res.usage, raw: text };
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════════════════════════');
console.log('DEEP GMAIL INVESTIGATION — Edonis');
console.log(`Query: ${SEARCH_QUERY}`);
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('📬 Listing all messages in date range...');
const ids = await listAllMessages();
console.log(`📨 Total emails found: ${ids.length}\n`);

if (ids.length === 0) {
  console.log('No emails to process.');
  process.exit(0);
}

const labelMap = new Map();
{
  const lbls = (await gmail.users.labels.list({ userId })).data.labels || [];
  lbls.forEach(l => labelMap.set(l.id, l.name));
}

const hits = { rent: [], insurance: [], login: [] };
const senders = new Map(); // sender → count
const allClassified = [];
let inputTokens = 0, outputTokens = 0, errors = 0;

for (let i = 0; i < ids.length; i++) {
  const { id } = ids[i];
  process.stdout.write(`\r⏳ ${i + 1}/${ids.length}  rent:${hits.rent.length}  ins:${hits.insurance.length}  errors:${errors}`);

  let email;
  try {
    email = await getEmail(id);
  } catch (e) {
    errors++;
    continue;
  }

  // Track sender frequency
  senders.set(email.from, (senders.get(email.from) || 0) + 1);

  let result;
  try {
    result = await classify(email);
  } catch (e) {
    if (String(e.message).includes('429') || String(e.message).includes('rate')) {
      await new Promise(r => setTimeout(r, 60000));
      try { result = await classify(email); } catch { errors++; continue; }
    } else {
      errors++;
      continue;
    }
  }

  if (result.usage) {
    inputTokens  += result.usage.input_tokens || 0;
    outputTokens += result.usage.output_tokens || 0;
  }

  const p = result.parsed;
  if (!p) continue;

  const labelNames = email.labelIds
    .map(lid => labelMap.get(lid) || lid)
    .filter(n => !['INBOX','UNREAD','IMPORTANT','SENT','CATEGORY_PERSONAL','CATEGORY_UPDATES','CATEGORY_PROMOTIONS','CATEGORY_SOCIAL','CATEGORY_FORUMS'].includes(n));

  const record = {
    id, from: email.from, subject: email.subject, date: email.date,
    labels: labelNames,
    ...p,
  };
  allClassified.push(record);

  if (p.is_rent && p.confidence >= 0.5) hits.rent.push(record);
  else if (p.is_insurance && p.confidence >= 0.5) hits.insurance.push(record);
  else if (p.category === 'rent_portal_login') hits.login.push(record);

  // Throttle to respect Anthropic 30k tokens/min on Haiku
  await new Promise(r => setTimeout(r, 800));
}

console.log('\n');

// ─── Build report ──────────────────────────────────────────────────────────────
const lines = [];
const push = (...s) => lines.push(s.join(''));

push('═══════════════════════════════════════════════════════════════');
push('DEEP GMAIL INVESTIGATION — REPORT');
push(`Query: ${SEARCH_QUERY}`);
push(`Total emails processed: ${ids.length}`);
push(`Errors: ${errors}`);
push(`Tokens — input: ${inputTokens.toLocaleString()}  output: ${outputTokens.toLocaleString()}`);
push(`Estimated cost (Haiku 4.5): $${((inputTokens / 1_000_000) * 0.80 + (outputTokens / 1_000_000) * 4.00).toFixed(4)}`);
push('═══════════════════════════════════════════════════════════════\n');

push('### 1) RENT HITS');
if (hits.rent.length === 0) {
  push('(none)');
} else {
  hits.rent.forEach((r, i) => {
    push(`\n[${i + 1}] ${r.date}`);
    push(`    From:    ${r.from}`);
    push(`    Subject: ${r.subject}`);
    push(`    Labels:  ${r.labels.join(', ') || '(none)'}`);
    push(`    Category: ${r.category}  Confidence: ${r.confidence}`);
    push(`    Provider: ${r.provider || '—'}  Amount: ${r.amount ?? '—'}`);
    push(`    Property: ${r.property_address || '—'}  Unit: ${r.unit || '—'}`);
    push(`    Reason:  ${r.reason}`);
  });
}

push('\n\n### 2) INSURANCE HITS');
if (hits.insurance.length === 0) {
  push('(none)');
} else {
  hits.insurance.forEach((r, i) => {
    push(`\n[${i + 1}] ${r.date}`);
    push(`    From:    ${r.from}`);
    push(`    Subject: ${r.subject}`);
    push(`    Labels:  ${r.labels.join(', ') || '(none)'}`);
    push(`    Category: ${r.category}  Confidence: ${r.confidence}`);
    push(`    Provider: ${r.provider || '—'}  Amount: ${r.amount ?? '—'}`);
    push(`    Property: ${r.property_address || '—'}  Unit: ${r.unit || '—'}`);
    push(`    Reason:  ${r.reason}`);
  });
}

push('\n\n### 3) RENT PORTAL LOGINS / 2FA CODES');
if (hits.login.length === 0) {
  push('(none)');
} else {
  hits.login.forEach((r, i) => {
    push(`\n[${i + 1}] ${r.date}  ${r.from}`);
    push(`    Subject: ${r.subject}`);
    push(`    Provider: ${r.provider || '—'}  Reason: ${r.reason}`);
  });
}

push('\n\n### 4) TOP 25 SENDERS IN THE WINDOW');
const topSenders = Array.from(senders.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25);
topSenders.forEach(([s, c]) => push(`  ${String(c).padStart(3)} × ${s}`));

push('\n\n### 5) ALL CLASSIFIED EMAILS (compact)');
allClassified.forEach((r, i) => {
  const flag = r.is_rent ? '[RENT]' : r.is_insurance ? '[INS]' : r.category === 'rent_portal_login' ? '[LOGIN]' : '     ';
  push(`${flag} ${r.date.slice(0, 16)}  ${r.from.slice(0, 50).padEnd(50)}  ${r.subject.slice(0, 60)}`);
});

const outPath = join(__dirname, '..', 'deep-investigation.txt');
writeFileSync(outPath, lines.join('\n'), 'utf8');
console.log(`✅ Report written to ${outPath}`);
console.log(`   Rent hits: ${hits.rent.length}`);
console.log(`   Insurance hits: ${hits.insurance.length}`);
console.log(`   Portal login emails: ${hits.login.length}`);
console.log(`   Cost: $${((inputTokens / 1_000_000) * 0.80 + (outputTokens / 1_000_000) * 4.00).toFixed(4)}`);
