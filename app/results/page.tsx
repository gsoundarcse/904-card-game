import Link from 'next/link'
import { teamLabel } from '@/lib/game'
import { getLeaderboard, getRecentMatches, getTotalMatchesPlayed } from '@/lib/server/match-history'
import { metricsSnapshot } from '@/lib/server/telemetry'
import { cn } from '@/lib/utils'

export default async function ResultsPage() {
  const leaderboard = getLeaderboard()
  const matches = getRecentMatches()
  const totalGamesPlayed = getTotalMatchesPlayed()
  const metrics = metricsSnapshot()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-10 px-4 py-12">
      <Link
        href="/"
        className="self-start rounded-xl border border-border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:border-gold hover:text-gold"
      >
        ← Home
      </Link>
      <header className="text-center">
        <p className="mb-2 font-mono text-xs uppercase tracking-[0.35em] text-gold">Thinnai</p>
        <h1 className="font-serif text-5xl font-bold tracking-tight text-gold-soft">Results</h1>
      </header>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Server metrics</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Games played', value: totalGamesPlayed },
            { label: 'Rooms created', value: metrics.roomsCreated },
            { label: 'Rounds completed', value: metrics.roundsCompleted },
            { label: 'Actions rejected', value: metrics.actionsRejected },
            { label: 'Client crashes', value: metrics.clientErrors },
            { label: 'Server errors', value: metrics.serverErrors },
            { label: 'Uptime (min)', value: Math.floor(metrics.uptimeSeconds / 60) },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border bg-secondary/30 p-4 text-center">
              <p className="font-serif text-2xl font-bold text-gold-soft">{stat.value}</p>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          Counters other than games played reset when the server restarts (process-local telemetry).
        </p>

        {(metrics.recentClientErrors.length > 0 || metrics.recentServerErrors.length > 0) && (
          <div className="mt-4 flex flex-col gap-3">
            {metrics.recentClientErrors.length > 0 && (
              <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Recent client crashes
                </p>
                <ul className="flex flex-col gap-1 text-sm">
                  {metrics.recentClientErrors.map((e, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-mono text-[10px]">{new Date(e.at).toLocaleString()}</span> — {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {metrics.recentServerErrors.length > 0 && (
              <div className="rounded-2xl border border-border bg-secondary/30 p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Recent server errors
                </p>
                <ul className="flex flex-col gap-1 text-sm">
                  {metrics.recentServerErrors.map((e, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-mono text-[10px]">{new Date(e.at).toLocaleString()}</span> — {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Leaderboard</h2>
        <div className="overflow-hidden rounded-2xl border border-border">
          {leaderboard.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No completed matches yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-left font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3 text-right">Games</th>
                  <th className="px-4 py-3 text-right">Wins</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr key={entry.key} className="border-t border-border">
                    <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{entry.name}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{entry.gamesPlayed}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gold-soft">{entry.wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Recent matches</h2>
        <div className="flex flex-col gap-3">
          {matches.length === 0 && <p className="text-center text-sm text-muted-foreground">No completed matches yet.</p>}
          {matches.map((match) => (
            <div key={match.id} className="rounded-2xl border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                <span>{new Date(match.endedAt).toLocaleString()}</span>
                <span>Claim {match.finalClaim}</span>
              </div>
              <p className="mt-2 text-sm font-semibold text-gold-soft">
                {teamLabel(match.winningTeam, match.seatCount)} won
              </p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {match.players.map((p) => (
                  <li
                    key={p.seat}
                    className={cn('font-medium', p.won ? 'text-foreground' : 'text-muted-foreground line-through')}
                  >
                    {p.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <Link href="/thinnai" className="text-center font-mono text-[11px] text-muted-foreground hover:text-gold">
        Back to Thinnai
      </Link>
    </main>
  )
}
