import { NextResponse } from 'next/server'
import { ActionError, getRoom, touch, viewFor } from '@/lib/server/rooms'

export const dynamic = 'force-dynamic'

/**
 * Plain polling. The client asks about once a second and passes the version it
 * last saw; if nothing has changed we say so cheaply with 204 rather than
 * re-serialising the whole room.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const playerId = url.searchParams.get('playerId') ?? ''
    const since = Number(url.searchParams.get('since') ?? '-1')

    const room = getRoom(id)
    if (!room) return NextResponse.json({ error: 'That thinnai does not exist' }, { status: 404 })

    touch(room, playerId)
    if (Number.isFinite(since) && room.version === since) {
      return new NextResponse(null, { status: 204 })
    }
    return NextResponse.json({ view: viewFor(room, playerId) })
  } catch (err) {
    const message = err instanceof ActionError ? err.message : 'Could not read the thinnai'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
