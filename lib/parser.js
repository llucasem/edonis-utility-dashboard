import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a utility bill data extractor for a short-term rental property management company. Extract fields from utility bills and return ONLY a valid JSON object.

Fields to extract:
- utility_type: one of "electricity", "internet", "gas", "water", "rent", "insurance", "other"
- property_address: the SERVICE address — the physical address where the utility is delivered (the rental property). This is NOT the utility company's address, NOT the billing/mailing address. It is the address of the apartment or property receiving the service. Example: "4750 Lincoln Blvd, Marina Del Rey, CA 90292"
- unit: apartment/unit number if present (e.g. "Apt 4B", "Unit 102"), otherwise null
- account_last4: last 4 digits of the account or service number, otherwise null
- amount_due: numeric amount to pay (just the number, no currency symbol), or null
- due_date: due date in ISO format YYYY-MM-DD, or null

Important: property_address must be the rental property address, not the sender's address. If you cannot identify the service address with confidence, return null.
Return ONLY the JSON object, no markdown, no explanation.`;

// ── Extraer datos de un email usando Claude ────────────────────────────────────
export async function parseEmail(email) {
  let content;

  // Solo mandar el PDF si es pequeño (< 200KB en base64 ≈ factura de 1-2 páginas)
  const pdfIsSmall = email.pdfBase64 && email.pdfBase64.length < 200000;

  if (pdfIsSmall) {
    // Tiene PDF adjunto manejable → mandamos el PDF a Claude directamente
    content = [
      {
        type: 'document',
        source: {
          type:       'base64',
          media_type: 'application/pdf',
          data:       email.pdfBase64,
        },
      },
      {
        type: 'text',
        text: `Email subject: ${email.subject}\nFrom: ${email.from}\nDate: ${email.date}\n\nExtract the utility bill data from the attached PDF.`,
      },
    ];
  } else {
    // Sin PDF → mandamos el cuerpo del email
    content = [
      {
        type: 'text',
        text: `Email subject: ${email.subject}\nFrom: ${email.from}\nDate: ${email.date}\n\nEmail body:\n${email.body || email.snippet}`,
      },
    ];
  }

  const response = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system:     SYSTEM_PROMPT,
    messages:   [{ role: 'user', content }],
  });

  const text = response.content[0]?.text || '';

  try {
    // Limpiar posible envoltorio markdown (```json ... ```)
    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean);
  } catch {
    console.error('[parser] Claude devolvió JSON inválido:', text);
    return null;
  }
}
