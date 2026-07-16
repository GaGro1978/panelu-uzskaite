PPS V5.4 — PILNA STABILĀ VERSIJA

Šī ir pilna projekta pakotne, nevis atsevišķs ielāps.

VERSIJA
- index.html virsraksts: PPS V5.4
- pārlūka title: PPS V5.4
- app.js keša parametrs: v=5.4
- manifest.json: PPS V5.4

SALABOTS RAŽOŠANĀ
- “Pabeigt savu darbu” aizver visas kļūdaini palikušās aktīvās sesijas konkrētajam darbiniekam.
- Taimeris apstājas uzreiz.
- “Panelis pabeigts” aizver darbinieka aktīvās sesijas un pabeidz paneli.
- Administratora/vadītāja “✔ Pabeigt” aizver visas paneļa aktīvās sesijas.
- Aktīvie darbinieku vārdi vairs netiek dublēti sarakstā.
- Pabeigtas sesijas vairs netiek uzskatītas par aktīvām.

PROJEKTI
- Pārvaldība → Projekti.
- Dzēšanas poga redzama tikai ofisa darbiniekiem.
- Projekta dzēšana dzēš arī tā paneļus un darba sesijas.
- Projektu nevar dzēst, ja tajā vēl ir aktīvi darbi.
- Ražotnes vadītāji projektu sadaļu neredz.

LOMAS UN PIN
- Parastie darbinieki: bez PIN.
- Ražotņu vadītāji: PIN 1100.
- Ofisa darbinieki: PIN 1020.

GITHUB
Aizvieto visus failus ar šīs pakotnes failiem:
- index.html
- app.js
- styles.css
- cache-reset.js
- service-worker.js
- manifest.json
- README.txt
- firestore-rules.txt

Pēc augšupielādes pārbaudi, ka lapas augšā redzams “PPS V5.4”.
