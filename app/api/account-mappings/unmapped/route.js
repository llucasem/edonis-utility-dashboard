import pool from '@/lib/db';

// GET — devuelve cuentas únicas que tienen facturas sin dirección asignada
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT DISTINCT
         utility_type,
         account_last4,
         email_subject,
         COUNT(*) AS bill_count
       FROM utility_bills
       WHERE account_last4 IS NOT NULL
         AND (property_address IS NULL OR property_address = '(no address)')
         AND NOT EXISTS (
           SELECT 1 FROM account_mappings am
           WHERE am.utility_type  = utility_bills.utility_type
             AND am.account_last4 = utility_bills.account_last4
         )
       GROUP BY utility_type, account_last4, email_subject
       ORDER BY utility_type, account_last4`
    );
    return Response.json({ ok: true, accounts: result.rows });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
