import { readFileSync, writeFileSync } from 'fs';
import { join }                        from 'path';

const flagsPath = () => join(process.cwd(), 'data', 'review-flags.json');

export async function GET() {
  try {
    const flags = JSON.parse(readFileSync(flagsPath(), 'utf-8'));
    return Response.json({ ok: true, flags });
  } catch {
    return Response.json({ ok: true, flags: [] });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const index = parseInt(searchParams.get('index'), 10);

    const flags = JSON.parse(readFileSync(flagsPath(), 'utf-8'));

    if (isNaN(index) || index < 0 || index >= flags.length) {
      return Response.json({ ok: false, error: 'Invalid index' }, { status: 400 });
    }

    flags.splice(index, 1);
    writeFileSync(flagsPath(), JSON.stringify(flags, null, 2), 'utf-8');

    return Response.json({ ok: true, remaining: flags.length });
  } catch (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
}
