# UX, Privacy, Bots, and Tests

## Visual UX

Use the supplied reference direction: rectangular green board, distinct player stations,
compact clean card-back stacks with counts, center trick area, and active hand at bottom.
Do not let stations cover trump or played cards. Revealed trump gets a dedicated lane.

On mobile, including iPhone 15 Plus and smaller phones:

- Six active cards must fit or scroll safely without clipping first/last cards.
- Use compact cards on narrow widths and larger cards on desktop.
- No horizontal board overflow.
- Scoreboard wraps and shows captured / claim / points needed.
- Buttons remain tappable.
- Use one page scroll; do not create nested horizontal hand scrolling.
- In landscape, Claim and Pass controls must not cover the six-card hand.
- Claim and Pass remain visible on mobile without hiding cards.

Trump picker shows all six actual cards, no category-symbol panel, and takes two clicks.

## Bot privacy and strategy

Bot card faces are never shown to the local human. Bots use only legal cards. A bot
should beat an opponent when possible using the cheapest winning card, support a teammate
who is winning with the highest useful legal-point card without overtaking, and otherwise
discard conservatively. Bot actions have a short delay.

## Online privacy

`viewFor` may send own hand, public trick, counts, and revealed trump. It must not send
opponent hands, hidden trump, selected hidden card, or secrets. Client versions reject stale
poll responses.

## Functional tests

- 4/6 deck composition and six cards per player.
- Two-pass 3+3 dealing state.
- Named players and all-pass redeal.
- Minimum, step, and maximum 903 claim validation; 904 rejected.
- Real two-click trump selection and hidden-card legality.
- First lead immediately before claimer; winner leads next trick.
- Ask only when void; real selected card revealed and distinct from trick cards.
- Hand counts move 6 -> 5 -> 4; active cards remain visible.
- Double only after five-trick sweep.
- Surrender only while trump remains elsewhere; no score settlement.
- Bot win, teammate support, legal-card safety, and full random-round legality.
- Claimer needed points equal claim; defender needed points equal total - claim + 1.
- Verify 500 claim shows defender target 405 and 900 claim shows defender target 5.

## Monitoring acceptance

- `/api/health` reports uptime and room/action/round/error counters.
- `MONITORING_TOKEN` protects the health endpoint when configured.
- Server events are structured JSON and contain no hands, secrets, or hidden card ids.
- Client errors are sent to `/api/telemetry` without game secrets or card data.

## Release checks

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```
