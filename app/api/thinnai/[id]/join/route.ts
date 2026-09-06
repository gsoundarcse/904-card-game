import { NextResponse } from 'next/server'
import { ActionError, joinRoom, viewFor } from '@/lib/server/rooms'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { room, player } = joinRoom(id, String(body?.name ?? ''))
    return NextResponse.json({
      roomId: room.id,
      playerId: player.id,
      secret: player.secret,
      view: viewFor(room, player.id),
    })
  } catch (err) {
    const message = err instanceof ActionError ? err.message : 'Could not join'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
