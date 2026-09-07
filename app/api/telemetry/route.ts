import { NextResponse } from 'next/server'
import { recordMetric } from '@/lib/server/telemetry'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const message = typeof body?.message === 'string' ? body.message.slice(0, 500) : 'Unknown client error'
    const digest = typeof body?.digest === 'string' ? body.digest.slice(0, 100) : undefined
    recordMetric('clientErrors', { message, ...(digest ? { digest } : {}) })
    return NextResponse.json({ ok: true })
  } catch {
    recordMetric('serverErrors', { source: 'telemetry_endpoint' })
    return NextResponse.json({ error: 'Invalid telemetry payload' }, { status: 400 })
  }
}
