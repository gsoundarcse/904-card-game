// Falling ribbon confetti, dropped in wherever a win deserves a flourish.
const RIBBONS = [
  ['left-[8%]', 'bg-gold', '[-12deg]', '0.1s'],
  ['left-[20%]', 'bg-team-a', '[18deg]', '0.25s'],
  ['left-[34%]', 'bg-suit-red', '[-25deg]', '0.4s'],
  ['left-[50%]', 'bg-gold-soft', '[12deg]', '0.05s'],
  ['left-[66%]', 'bg-team-a', '[-18deg]', '0.3s'],
  ['left-[80%]', 'bg-suit-red', '[24deg]', '0.18s'],
  ['left-[92%]', 'bg-gold', '[-8deg]', '0.35s'],
] as const

export function Ribbons() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[70] overflow-hidden" aria-hidden>
      {RIBBONS.map(([position, color, rotation, delay]) => (
        <span
          key={position}
          className={`absolute top-[-12%] h-28 w-3 origin-top animate-ribbon ${position} ${color}`}
          style={{ transform: `rotate(${rotation})`, animationDelay: delay }}
        />
      ))}
    </div>
  )
}
