# தயாரிப்பு தேவைகள்

## Scope

Thinnai-ல் local pass-and-play, ஒரு human + 3 bots solo mode, மற்றும் online rooms
இருக்கும். Home screen-ல் 904 playable; Rani disabled `Coming soon`.

Local setup-ல் 4 அல்லது 6 seats மற்றும் player names உள்ளிடலாம். Solo mode-ல் ஒரு
human மற்றும் மூன்று bots. Online room-ல் link மூலம் 4 அல்லது 6 players join செய்வார்கள்.

## அடிப்படை கொள்கைகள்

- Online game server-authoritative ஆக இருக்க வேண்டும்.
- Hidden hands மற்றும் hidden trump leak ஆகக்கூடாது.
- உண்மையில் தேர்ந்தெடுக்கப்பட்ட card மட்டுமே காட்ட வேண்டும்.
- முக்கியமான ஒவ்வொரு rule-க்கும் functional test வேண்டும்.
- Phone, tablet, desktop அனைத்திலும் responsive ஆக இருக்க வேண்டும்.

## Deployment

நண்பர்கள் trial-க்கு Render/Railway/long-lived Node process பயன்படுத்தலாம். Permanent
multi-instance deployment-க்கு Upstash போன்ற Redis தேவை. Release முன் typecheck, tests,
build ஓட வேண்டும்.
