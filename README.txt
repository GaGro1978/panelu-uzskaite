PANEĻU RAŽOŠANAS UZSKAITE

Ātra palaišana datorā:
1. Atver mapi terminālī.
2. Palaid:
   python -m http.server 8000
3. Pārlūkā atver:
   http://localhost:8000

Telefonā:
- Telefonam un datoram jābūt vienā Wi-Fi tīklā.
- Datorā noskaidro lokālo IP adresi, piemēram 192.168.1.25.
- Telefonā atver http://192.168.1.25:8000
- Chrome izvēlnē izvēlies "Add to Home screen" / "Pievienot sākuma ekrānam".

Svarīgi:
- Šī prototipa dati glabājas konkrētās ierīces pārlūkā (localStorage).
- Dati starp vairākiem telefoniem vēl nesinhronizējas.
- CSV eksportu var atvērt Excel.
