# Product Requirements

## Scope

Thinnai supports local pass-and-play, local solo play against 3 bots, and online
rooms. The home screen offers 904 as playable and Rani as disabled Coming soon.

Local setup supports 4 or 6 seats and named players. Solo mode uses one human and
three bots. Online rooms support 4 or 6 players joining by link.

## Core principles

- Server-authoritative online gameplay.
- Hidden hands and hidden trump are never leaked.
- Real selected cards are preserved and displayed; no fake placeholders.
- Every important rule has functional coverage.
- All layouts work on phones, tablets, and desktop.

## Deployment

A small friends trial may run on a long-lived Render/Railway/Node process. Permanent
multi-instance deployment requires Redis, such as an Upstash free tier database.
Run `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`, then `pnpm start`.
