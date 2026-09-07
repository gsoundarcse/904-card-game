# UX, Privacy, Bots மற்றும் Tests

## Visual UX

கொடுக்கப்பட்ட reference போல rectangular green board, தனித்த player stations, clean card-back
stacks மற்றும் counts, நடுவில் trick area, கீழே active hand வேண்டும். Player stations trump
அல்லது played cards-ஐ cover செய்யக்கூடாது. Revealed trump-க்கு தனி lane வேண்டும்.

Mobile-ல், குறிப்பாக iPhone 15 Plus மற்றும் சிறிய phones-ல்:

- 6 active cards fit ஆக வேண்டும் அல்லது first/last card clip இல்லாமல் safe scroll வேண்டும்.
- Narrow width-ல் compact cards; desktop-ல் பெரிய cards.
- Board horizontal overflow இல்லை.
- Scoreboard captured / claim / needed காட்ட வேண்டும்.
- Buttons finger-friendly ஆக இருக்க வேண்டும்.
- ஒரே page scroll பயன்படுத்த வேண்டும்; nested horizontal hand scroll வேண்டாம்.
- Landscape-ல் Claim மற்றும் Pass controls 6-card hand-ஐ cover செய்யக்கூடாது.
- Mobile-ல் Claim மற்றும் Pass தெரிந்தாலும் cards மறையக்கூடாது.

Trump picker-ல் 6 உண்மையான cards மட்டும்; category symbols வேண்டாம்; 2 clicks மட்டும்.

## Bot privacy மற்றும் strategy

Bot card faces மனிதருக்குக் காட்டக்கூடாது. Bots legal cards மட்டுமே பயன்படுத்த வேண்டும்.
Opponent-ஐ வெல்ல முடிந்தால் cheapest winning card, teammate winning என்றால் overtake செய்யாமல்
highest useful points card, இல்லையெனில் conservative discard. Bot action-க்கு சிறிய delay.

## Online privacy

`viewFor` own hand, public trick, counts, revealed trump மட்டும் அனுப்பலாம். Opponent hands,
hidden trump, hidden selected card, secrets leak ஆகக்கூடாது. Stale poll response newer state-ஐ
overwrite செய்யக்கூடாது.

## Functional tests

- 4/6 deck மற்றும் player-க்கு 6 cards.
- Two-pass 3+3 dealing.
- Named players மற்றும் all-pass redeal.
- Minimum, step, maximum 903 validation; 904 reject.
- Real two-click trump மற்றும் hidden-card legality.
- Claimer-க்கு முன் seat first lead; winner next lead.
- Void player-க்கு மட்டும் Ask; actual trump identity reveal.
- Hand count 6 -> 5 -> 4; active cards visible.
- First 5 trick sweep பிறகே Double.
- Trump elsewhere இருக்கும் போது மட்டும் surrender; score settlement இல்லை.
- Bot win, teammate support, legal card, full random round.
- Claimer needed = claim; defender needed = total - claim + 1.
- Claim 500-க்கு defender 405; claim 900-க்கு defender 5.

## Monitoring acceptance

- `/api/health` uptime, room/action/round/error counters தர வேண்டும்.
- `MONITORING_TOKEN` இருந்தால் health endpoint பாதுகாக்கப்பட வேண்டும்.
- Server logs structured JSON ஆகவும் hands, secrets, hidden card ids இல்லாமலும் இருக்க வேண்டும்.
- Client errors `/api/telemetry` மூலம் secrets/card data இல்லாமல் report ஆக வேண்டும்.

## Release checks

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm build
```
