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

    for (const email of emails) {
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

      // 2. Guardar en Neon — ON CONFLICT skips duplicates atomically
      const res = await pool.query(
        `INSERT INTO utility_bills
           (gmail_message_id, utility_type, property_address, unit, account_last4,
            amount_due, due_date, email_received_at, email_subject, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
         ON CONFLICT (gmail_message_id) DO NOTHING`,
        [
          email.id,
          parsed.utility_type     || 'other',
          parsed.property_address || null,
          parsed.unit             || null,
          parsed.account_last4    || null,
          parsed.amount_due       || null,
          parsed.due_date         || null,
          email.date,
          email.subject,
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
