PPS V4.2 — ADMINISTRATORA RAŽOŠANAS SKATA LABOJUMS

Problēma:
- vecs CSS noteikums ar display:none!important slēpa visu Ražošanas sadaļu administratoram.

Labojums:
- izņemti visi konfliktējošie administratora CSS noteikumi;
- administrators redz abas cilnes: Ražošana un Pārvaldība;
- nospiežot Ražošana, tiek parādīts administratora paneļu pārskats;
- darbinieks joprojām redz tikai Ražošanu;
- administratora kopīgais rūpnīcas filtrs darbojas arī Ražošanas skatā.

GitHub aizvieto:
- index.html
- styles.css
- app.js
- cache-reset.js
- service-worker.js
- manifest.json

Pēc Commit aizver visas PPS cilnes un atver aplikāciju no jauna.
