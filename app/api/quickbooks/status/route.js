import pool from '@/lib/db';
import { getCompanyInfo } from '@/lib/quickbooks';

/**
 * GET /api/quickbooks/status
 * Returns whether the app is connected to a QuickBooks company and basic info.
 *
 *  - { ok: true, connected: false }                      — no tokens stored yet
 *  - { ok: true, connected: true,  realmId, companyName }  — tokens present and valid
 *  - { ok: false, error }                                 — credentials present but API call failed
 */
export async function GET() {
  try {
    const r = await pool.query(
      `SELECT realm_id, expires_at FROM quickbooks_tokens ORDER BY updated_at DESC LIMIT 1`
    );
    if (r.rows.length === 0) {
      return Response.json({ ok: true, connected: false });
    }

    const info = await getCompanyInfo();
    return Response.json({
      ok:          true,
      connected:   true,
      realmId:     r.rows[0].realm_id,
      companyName: info?.CompanyInfo?.CompanyName || null,
      country:     info?.CompanyInfo?.Country || null,
    });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
