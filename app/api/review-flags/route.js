import { readFileSync } from 'fs';
import { join }         from 'path';

export async function GET() {
  try {
    const path  = join(process.cwd(), 'data', 'review-flags.json');
    const flags = JSON.parse(readFileSync(path, 'utf-8'));
    return Response.json({ ok: true, flags });
  } catch {
    return Response.json({ ok: true, flags: [] });
  }
}
