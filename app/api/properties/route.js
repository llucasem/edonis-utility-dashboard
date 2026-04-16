import pool from '@/lib/db';

// Ensure the properties table exists
async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS properties (
      id         SERIAL PRIMARY KEY,
      address    TEXT NOT NULL UNIQUE,
      nickname   TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function GET() {
  try {
    await ensureTable();

    const result = await pool.query(`
      SELECT address FROM (
        SELECT DISTINCT property_address AS address
        FROM   utility_bills
        WHERE  property_address IS NOT NULL AND TRIM(property_address) != ''
        UNION
        SELECT address FROM properties
      ) combined
      ORDER BY address
    `);

    return Response.json({ ok: true, properties: result.rows.map(r => r.address) });
  } catch (err) {
    console.error('[properties GET]', err.message);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    await ensureTable();
    const { address, nickname } = await req.json();

    if (!address?.trim()) {
      return Response.json({ ok: false, error: 'Address is required' }, { status: 400 });
    }

    await pool.query(
      `INSERT INTO properties (address, nickname)
       VALUES ($1, $2)
       ON CONFLICT (address) DO UPDATE SET nickname = EXCLUDED.nickname`,
      [address.trim(), nickname?.trim() || null]
    );

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[properties POST]', err.message);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
