import { NextResponse } from 'next/server'
import { type Action, ActionError, applyAction, viewFor } from '@/lib/server/rooms'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const playerId = String(body?.playerId ?? '')
    const secret = String(body?.secret ?? '')
    const action = body?.action as Action

    if (!action?.type) throw new ActionError('No action given')

    const room = applyAction(id, playerId, secret, action)
    return NextResponse.json({ view: viewFor(room, playerId) })
  } catch (err) {
    const message = err instanceof ActionError ? err.message : 'That move was rejected'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
