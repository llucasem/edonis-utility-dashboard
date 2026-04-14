import pool from '@/lib/db';

// GET — returns unique accounts that have bills without an assigned address
export async function GET() {
  try {
    const result = await pool.query(
      `SELECT
         utility_type,
         account_last4,
         COUNT(*)                                        AS bill_count,
         MIN(amount_due)                                 AS amount_min,
         MAX(amount_due)                                 AS amount_max,
         MIN(email_received_at)                          AS date_min,
         MAX(email_received_at)                          AS date_max,
         STRING_AGG(DISTINCT email_from, ', '
           ORDER BY email_from)                          AS senders,
         MIN(email_subject)                              AS email_subject
       FROM utility_bills
       WHERE account_last4 IS NOT NULL
         AND (property_address IS NULL OR property_address = '(no address)')
         AND NOT EXISTS (
           SELECT 1 FROM account_mappings am
           WHERE am.utility_type  = utility_bills.utility_type
             AND am.account_last4 = utility_bills.account_last4
         )
       GROUP BY utility_type, account_last4
       ORDER BY utility_type, account_last4`
    );
    return Response.json({ ok: true, accounts: result.rows });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
