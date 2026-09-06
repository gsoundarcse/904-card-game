'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  buildDeck,
  CARDS_PER_PLAYER,
  CLAIM_STEP,
  type Card,
  evaluateTrick,
  getPlayable,
  MAX_CLAIM,
  MIN_CLAIM,
  shuffle,
  sortHand,
  SUIT_SYMBOL,
  SUITS,
  type Suit,
  teamOf,
  TEAM_NAME,
  type TrickPlay,
  trickPoints,
} from '@/lib/game'
import { ConfigMenu } from '@/components/config-menu'
import { Scoreboard } from '@/components/scoreboard'
import { GameTable, type SeatView } from '@/components/game-table'
import { CardFace, ClickableCard } from '@/components/playing-card'

type Phase = 'config' | 'bidding' | 'trump' | 'playing' | 'roundOver'

interface Player {
  name: string
  hand: Card[]
}

const PHASE_LABEL: Record<Phase, string> = {
  config: 'Setup',
  bidding: 'Bidding',
  trump: 'Trump Select',
  playing: 'Playing',
  roundOver: 'Round Over',
}

export function CardGame() {
  const [phase, setPhase] = useState<Phase>('config')
  const [players, setPlayers] = useState<Player[]>([])
  const [shuffler, setShuffler] = useState(0)
  const [current, setCurrent] = useState(0)

  // bidding
  const [passed, setPassed] = useState<boolean[]>([])
  const [highBid, setHighBid] = useState(0)
  const [highBidder, setHighBidder] = useState<number | null>(null)
  const [pendingBid, setPendingBid] = useState(MIN_CLAIM)

  // claim / trump
  const [claimer, setClaimer] = useState<number | null>(null)
  const [claim, setClaim] = useState(0)
  const [trumpSuit, setTrumpSuit] = useState<Suit | null>(null)
  const [trumpRevealed, setTrumpRevealed] = useState(false)
  const [trumpHidden, setTrumpHidden] = useState(false) // claimer temporarily peeking

  // play
  const [trick, setTrick] = useState<TrickPlay[]>([])
  const [trickNumber, setTrickNumber] = useState(0)
  const [teamScores, setTeamScores] = useState<[number, number]>([0, 0])
  const [banner, setBanner] = useState<string | null>(null)
  const [resolving, setResolving] = useState(false)

  const n = players.length
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setTempBanner = useCallback((msg: string, ms = 1700) => {
    setBanner(msg)
    if (bannerTimer.current) clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), ms)
  }, [])

  const startGame = useCallback((count: number) => {
    const deck = shuffle(buildDeck(count))
    const dealt: Player[] = Array.from({ length: count }, (_, i) => ({
      name: `Player ${i + 1}`,
      hand: sortHand(deck.slice(i * CARDS_PER_PLAYER, i * CARDS_PER_PLAYER + CARDS_PER_PLAYER)),
    }))
    const deal = Math.floor(Math.random() * count)
    setPlayers(dealt)
    setShuffler(deal)
    setCurrent((deal + 1) % count)
    setPassed(Array(count).fill(false))
    setHighBid(0)
    setHighBidder(null)
    setPendingBid(MIN_CLAIM)
    setClaimer(null)
    setClaim(0)
    setTrumpSuit(null)
    setTrumpRevealed(false)
    setTrumpHidden(false)
    setTrick([])
    setTrickNumber(0)
    setTeamScores([0, 0])
    setBanner(null)
    setResolving(false)
    setPhase('bidding')
  }, [])

  const resetToConfig = useCallback(() => setPhase('config'), [])

  // Keep pending bid at the minimum legal amount when the active bidder changes.
  useEffect(() => {
    if (phase !== 'bidding') return
    setPendingBid(Math.min(MAX_CLAIM, highBid > 0 ? highBid + CLAIM_STEP : MIN_CLAIM))
  }, [phase, current, highBid])

  const nextActiveBidder = useCallback(
    (from: number, passedState: boolean[]) => {
      let i = from
      for (let step = 0; step < passedState.length; step++) {
        i = (i + 1) % passedState.length
        if (!passedState[i]) return i
      }
      return from
    },
    [],
  )

  const finalizeClaimer = useCallback((seat: number, amount: number) => {
    setClaimer(seat)
    setClaim(amount)
    setPhase('trump')
  }, [])

  const handlePass = useCallback(() => {
    if (phase !== 'bidding') return
    const newPassed = [...passed]
    newPassed[current] = true
    const remaining = newPassed.map((p, i) => (!p ? i : -1)).filter((i) => i >= 0)

    if (remaining.length === 1 && highBidder !== null) {
      setPassed(newPassed)
      finalizeClaimer(remaining[0], highBid)
      return
    }
    setPassed(newPassed)
    if (remaining.length === 1) {
      // Only one bidder left but no claim yet: they must claim next.
      setCurrent(remaining[0])
    } else {
      setCurrent(nextActiveBidder(current, newPassed))
    }
  }, [phase, passed, current, highBidder, highBid, finalizeClaimer, nextActiveBidder])

  const handleClaim = useCallback(
    (amount: number) => {
      if (phase !== 'bidding') return
      setHighBid(amount)
      setHighBidder(current)
      const remaining = passed.map((p, i) => (!p ? i : -1)).filter((i) => i >= 0)
      if (remaining.length === 1) {
        finalizeClaimer(current, amount)
        return
      }
      setCurrent(nextActiveBidder(current, passed))
    },
    [phase, current, passed, finalizeClaimer, nextActiveBidder],
  )

  const handleSelectTrump = useCallback((suit: Suit) => {
    setTrumpSuit(suit)
    setTrumpHidden(false)
    setTrumpRevealed(false)
    setTrick([])
    setTrickNumber(0)
    setPhase('playing')
  }, [])

  // When entering play, set the leader = player to the left of the claimer.
  useEffect(() => {
    if (phase === 'playing' && claimer !== null && trickNumber === 0 && trick.length === 0) {
      setCurrent((claimer + 1) % n)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // Reveal the hidden trump the moment the active player is void in the led suit.
  useEffect(() => {
    if (phase !== 'playing' || resolving || trumpRevealed) return
    if (trick.length === 0 || !players[current]) return
    const ledSuit = trick[0].card.suit
    const hasLed = players[current].hand.some((c) => c.suit === ledSuit)
    if (!hasLed) {
      setTrumpRevealed(true)
      setTempBanner('Trump Suit Revealed!')
    }
  }, [phase, current, trick, trumpRevealed, resolving, players, setTempBanner])

  const playable = useMemo(() => {
    if (phase !== 'playing' || !players[current]) return null
    return getPlayable(players[current].hand, trick, trumpSuit, trumpRevealed)
  }, [phase, players, current, trick, trumpSuit, trumpRevealed])

  const resolveTrick = useCallback(
    (finalTrick: TrickPlay[]) => {
      const winner = evaluateTrick(finalTrick, trumpSuit, trumpRevealed)
      const pts = trickPoints(finalTrick)
      setTeamScores((prev) => {
        const next: [number, number] = [prev[0], prev[1]]
        next[teamOf(winner)] += pts
        return next
      })
      const completed = trickNumber + 1
      setTrickNumber(completed)
      setTempBanner(`${players[winner].name} takes the trick +${pts}`, 1600)
      setTrick([])
      setCurrent(winner)
      setResolving(false)
      if (completed >= CARDS_PER_PLAYER) setPhase('roundOver')
    },
    [trumpSuit, trumpRevealed, trickNumber, players, setTempBanner],
  )

  const handlePlayCard = useCallback(
    (cardId: string) => {
      if (phase !== 'playing' || resolving || !playable) return
      if (!playable.playableIds.has(cardId)) return
      const hand = players[current].hand
      const card = hand.find((c) => c.id === cardId)
      if (!card) return

      setPlayers((prev) =>
        prev.map((p, i) => (i === current ? { ...p, hand: p.hand.filter((c) => c.id !== cardId) } : p)),
      )
      const newTrick = [...trick, { player: current, card }]
      setTrick(newTrick)

      if (newTrick.length === n) {
        setResolving(true)
        setTimeout(() => resolveTrick(newTrick), 1300)
      } else {
        setCurrent((current + 1) % n)
      }
    },
    [phase, resolving, playable, players, current, trick, n, resolveTrick],
  )

  useEffect(() => () => { if (bannerTimer.current) clearTimeout(bannerTimer.current) }, [])

  // ---- derived view models ----
  const claimerTeam = claimer !== null ? teamOf(claimer) : null

  const seats: SeatView[] = useMemo(
    () =>
      players.map((p, i) => {
        let status: string | undefined
        if (phase === 'bidding') {
          if (passed[i]) status = 'Passed'
          else if (highBidder === i) status = `Bid ${highBid}`
          else if (i === current) status = 'Deciding'
          else status = 'In'
        } else if (phase === 'playing' && i === current && !resolving) {
          status = 'Turn'
        }
        return {
          name: p.name,
          team: teamOf(i),
          handCount: p.hand.length,
          isCurrent: (phase === 'bidding' || phase === 'playing') && i === current && !resolving,
          isClaimer: claimer === i,
          isShuffler: shuffler === i,
          status,
        }
      }),
    [players, phase, passed, highBidder, highBid, current, resolving, claimer, shuffler],
  )

  if (phase === 'config') {
    return (
      <main className="min-h-svh bg-background">
        <ConfigMenu onStart={startGame} />
      </main>
    )
  }

  const activePlayer = players[current]
  const minAllowed = Math.min(MAX_CLAIM, highBid > 0 ? highBid + CLAIM_STEP : MIN_CLAIM)
  const canClaim = minAllowed <= MAX_CLAIM
  const remainingBidders = passed.filter((p) => !p).length
  const mustClaim = phase === 'bidding' && remainingBidders === 1 && highBidder === null

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col gap-4 px-3 py-4 sm:px-6 sm:py-6">
      <Scoreboard
        teamScores={teamScores}
        claimerName={claimer !== null ? players[claimer].name : null}
        claimerTeam={claimerTeam}
        claim={claim}
        trumpSuit={trumpSuit}
        trumpRevealed={trumpRevealed}
        phaseLabel={PHASE_LABEL[phase]}
        onReset={resetToConfig}
      />

      <GameTable seats={seats} trick={trick} trumpSuit={trumpSuit} trumpRevealed={trumpRevealed} banner={banner} />

      {/* Active player control tray */}
      <section className="rounded-2xl border border-border bg-secondary/50 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={cn('h-2.5 w-2.5 rounded-full', teamOf(current) === 0 ? 'bg-team-a' : 'bg-team-b')} aria-hidden />
            <h2 className="font-serif text-lg font-bold text-gold-soft">{activePlayer?.name}</h2>
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              {TEAM_NAME[teamOf(current)]}
            </span>
          </div>
          {playable && (
            <PlayHint reason={playable.reason} trumpRevealed={trumpRevealed} />
          )}
        </div>

        {/* Hand */}
        <div className="flex min-h-36 items-end justify-center overflow-x-auto pb-2 pl-3">
          {activePlayer?.hand.length ? (
            phase === 'playing' ? (
              activePlayer.hand.map((card) => (
                <ClickableCard
                  key={card.id}
                  card={card}
                  disabled={resolving || !playable?.playableIds.has(card.id)}
                  onClick={() => handlePlayCard(card.id)}
                />
              ))
            ) : (
              // Bidding / trump: hand is view-only but fully legible.
              activePlayer.hand.map((card) => (
                <div key={card.id} className="-ml-3 shrink-0 first:ml-0">
                  <CardFace card={card} size="lg" />
                </div>
              ))
            )
          ) : (
            <span className="font-serif italic text-muted-foreground">No cards left</span>
          )}
        </div>

        {/* Bidding controls */}
        {phase === 'bidding' && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 border-t border-border pt-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-background/40 px-2 py-1">
              <button
                type="button"
                onClick={() => setPendingBid((v) => Math.max(minAllowed, v - CLAIM_STEP))}
                disabled={pendingBid <= minAllowed}
                className="h-8 w-8 rounded-lg bg-secondary text-lg font-bold text-foreground disabled:opacity-30"
                aria-label="Decrease bid"
              >
                &minus;
              </button>
              <span className="w-16 text-center font-serif text-2xl font-bold text-gold-soft">{pendingBid}</span>
              <button
                type="button"
                onClick={() => setPendingBid((v) => Math.min(MAX_CLAIM, v + CLAIM_STEP))}
                disabled={pendingBid >= MAX_CLAIM}
                className="h-8 w-8 rounded-lg bg-secondary text-lg font-bold text-foreground disabled:opacity-30"
                aria-label="Increase bid"
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => handleClaim(pendingBid)}
              disabled={!canClaim}
              className="rounded-xl bg-gold px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-40"
            >
              Claim {pendingBid}
            </button>
            <button
              type="button"
              onClick={handlePass}
              disabled={mustClaim}
              className="rounded-xl border border-border px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground transition-colors hover:border-destructive hover:text-destructive disabled:opacity-30"
            >
              Pass
            </button>
            <p className="w-full text-center font-mono text-[11px] text-muted-foreground">
              {mustClaim
                ? 'You are the last bidder — you must claim.'
                : highBid > 0
                  ? `High bid ${highBid} by ${players[highBidder as number].name}. Counter must be +${CLAIM_STEP} or more.`
                  : `Opening claim starts at ${MIN_CLAIM}. Max ${MAX_CLAIM}.`}
            </p>
          </div>
        )}
      </section>

      {phase === 'trump' && claimer !== null && (
        <TrumpModal
          claimerName={players[claimer].name}
          claim={claim}
          hidden={trumpHidden}
          onPeek={() => setTrumpHidden((h) => !h)}
          onSelect={handleSelectTrump}
        />
      )}

      {phase === 'roundOver' && claimerTeam !== null && (
        <RoundOver
          claimerName={claimer !== null ? players[claimer].name : ''}
          claimerTeam={claimerTeam}
          claim={claim}
          captured={teamScores[claimerTeam]}
          teamScores={teamScores}
          onPlayAgain={resetToConfig}
        />
      )}
    </main>
  )
}

