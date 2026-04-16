import { getUtilityEmails } from '@/lib/gmail';
import { parseEmail }       from '@/lib/parser';
import pool                 from '@/lib/db';

export async function GET() {
  try {
    const emails = await getUtilityEmails();

    if (emails.length === 0) {
      return Response.json({ ok: true, saved: 0, message: 'No hay emails en la carpeta Utilities.' });
    }

    const results = [];

    // Subjects that are payment confirmations, not bills — skip before calling Claude
    const SKIP_SUBJECTS = [
      'automatic monthly payment is scheduled',
      'thanks for paying your con edison bill',
      'thank you for your payment',
    ];

    for (const email of emails) {
      // Skip known payment-confirmation emails (not bills — no useful address/account info)
      const subjectLower = (email.subject || '').toLowerCase();
      if (SKIP_SUBJECTS.some(s => subjectLower.includes(s))) {
        results.push({ id: email.id, status: 'skipped', reason: 'payment confirmation — not a bill' });
        continue;
      }

      // 1. Parsear con Claude (leer PDF si existe, o cuerpo del email)
      let parsed;
      try {
        parsed = await parseEmail(email);
      } catch (parseErr) {
        const reason = parseErr.message?.includes('429') ? 'rate limit — reintentar más tarde' : parseErr.message;
        results.push({ id: email.id, status: 'error', reason });
        await new Promise(r => setTimeout(r, 2000)); // esperar más si hay rate limit
        continue;
      }

      if (!parsed) {
        results.push({ id: email.id, status: 'error', reason: 'Claude no pudo extraer datos' });
        continue;
      }

      // Skip emails with no payable amount — notifications, confirmations, etc.
      if (!parsed.amount_due || parseFloat(parsed.amount_due) <= 0) {
        results.push({ id: email.id, status: 'skipped', reason: 'amount_due is 0 or missing' });
        continue;
      }

      // 2. Aplicar mapping si existe y no hay dirección extraída del email
      let finalAddress = parsed.property_address || null;
      let finalUnit    = parsed.unit             || null;
      if (!finalAddress && parsed.account_last4 && parsed.utility_type) {
        const mapRes = await pool.query(
          `SELECT property_address, unit FROM account_mappings
           WHERE utility_type = $1 AND account_last4 = $2 LIMIT 1`,
          [parsed.utility_type, parsed.account_last4]
        );
        if (mapRes.rows.length > 0) {
          finalAddress = mapRes.rows[0].property_address;
          finalUnit    = finalUnit || mapRes.rows[0].unit;
        }
      }

      // 3. Guardar en Neon — ON CONFLICT skips duplicates atomically
      const res = await pool.query(
        `INSERT INTO utility_bills
           (gmail_message_id, utility_type, property_address, unit, account_last4,
            amount_due, due_date, email_received_at, email_subject, email_from, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')
         ON CONFLICT (gmail_message_id) DO NOTHING`,
        [
          email.id,
          parsed.utility_type  || 'other',
          finalAddress,
          finalUnit,
          parsed.account_last4 || null,
          parsed.amount_due    || null,
          parsed.due_date      || null,
          email.date,
          email.subject,
          email.from           || null,
        ]
      );

      if (res.rowCount === 0) {
        results.push({ id: email.id, status: 'skipped', reason: 'ya procesado' });
      } else {
        results.push({ id: email.id, status: 'saved', data: parsed });
      }

      // Pausa entre llamadas a Claude para no exceder el límite de velocidad
      await new Promise(r => setTimeout(r, 2000));
    }

    const saved   = results.filter(r => r.status === 'saved').length;
    const skipped = results.filter(r => r.status === 'skipped').length;
    const errors  = results.filter(r => r.status === 'error').length;

    return Response.json({ ok: true, saved, skipped, errors, results });

  } catch (error) {
    console.error('[sync] Error:', error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
