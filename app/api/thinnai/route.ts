import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { ActionError, createRoom, viewFor } from '@/lib/server/rooms'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const session = await auth()
    const body = await request.json()
    const seatCount = Number(body?.seatCount)
    const seatPlan = Array.isArray(body?.seatPlan) ? (body.seatPlan as ('bot' | 'invite')[]) : undefined
    const { room, player } = createRoom(seatCount, String(body?.hostName ?? ''), session?.user?.id, seatPlan)
    return NextResponse.json({
      roomId: room.id,
      playerId: player.id,
      secret: player.secret,
      view: viewFor(room, player.id),
    })
  } catch (err) {
    const message = err instanceof ActionError ? err.message : 'Could not create the thinnai'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
