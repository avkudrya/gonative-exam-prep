import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

// Deployment check (deployment/check-web.sh): which build this process serves. No backend call.
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const buildId = (await readFile(join(process.cwd(), '.next/BUILD_ID'), 'utf8')).trim();
    return Response.json({status: 'ok', buildId}, {headers: {'Cache-Control': 'no-store'}});
  } catch {
    const production = process.env.NODE_ENV === 'production';
    return Response.json({status: production ? 'unavailable' : 'ok'}, {status: production ? 503 : 200, headers: {'Cache-Control': 'no-store'}});
  }
}
