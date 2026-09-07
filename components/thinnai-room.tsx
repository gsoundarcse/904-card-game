'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { CLAIM_STEP, MAX_CLAIM, SUIT_SYMBOL, SUITS, type Suit, teamLabel, teamOf, defendingTarget } from '@/lib/game'
import type { Action, PlayerView } from '@/lib/server/rooms'
import { type Credentials, useThinnai } from '@/lib/client/use-thinnai'
import { GameTable, type SeatView } from '@/components/game-table'
import { CardBack, CardFace, ClickableCard } from '@/components/playing-card'
import { StrongSupport } from '@/components/strong-support'

export function ThinnaiRoom({ roomId, creds }: { roomId: string; creds: Credentials }) {
  const { view, error, pending, send, clearError } = useThinnai(roomId, creds)

  if (!view) {
    return (
      <main className="flex min-h-svh items-center justify-center px-4">
        <p className="font-serif text-lg italic text-muted-foreground">Joining {roomId}…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <MatchHeader view={view} />

      {error && (
        <button
          type="button"
          onClick={clearError}
          className="rounded-xl border border-destructive/60 bg-destructive/10 px-4 py-2 text-left text-sm text-destructive"
        >
          {error} — tap to dismiss
        </button>
      )}

      {view.status === 'lobby' ? (
        <Lobby view={view} send={send} pending={pending} />
      ) : (
        <Table view={view} send={send} pending={pending} />
      )}
    </main>
  )
}

// ---------------------------------------------------------------------------

function MatchHeader({ view }: { view: PlayerView }) {
  const { match, round, seatCount } = view
  const claimTarget = round.claim
  const claimerTeam = round.claimer === null ? null : teamOf(round.claimer)
  const totalPoints = seatCount >= 6 ? 904 : 884
  return (
    <div className="flex flex-wrap items-stretch justify-between gap-3">
      <div className="flex items-center gap-3">
        {([0, 1] as const).map((t) => (
          <div
            key={t}
            className={cn(
              'flex min-w-32 flex-col rounded-xl border px-4 py-2',
              t === 0 ? 'border-team-a/50 bg-team-a/10' : 'border-team-b/50 bg-team-b/10',
            )}
          >
            <span className={cn('text-[10px] font-semibold uppercase tracking-widest', t === 0 ? 'text-team-a' : 'text-team-b')}>
              {teamLabel(t, seatCount)}
            </span>
            <span className="font-serif text-3xl font-bold leading-none text-foreground">
              {round.teamScores[t]}<span className="ml-1 font-mono text-xs font-normal text-muted-foreground">/ {claimTarget || '—'}</span>
            </span>
            <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              {claimTarget
                ? `${Math.max(0, (t === claimerTeam ? claimTarget : defendingTarget(totalPoints, claimTarget)) - round.teamScores[t])} needed`
                : 'claim pending'}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
        <div className="flex flex-col items-end">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Thinnai</span>
          <span className="font-mono text-sm font-semibold text-gold">{view.roomId}</span>
        </div>
        <div className="flex flex-col items-end border-l border-border pl-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Round</span>
          <span className="text-sm font-semibold text-foreground">{view.match.roundNumber}</span>
        </div>
        <div className="flex flex-col items-end border-l border-border pl-3">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Trump</span>
          <span className="text-sm font-semibold text-foreground">
            {!view.round.trumpSuit ? (
              view.round.claimer === null ? '—' : <span className="text-gold">Hidden ?</span>
            ) : (
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  (view.round.trumpSuit === 'Hearts' || view.round.trumpSuit === 'Diamonds') && 'text-suit-red',
                )}
              >
                {SUIT_SYMBOL[view.round.trumpSuit]} {view.round.trumpSuit}
                {!view.round.trumpRevealed && <span className="ml-1 text-[10px] text-muted-foreground">(yours alone)</span>}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Lobby({
  view,
  send,
  pending,
}: {
  view: PlayerView
  send: (a: Action) => void
  pending: boolean
}) {
  const [copied, setCopied] = useState(false)
  const joinUrl = typeof window === 'undefined' ? '' : `${window.location.origin}/thinnai/${view.roomId}`
  const waiting = view.seatCount - view.players.length

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  return (
    <section className="rounded-2xl border border-border bg-secondary/50 p-6">
      <h2 className="font-serif text-2xl font-bold text-gold-soft">Waiting on the thinnai</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {waiting > 0
          ? `${waiting} more ${waiting === 1 ? 'player' : 'players'} to sit down. Send them the link.`
          : 'Everyone is here.'}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <code className="flex-1 overflow-x-auto rounded-xl border border-border bg-background/60 px-4 py-3 font-mono text-xs text-foreground">
          {joinUrl}
        </code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(joinUrl).then(() => setCopied(true)).catch(() => setCopied(false))
          }}
          className="rounded-xl border border-gold/50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gold hover:bg-gold/10"
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>

      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {Array.from({ length: view.seatCount }).map((_, seat) => {
          const p = view.players.find((x) => x.seat === seat)
          return (
            <li
              key={seat}
              className={cn(
                'flex items-center justify-between rounded-xl border px-4 py-3',
                p ? 'border-border bg-background/40' : 'border-dashed border-border/60',
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', teamOf(seat) === 0 ? 'bg-team-a' : 'bg-team-b')} aria-hidden />
                <span className={cn('text-sm', p ? 'font-semibold text-foreground' : 'italic text-muted-foreground')}>
                  {p ? p.name : 'empty seat'}
                </span>
                {p && seat === view.yourSeat && (
                  <span className="rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">you</span>
                )}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">P{seat + 1}</span>
            </li>
          )
        })}
      </ul>

      <p className="mt-4 font-mono text-[11px] text-muted-foreground">
        Seats alternate between teams — {teamLabel(0, view.seatCount)} against {teamLabel(1, view.seatCount)}.
      </p>

      {view.youAreHost ? (
        <button
          type="button"
          onClick={() => send({ type: 'start' })}
          disabled={pending || waiting > 0}
          className="mt-5 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-40"
        >
          {waiting > 0 ? `Waiting for ${waiting} more` : 'Deal the cards'}
        </button>
      ) : (
        <p className="mt-5 text-center font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          The host deals when everyone is seated
        </p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------

function Table({
  view,
  send,
  pending,
}: {
  view: PlayerView
  send: (a: Action) => void
  pending: boolean
}) {
  const r = view.round
  const yourTurn = r.current === view.yourSeat
  const playable = useMemo(() => new Set(view.playableIds), [view.playableIds])

  const seats: SeatView[] = view.players.map((p) => {
    let status: string | undefined
    if (view.status === 'bidding') {
      if (r.passed[p.seat]) status = 'Passed'
      else if (r.bids[p.seat] != null) status = `Bid ${r.bids[p.seat]}`
      else if (p.seat === r.current) status = 'Deciding'
      else status = 'Waiting'
    } else if (view.status === 'playing' && p.seat === r.current) {
      status = 'Turn'
    } else if (!p.connected) {
      status = 'Away'
    }
    return {
      name: p.seat === view.yourSeat ? `${p.name} (you)` : p.name,
      team: p.team,
      handCount: p.handCount,
      isCurrent: p.seat === r.current && (view.status === 'bidding' || view.status === 'playing'),
      isClaimer: r.claimer === p.seat,
      isShuffler: r.dealer === p.seat,
      status,
    }
  })

  const trickToShow = r.trick.length > 0 ? r.trick : (r.lastTrick?.plays ?? [])
  const banner =
    r.lastTrick && r.trick.length === 0
      ? `${view.players.find((p) => p.seat === r.lastTrick!.winner)?.name ?? 'Someone'} takes it +${r.lastTrick.points}`
      : null

  return (
    <>
      <GameTable
        seats={seats}
        trick={trickToShow}
        trumpSuit={r.trumpSuit}
        trumpCard={r.trumpCard}
        trumpRevealed={r.trumpRevealed}
        trumpPlaced={view.trumpFaceDown || r.trumpRevealed}
        completedTrick={r.trick.length === 0 && r.lastTrick !== null}
        banner={banner}
      />

      <section className="rounded-2xl border border-border bg-secondary/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-bold text-gold-soft">
            {yourTurn ? 'Your turn' : `Waiting on ${view.players.find((p) => p.seat === r.current)?.name ?? '…'}`}
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            {teamLabel(teamOf(view.yourSeat), view.seatCount)} · trick {Math.min(r.trickNumber + 1, 6)} of 6
          </span>
        </div>

        <div className="mobile-hand-tray flex min-h-36 items-end justify-center overflow-visible pb-2 px-1 sm:px-3">
          <div className="grid w-full grid-cols-6 items-end gap-1 sm:gap-3">
          {view.yourHand.length ? (
            view.yourHand.map((card) =>
              view.status === 'playing' ? (
                <ClickableCard
                  key={card.id}
                  card={card}
                  size="md"
                  mobileSize="sm"
                  mobileGrid
                  fan={false}
                  disabled={pending || !yourTurn || !playable.has(card.id)}
                  onClick={() => send({ type: 'playCard', cardId: card.id })}
                />
              ) : (
                <div key={card.id} className="flex w-full justify-center">
                  <CardFace card={card} size="md" className="sm:h-32 sm:w-24 sm:text-sm" />
                </div>
              ),
            )
          ) : (
            <span className="font-serif italic text-muted-foreground">No cards left</span>
          )}

          {view.yourTrumpCard && (
            <div className="ml-4 flex shrink-0 flex-col items-center gap-1 border-l border-border pl-4">
              <div className="relative">
                <CardBack size="md" className="opacity-70 sm:h-32 sm:w-24" />
                <span className="absolute inset-0 flex items-center justify-center font-mono text-[9px] uppercase tracking-widest text-gold">
                  face down
                </span>
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">
                {view.yourTrumpCard.rank}
                {SUIT_SYMBOL[view.yourTrumpCard.suit]} · locked
              </span>
            </div>
          )}
          </div>
        </div>

        {view.status === 'bidding' && yourTurn && <BidControls view={view} send={send} pending={pending} />}

        {view.status === 'playing' && yourTurn && (
          <PlayControls view={view} send={send} pending={pending} playable={playable} />
        )}
        {view.status === 'playing' && (
          <div className="mt-3 flex justify-center">
            <StrongSupport
              revealed={r.trumpRevealed}
              eligible={
                r.claimer !== null &&
                view.yourSeat !== r.claimer &&
                teamOf(view.yourSeat) === teamOf(r.claimer)
              }
            />
          </div>
        )}
      </section>

      {view.status === 'trump' && r.claimer === view.yourSeat && <TrumpPicker view={view} send={send} />}
      {view.status === 'trump' && r.claimer !== view.yourSeat && (
        <Waiting>
          {view.players.find((p) => p.seat === r.claimer)?.name} won the claim at {r.claim} and is choosing trump.
        </Waiting>
      )}

      {(view.status === 'roundOver' || view.status === 'matchOver') && (
        <RoundSummary view={view} send={send} pending={pending} />
      )}
    </>
  )
}

function Waiting({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-border bg-secondary/30 px-4 py-4 text-center font-serif italic text-muted-foreground">
      {children}
    </p>
  )
}

function BidControls({
  view,
  send,
  pending,
}: {
  view: PlayerView
  send: (a: Action) => void
  pending: boolean
}) {
  const [amount, setAmount] = useState(view.minBid)
  useEffect(() => setAmount(view.minBid), [view.minBid])

  const canBid = view.minBid <= MAX_CLAIM && Number.isInteger(amount) && amount % CLAIM_STEP === 0 && amount >= view.minBid
  const bidError = canBid
    ? null
    : amount > MAX_CLAIM
      ? `Maximum claim is ${MAX_CLAIM}.`
      : amount < view.minBid
        ? `Claim must be at least ${view.minBid}.`
        : `Claim must be a whole number in steps of ${CLAIM_STEP}.`

  return (
    <div className="mobile-bid-controls sticky bottom-2 z-30 mt-3 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-border bg-secondary/95 px-2 pb-2 pt-3 shadow-xl backdrop-blur md:static md:rounded-none md:border-0 md:bg-transparent md:px-0 md:pb-0 md:shadow-none md:backdrop-blur-0">
      <div className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-2 py-1">
        <button
          type="button"
          onClick={() => setAmount((v) => Math.max(view.minBid, v - CLAIM_STEP))}
          disabled={amount <= view.minBid}
          className="h-8 w-8 rounded-lg bg-secondary text-lg font-bold text-foreground disabled:opacity-30"
          aria-label="Decrease bid"
        >
          &minus;
        </button>
        <input
          type="number"
          min={view.minBid}
          max={MAX_CLAIM}
          step={CLAIM_STEP}
          value={amount}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '').slice(0, 3)
            setAmount(digits ? Number(digits) : view.minBid)
          }}
          className={cn(
            'w-20 bg-transparent text-center font-serif text-2xl font-bold outline-none',
            canBid ? 'text-gold-soft' : 'text-destructive',
          )}
          aria-invalid={!canBid}
          aria-label="Claim amount"
        />
        <button
          type="button"
          onClick={() => setAmount((v) => Math.min(MAX_CLAIM, v + CLAIM_STEP))}
          disabled={amount >= MAX_CLAIM}
          className="h-8 w-8 rounded-lg bg-secondary text-lg font-bold text-foreground disabled:opacity-30"
          aria-label="Increase bid"
        >
          +
        </button>
      </div>
      <button
        type="button"
        onClick={() => send({ type: 'bid', amount })}
        disabled={pending || !canBid}
        className="rounded-xl bg-gold px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-40"
      >
        Claim {amount}
      </button>
      <button
        type="button"
        onClick={() => send({ type: 'pass' })}
        disabled={pending || view.mustClaim}
        className="rounded-xl border border-border px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-30"
      >
        Pass
      </button>
      <p className="w-full text-center font-mono text-[11px] text-muted-foreground">
        {view.mustClaim
          ? 'Last to act and no bid on the table — you must claim.'
          : `One round of bidding. Minimum ${view.minBid}, maximum ${MAX_CLAIM}.`}
      </p>
      {!canBid && <p className="w-full text-center font-mono text-[11px] text-destructive">{bidError}</p>}
    </div>
  )
}

function PlayControls({
  view,
  send,
  pending,
  playable,
}: {
  view: PlayerView
  send: (a: Action) => void
  pending: boolean
  playable: Set<string>
}) {
  const [armed, setArmed] = useState(false)
  const lastCard = view.yourHand.length === 1 ? view.yourHand[0] : null

  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-3 border-t border-border pt-3">
      {view.canAskTrump && (
        <button
          type="button"
          onClick={() => send({ type: 'askTrump' })}
          disabled={pending}
          className="relative z-20 cursor-pointer rounded-xl border border-gold/60 bg-gold/10 px-6 py-2.5 text-xs font-bold uppercase tracking-wide text-gold hover:bg-gold/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ask for trump
        </button>
      )}
      {view.canCallDouble && lastCard && (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (!armed) {
                setArmed(true)
                return
              }
              send({ type: 'playCard', cardId: lastCard.id, double: true })
            }}
            disabled={pending || !playable.has(lastCard.id)}
            className={cn(
              'rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-40',
              armed
                ? 'bg-destructive text-destructive-foreground'
                : 'border border-destructive/60 bg-destructive/10 text-destructive hover:bg-destructive/20',
            )}
          >
            {armed ? `Confirm — play ${lastCard.rank}${SUIT_SYMBOL[lastCard.suit]} as double` : 'Call double'}
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            {armed ? 'Tap again to commit' : 'Only after your team takes the first five tricks'}
          </span>
        </div>
      )}

      <p className="w-full text-center font-mono text-[11px] text-muted-foreground">
        {view.round.trick.length === 0
          ? 'Lead any card'
          : view.canAskTrump
            ? 'Void in the led suit — play anything, or ask for trump'
            : playable.size < view.yourHand.length
              ? 'You must follow the led suit'
              : 'Play anything'}
      </p>
    </div>
  )
}

function TrumpPicker({ view, send }: { view: PlayerView; send: (a: Action) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92svh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-gold/50 bg-popover p-6 text-center shadow-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold">You won the claim</p>
        <h2 className="mt-2 font-serif text-3xl font-bold text-gold-soft">Set your trump card</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Target <span className="font-semibold text-gold">{view.round.claim}</span>. Choose one card to lay face down.
          Its suit becomes trump — and you cannot play that card until trump is asked for.
        </p>

        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="mt-6 w-full rounded-xl border border-gold/50 bg-felt-dark px-4 py-6 font-serif text-xl font-bold text-gold hover:bg-felt"
          >
            Show my hand
          </button>
        ) : (
          <>
            <div className="mt-5 rounded-xl border border-border bg-background/40 p-3">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Tap a card to lay it face down
              </p>
              <div className="grid grid-cols-2 justify-items-center gap-3 pb-1 sm:grid-cols-3">
                {view.yourHand.map((card) => (
                  <ClickableCard
                    key={card.id}
                    card={card}
                    size="md"
                    fan={false}
                    onClick={() => send({ type: 'selectTrump', cardId: card.id })}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function RoundSummary({
  view,
  send,
  pending,
}: {
  view: PlayerView
  send: (a: Action) => void
  pending: boolean
}) {
  const s = view.round.settlement
  if (!s) return null
  const matchOver = view.status === 'matchOver'
  const youArePenalised = teamOf(view.yourSeat) === s.penalisedTeam

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="max-h-[92svh] w-full max-w-md overflow-y-auto rounded-2xl border-2 border-gold/50 bg-popover p-8 text-center shadow-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold">
          {matchOver ? 'Match over' : `Round ${view.match.roundNumber}`}
        </p>
        <h2
          className={cn(
            'mt-2 font-serif text-4xl font-bold',
            matchOver ? 'text-destructive' : s.success ? 'text-gold-soft' : 'text-destructive',
          )}
        >
          {matchOver
            ? `${teamLabel(view.match.loser ?? 0, view.seatCount)} loses`
            : s.success
              ? 'Claim made'
              : 'Claim failed'}
        </h2>

        <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
          {s.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>

        <p className={cn('mt-4 font-serif text-lg font-bold', youArePenalised ? 'text-destructive' : 'text-gold')}>
          {s.cards} card{s.cards === 1 ? '' : 's'} to {teamLabel(s.penalisedTeam, view.seatCount)}
        </p>

        <div className="mt-5 flex justify-center gap-4">
          {([0, 1] as const).map((t) => (
            <div key={t} className="flex flex-col">
              <span className={cn('text-[10px] font-semibold uppercase tracking-widest', t === 0 ? 'text-team-a' : 'text-team-b')}>
                {teamLabel(t, view.seatCount)}
              </span>
              <span className="font-serif text-3xl font-bold text-foreground">
                {view.match.teamCards[t]}
                <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">/ {view.match.cardLimit}</span>
              </span>
            </div>
          ))}
        </div>

        {matchOver ? (
          <a
            href="/thinnai"
            className="mt-6 block w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground"
          >
            Open a new thinnai
          </a>
        ) : view.youAreHost ? (
          <button
            type="button"
            onClick={() => send({ type: 'nextRound' })}
            disabled={pending}
            className="mt-6 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-40"
          >
            Deal the next round
          </button>
        ) : (
          <p className="mt-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Waiting for the host to deal
          </p>
        )}
      </div>
    </div>
  )
}
