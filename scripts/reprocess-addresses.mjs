/**
 * Reprocesses bills missing a property address, extracting the correct SERVICE address.
 * Does UPDATE in Neon (no duplicates).
 * Run with: node scripts/reprocess-addresses.mjs
 */

import { fileURLToPath } from 'url';
import { dirname, join }  from 'path';
import { readFileSync }   from 'fs';
import { google }         from 'googleapis';
import Anthropic          from '@anthropic-ai/sdk';
import pg                 from 'pg';

// Load .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath   = join(__dirname, '..', '.env.local');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const ai   = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
    return Buffer.from(part.body.data, 'base64url').toString('utf-8'); // HTML sin modificar
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
const SYSTEM = `You are a utility bill data extractor for a short-term rental property management company.

Your ONLY job is to find the SERVICE ADDRESS — the physical address of the rental property where the utility is delivered.

Rules:
- The service address is where the electricity/gas/internet/water is provided.
- It is NOT the utility company's address.
- It is NOT the billing/mailing address if different from the service address.
- It is NOT the sender's address.
- It is typically labeled "Service Address", "Property Address", "Service Location", or similar.
- Return ONLY a JSON object with one field: { "property_address": "123 Main St, City, State ZIP" }
- If you cannot find the service address with confidence, return { "property_address": null }
- No markdown, no explanation, just JSON.`;

async function extractAddress(email, pdfBase64) {
  let content;

  // Intentar con PDF si existe (hasta 500KB de base64)
  if (pdfBase64 && pdfBase64.length < 500000) {
    content = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
      { type: 'text', text: `Subject: ${email.subject}\nFrom: ${email.from}` },
    ];
  } else {
    content = [{ type: 'text', text: `Subject: ${email.subject}\nFrom: ${email.from}\nDate: ${email.date}\n\n${email.body || email.snippet}` }];
  }

  const res  = await ai.messages.create({ model: 'claude-haiku-4-5-20251001', max_tokens: 256, system: SYSTEM, messages: [{ role: 'user', content }] });
  const text = res.content[0]?.text || '';
  try {
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
    return parsed.property_address || null;
  } catch { return null; }
}

// ── Main ───────────────────────────────────────────────────────────────────────
const gmail  = google.gmail({ version: 'v1', auth: getOAuth() });
const userId = process.env.GMAIL_USER;

// Obtener facturas sin dirección
const { rows } = await pool.query(
  `SELECT id, gmail_message_id, email_subject FROM utility_bills WHERE property_address IS NULL AND gmail_message_id IS NOT NULL ORDER BY id`
);

console.log(`🔍 Facturas sin dirección: ${rows.length}`);

let updated = 0, noAddress = 0, errors = 0;

for (let i = 0; i < rows.length; i++) {
  const bill = rows[i];
  process.stdout.write(`\r⏳ ${i + 1}/${rows.length} — actualizadas: ${updated} sin dirección: ${noAddress} errores: ${errors}`);

  // Descargar email de Gmail
  let email;
  try {
    const msgRes  = await gmail.users.messages.get({ userId, id: bill.gmail_message_id, format: 'full' });
    const msg     = msgRes.data;
    const headers = msg.payload?.headers || [];
    email = {
      subject: headers.find(h => h.name === 'Subject')?.value || '',
      from:    headers.find(h => h.name === 'From')?.value    || '',
      date:    headers.find(h => h.name === 'Date')?.value    || '',
      body:    decodeBody(msg.payload),
      snippet: msg.snippet || '',
    };

    // Intentar descargar PDF
    const pdfRef = findPdf(msg.payload);
    let pdfBase64 = null;
    if (pdfRef) {
      const att = await gmail.users.messages.attachments.get({ userId, messageId: bill.gmail_message_id, id: pdfRef.attachmentId });
      pdfBase64 = att.data.data?.replace(/-/g, '+').replace(/_/g, '/') || null;
    }

    // Extraer dirección con Claude
    let address;
    try {
      address = await extractAddress(email, pdfBase64);
    } catch (e) {
      if (e.message?.includes('429')) {
        process.stdout.write(` ⏸ rate limit, esperando 60s...`);
        await new Promise(r => setTimeout(r, 60000));
        address = await extractAddress(email, pdfBase64); // reintentar
      } else throw e;
    }

    if (address) {
      await pool.query(`UPDATE utility_bills SET property_address = $1 WHERE id = $2`, [address, bill.id]);
      updated++;
    } else {
      noAddress++;
    }

  } catch (e) {
    errors++;
  }

  await new Promise(r => setTimeout(r, 1500));
}

console.log(`\n\n✅ Reprocesado completado:`);
console.log(`   Direcciones encontradas: ${updated}`);
console.log(`   Sin dirección:           ${noAddress}`);
console.log(`   Errores:                 ${errors}`);
await pool.end();
