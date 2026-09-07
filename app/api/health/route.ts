import { NextResponse } from 'next/server'
import { metricsSnapshot } from '@/lib/server/telemetry'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const expected = process.env.MONITORING_TOKEN
  if (expected) {
    const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (supplied !== expected) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ status: 'ok', metrics: metricsSnapshot() })
}
