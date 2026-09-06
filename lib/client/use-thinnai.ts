'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Action, PlayerView } from '@/lib/server/rooms'

export interface Credentials {
  playerId: string
  secret: string
}

const POLL_MS = 1000

function storageKey(roomId: string) {
  return `thinnai:${roomId}`
}

/** Credentials live in localStorage so a refresh rejoins the same seat. */
export function loadCredentials(roomId: string): Credentials | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(roomId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed?.playerId && parsed?.secret ? parsed : null
  } catch {
    return null
  }
}

export function saveCredentials(roomId: string, creds: Credentials) {
  try {
    window.localStorage.setItem(storageKey(roomId), JSON.stringify(creds))
  } catch {
    // Private browsing and similar. The session still works until reload.
  }
}

/**
 * Polls the room once a second and exposes a sender for actions.
 *
 * The server is the only source of truth: `send` posts an action and takes the
 * fresh view straight from the response, so a move shows up immediately for the
 * player who made it without waiting for the next poll.
 */
export function useThinnai(roomId: string, creds: Credentials | null) {
  const [view, setView] = useState<PlayerView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const versionRef = useRef(-1)
  const stopped = useRef(false)

  useEffect(() => {
    if (!creds) return
    stopped.current = false

    async function poll() {
      while (!stopped.current) {
        try {
          const res = await fetch(
            `/api/thinnai/${roomId}/state?playerId=${encodeURIComponent(creds!.playerId)}&since=${versionRef.current}`,
            { cache: 'no-store' },
          )
          if (res.status === 204) {
            // Unchanged.
          } else if (res.ok) {
            const data = await res.json()
            if (data?.view) {
              versionRef.current = data.view.version
              setView(data.view)
            }
          }
        } catch {
          // Network blip. Keep polling; the next tick usually recovers.
        }
        await new Promise((r) => setTimeout(r, POLL_MS))
      }
    }

    poll()
    return () => {
      stopped.current = true
    }
  }, [roomId, creds])

  const send = useCallback(
    async (action: Action) => {
      if (!creds) return
      setPending(true)
      setError(null)
      try {
        const res = await fetch(`/api/thinnai/${roomId}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...creds, action }),
        })
        const data = await res.json()
        if (!res.ok) {
          setError(data?.error ?? 'That move was rejected')
        } else if (data?.view) {
          versionRef.current = data.view.version
          setView(data.view)
        }
      } catch {
        setError('Could not reach the table')
      } finally {
        setPending(false)
      }
    },
    [roomId, creds],
  )

  return { view, error, pending, send, clearError: () => setError(null) }
}
