'use client'

import { useEffect, useState } from 'react'

const RIBBONS = [
  ['left-[8%]', 'bg-gold', '[-12deg]', '0.1s'],
  ['left-[20%]', 'bg-team-b', '[18deg]', '0.25s'],
  ['left-[34%]', 'bg-suit-red', '[-25deg]', '0.4s'],
  ['left-[50%]', 'bg-gold-soft', '[12deg]', '0.05s'],
  ['left-[66%]', 'bg-team-b', '[-18deg]', '0.3s'],
  ['left-[80%]', 'bg-suit-red', '[24deg]', '0.18s'],
  ['left-[92%]', 'bg-gold', '[-8deg]', '0.35s'],
]

export function StrongSupport({ revealed, eligible }: { revealed: boolean; eligible: boolean }) {
  const [celebrating, setCelebrating] = useState(false)

  useEffect(() => {
    if (!celebrating) return
    const timer = setTimeout(() => setCelebrating(false), 1900)
    return () => clearTimeout(timer)
  }, [celebrating])

  if (!revealed || !eligible) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setCelebrating(true)}
        className="rounded-xl border border-gold/60 bg-gold/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gold transition-transform hover:-translate-y-0.5 hover:bg-gold/20"
      >
        Strong support
      </button>

      {celebrating && (
        <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
          <div className="absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full border border-gold/60 bg-felt-dark/90 px-5 py-2 font-serif text-lg font-bold text-gold-soft shadow-xl animate-in fade-in zoom-in">
            Strong support!
          </div>
          {RIBBONS.map(([position, color, rotation, delay]) => (
            <span
              key={position}
              className={`absolute top-[-12%] h-28 w-3 origin-top animate-ribbon ${position} ${color}`}
              style={{ transform: `rotate(${rotation})`, animationDelay: delay }}
            />
          ))}
        </div>
      )}
    </>
  )
}
