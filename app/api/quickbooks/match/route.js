import pool from '@/lib/db';
import { searchTransactions } from '@/lib/quickbooks';

const DATE_TOLERANCE_DAYS = 15;

function shiftDate(iso, days) {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * GET /api/quickbooks/match?billId=123
 *   → resolves bill from DB and matches against QB
 *
 * GET /api/quickbooks/match?amount=61.25&date=2026-04-15
 *   → ad-hoc match (used for manual checks)
 *
 * POST /api/quickbooks/match
 *   body: { billIds: [1,2,3] }
 *   → returns { results: { billId: { count, matches } } }
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const billId = searchParams.get('billId');

    let amount, dateAnchor;

    if (billId) {
      const r = await pool.query(
        `SELECT amount_due, due_date, email_received_at
         FROM utility_bills WHERE id = $1`,
        [billId]
      );
      if (r.rows.length === 0) {
        return Response.json({ ok: false, error: 'Bill not found' }, { status: 404 });
      }
      amount     = Number(r.rows[0].amount_due);
      dateAnchor = (r.rows[0].due_date || r.rows[0].email_received_at).toISOString().slice(0, 10);
    } else {
      amount     = parseFloat(searchParams.get('amount'));
      dateAnchor = searchParams.get('date');
      if (!amount || !dateAnchor) {
        return Response.json({ ok: false, error: 'Provide billId, or amount + date' }, { status: 400 });
      }
    }

    const dateFrom = shiftDate(dateAnchor, -DATE_TOLERANCE_DAYS);
    const dateTo   = shiftDate(dateAnchor,  DATE_TOLERANCE_DAYS);

    const matches = await searchTransactions({ amount, dateFrom, dateTo });

    return Response.json({
      ok:    true,
      query: { amount, dateFrom, dateTo },
      count: matches.length,
      matches,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { billIds } = await request.json();
    if (!Array.isArray(billIds) || billIds.length === 0) {
      return Response.json({ ok: false, error: 'billIds must be a non-empty array' }, { status: 400 });
    }

    const r = await pool.query(
      `SELECT id, amount_due, due_date, email_received_at
       FROM utility_bills
       WHERE id = ANY($1::int[]) AND amount_due IS NOT NULL AND amount_due > 0`,
      [billIds]
    );

    const results = {};
    // Sequential to avoid hammering QB API rate limits
    for (const row of r.rows) {
      const dateAnchor = (row.due_date || row.email_received_at).toISOString().slice(0, 10);
      const dateFrom   = shiftDate(dateAnchor, -DATE_TOLERANCE_DAYS);
      const dateTo     = shiftDate(dateAnchor,  DATE_TOLERANCE_DAYS);
      try {
        const matches = await searchTransactions({
          amount: Number(row.amount_due), dateFrom, dateTo,
        });
        results[row.id] = { count: matches.length, matches };
      } catch (e) {
        results[row.id] = { count: 0, matches: [], error: e.message };
      }
    }

    return Response.json({ ok: true, results });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
