import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ActionError, getLobbyPreview, joinRoom, viewFor } from '@/lib/server/rooms'

export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    return NextResponse.json(getLobbyPreview(id))
  } catch (err) {
    const message = err instanceof ActionError ? err.message : 'Could not find that thinnai'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth()
    const { id } = await params
    const body = await request.json()
    const seat = Number.isInteger(body?.seat) ? Number(body.seat) : undefined
    const { room, player } = joinRoom(id, String(body?.name ?? ''), session?.user?.id, seat)
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
