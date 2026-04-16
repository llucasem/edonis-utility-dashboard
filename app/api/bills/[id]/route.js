import pool from '@/lib/db';

export async function PATCH(req, { params }) {
  try {
    const { id } = await params;
    const { property_address, unit } = await req.json();

    if (!property_address?.trim()) {
      return Response.json({ ok: false, error: 'Property address is required' }, { status: 400 });
    }

    const result = await pool.query(
      `UPDATE utility_bills
       SET property_address = $1, unit = $2
       WHERE id = $3`,
      [property_address.trim(), unit?.trim() || null, parseInt(id)]
    );

    if (result.rowCount === 0) {
      return Response.json({ ok: false, error: 'Bill not found' }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[bills PATCH]', err.message);
    return Response.json({ ok: false, error: err.message }, { status: 500 });
  }
}