function PlayHint({
  reason,
  trumpRevealed,
}: {
  reason: 'lead' | 'follow' | 'forced-trump' | 'free-discard'
  trumpRevealed: boolean
}) {
  const map: Record<typeof reason, string> = {
    lead: 'Lead any card',
    follow: 'You must follow the led suit',
    'forced-trump': 'Void in suit — you must play trump',
    'free-discard': trumpRevealed ? 'No trump — discard anything' : 'Void in suit — discard anything',
  }
  return (
    <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-mono text-[11px] text-gold">
      {map[reason]}
    </span>
  )
}

function TrumpModal({
  claimerName,
  claim,
  hidden,
  onPeek,
  onSelect,
}: {
  claimerName: string
  claim: number
  hidden: boolean
  onPeek: () => void
  onSelect: (suit: Suit) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border-2 border-gold/50 bg-popover p-6 text-center shadow-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold">Secure Prompt</p>
        <h2 className="mt-2 font-serif text-3xl font-bold text-gold-soft">{claimerName} is the Claimer</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Target goal <span className="font-semibold text-gold">{claim}</span>. Choose a hidden trump suit — the others
          will only see a mystery card.
        </p>

        {!hidden ? (
          <button
            type="button"
            onClick={onPeek}
            className="mt-6 w-full rounded-xl border border-gold/50 bg-felt-dark px-4 py-6 font-serif text-xl font-bold text-gold transition-colors hover:bg-felt"
          >
            Tap to open (make sure others look away)
          </button>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {SUITS.map((suit) => {
              const red = suit === 'Hearts' || suit === 'Diamonds'
              return (
                <button
                  key={suit}
                  type="button"
                  onClick={() => onSelect(suit)}
                  className={cn(
                    'flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-5 text-2xl font-bold text-card-foreground transition-all hover:-translate-y-0.5 hover:border-gold hover:ring-2 hover:ring-gold',
                    red && 'text-suit-red',
                  )}
                >
                  <span>{SUIT_SYMBOL[suit]}</span>
                  <span className="text-base">{suit}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function RoundOver({
  claimerName,
  claimerTeam,
  claim,
  captured,
  teamScores,
  onPlayAgain,
}: {
  claimerName: string
  claimerTeam: 0 | 1
  claim: number
  captured: number
  teamScores: [number, number]
  onPlayAgain: () => void
}) {
  const success = captured >= claim
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border-2 border-gold/50 bg-popover p-8 text-center shadow-2xl">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-gold">Round Over</p>
        <h2 className={cn('mt-2 font-serif text-4xl font-bold', success ? 'text-gold-soft' : 'text-destructive')}>
          {success ? 'Claim Made!' : 'Claim Failed'}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {claimerName} ({TEAM_NAME[claimerTeam]}) claimed <span className="font-semibold text-gold">{claim}</span> and
          captured <span className={cn('font-semibold', success ? 'text-gold' : 'text-destructive')}>{captured}</span>.
        </p>
        <div className="mt-5 flex justify-center gap-4">
          {([0, 1] as const).map((t) => (
            <div key={t} className="flex flex-col">
              <span className={cn('text-[10px] font-semibold uppercase tracking-widest', t === 0 ? 'text-team-a' : 'text-team-b')}>
                {TEAM_NAME[t]}
              </span>
              <span className="font-serif text-3xl font-bold text-foreground">{teamScores[t]}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={onPlayAgain}
          className="mt-6 w-full rounded-xl bg-gold px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground transition-transform hover:-translate-y-0.5"
        >
          Play Again
        </button>
      </div>
    </div>
  )
}
