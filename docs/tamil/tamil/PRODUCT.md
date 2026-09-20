# தயாரிப்பு தேவைகள்

## Scope

Thinnai இப்போது ஒரே ஒரு online experience. Home screen (`/`)-ல் 4 அல்லது 6 seat
table தேர்ந்தெடுத்து, பெயர் உள்ளிட்டு, மற்ற seats-க்கு Bot அல்லது "Invite a
person" தேர்வு செய்யலாம். Table create செய்தவுடன் எப்போதும் server-authoritative
online room (`/thinnai/[id]`) தான் திறக்கும் — தனி local pass-and-play அல்லது
offline solo mode இனி UI-ல் இல்லை. (பழைய local single-device engine
(`components/card-game.tsx` / `components/config-menu.tsx`) repo-வில் இருக்கிறது,
ஆனால் எந்த page-லிருந்தும் link செய்யப்படவில்லை.)

Bot seats தாங்களாகவே முழுமையாக விளையாடும்: bid போடுவது, trump தேர்வு செய்வது,
suit follow செய்வது, void ஆனால் trump கேட்பது, மற்றும் தகுதி இருக்கும்போது
double சொல்வது — இவை எல்லாம் ஒரு human seat செய்யும் rules-ஐ போலவே, ஒரு சிறிய
delay-உடன்.

## அடிப்படை கொள்கைகள்

- Online gameplay எப்போதும் server-authoritative. `lib/server/rooms.ts`-தான்
  single source of truth; clients `viewFor(room, playerId)`-ஐ render செய்து
  actions அனுப்பும்.
- Hidden hands மற்றும் reveal ஆகாத trump அதன் owner-க்கு தவிர வேறு யாருக்கும்
  அனுப்பப்படாது. Bots-க்கும் இதே visibility rules பொருந்தும்.
- உண்மையில் தேர்ந்தெடுக்கப்பட்ட card மட்டுமே காட்டப்படும்; fake placeholder
  இல்லை.
- முக்கியமான ஒவ்வொரு rule-க்கும் functional test உள்ளது (`tests/rooms.test.ts`,
  `tests/game.test.ts`).
- Phone, tablet, desktop அனைத்திலும் layout வேலை செய்யும்.

## Claim ladder மற்றும் solo claim

- Bidding ஒரே lap: minimum 500, 10-step ஆக, அதிகபட்சம் 900 வரை.
- Claim 900-லிருந்து நேரடியாக 904-க்கு குதிக்கலாம் — இது solo claim. Solo claim
  வெற்றி பெற்றால் trump முழுவதுமாக தவிர்க்கப்படும்: trump card கிடையாது,
  claimer-இன் partner அந்த round-ல் ஆடமாட்டார், claimer தனியாக இரண்டு
  opponents-க்கு எதிராக ஒவ்வொரு trick-ஐயும் விளையாடுவார்.

## Seats மற்றும் teams

- Seats-ன் parity-யே team-ஐ தீர்மானிக்கும்: 4 seat-ல் P1/P3 vs P2/P4; 6 seat-ல்
  P1/P3/P5 vs P2/P4/P6.
- Invite link-ஐ திறக்கும் எவரும், seat-ஐ (அதனால் team-ஐயும்) ஒரு live-updating
  seat picker-லிருந்து தாங்களாகவே தேர்ந்தெடுத்துவிட்டு தான் அமர்வார்கள் — seats
  join வரிசையில் auto-assign ஆகாது.
- Host dealing தொடங்கும் முன் lobby-லிருந்து "shuffle teams" செய்யலாம்: ஏற்கனவே
  அமர்ந்திருக்கும் human players-ஐ human seats-க்குள் random-ஆக மறு-அமர்த்தும்
  (bots seats மாறாது) — இது எல்லோரும் human ஆக இருக்கும் table-ஐ நியாயமாக இரண்டு
  பக்கமாக பிரிக்கும் வழி.

## Accounts, results, மற்றும் metrics

- Auth.js மூலம் optional accounts (username/password `Credentials` provider;
  Facebook wire செய்யப்பட்டுள்ளது ஆனால் default-ஆக off). Login இல்லாமலேயே
  guests விளையாடி match history-ல் தோன்றலாம்.
- `/results` public-ஆக உள்ளது. அதில் leaderboard, recent match history, மற்றும்
  server metrics panel இருக்கும்: total games played (SQLite-ல் durable-ஆக
  சேமிக்கப்பட்டது) மற்றும் rooms/rounds/actions-க்கான process-local counters
  + recent client/server error messages (இவை server restart ஆனால் reset
  ஆகிவிடும்).
- `/api/health` இதே metrics-ஐ JSON-ஆக தருகிறது, public deployment-க்கு
  `MONITORING_TOKEN` env var மூலம் optional-ஆக protect செய்யலாம்.

## Deployment

நண்பர்கள் trial-க்கு ஒரே long-lived Render/Railway/Node process போதும். Rooms
அந்த ஒரே process-இன் memory-ல் தான் இருக்கும், அதனால் multi-instance deploy-ல்
(உ.ம். Vercel) இது வேலை செய்யாது — in-memory room store-ஐ Redis-ஆக மாற்ற
வேண்டும். Accounts மற்றும் match history `node:sqlite` மூலம் local SQLite
file-ல் (`data/app.db`) சேமிக்கப்படும், rooms-லிருந்து தனியாக.

Ship செய்வதற்கு முன்: `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm build`, பிறகு
`pnpm start`.

