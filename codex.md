# AniLoop – Übergabe an Codex

## Projekt und Zusammenarbeit

Projektordner: /home/insider/IdeaProjects/AniLoop

AniLoop ist ein Anime-Quiz, inspiriert von AniGuessr, mit eigener Gestaltung
und zusätzlichen Multiplayer-Funktionen.

Der Nutzer möchte, dass notwendige lokale Änderungen und Tests selbstständig
ausgeführt werden, ohne wiederholte Bestätigungsfragen.
Bestehende Accounts, Spielstände und eigene Medien unbedingt erhalten.

Wichtig: Diese Datei gewährt keine technischen Berechtigungen.
Die letzte Sitzung hatte nur Lesezugriff. Vor Änderungen prüfen, ob die neue
Sitzung tatsächlich workspace-write erlaubt.

Kein GitHub-Push und keine öffentliche Bereitstellung ohne entsprechenden
Auftrag. Bisher wurde nur ein Upload-/Deployment-Paket vorbereitet.

## Aktueller Stand: Video-Korrektur umgesetzt (2026-11-16)

- Schreibzugriff geprüft; lokale Änderungen möglich. Kein Git-Repository im Projektordner, nichts gepusht oder veröffentlicht.
- Ending: vollständiges eingebrannt unscharfes Video, Start bei 0, frei spulbar; unscharfes Cover bleibt.
- Opening: physisch auf das konfigurierte Fenster zugeschnitten, Standard 35–65%; Start innerhalb der Datei bei 0, Anzeige mit Originalzeit-Offset.
- Beide Audios vollständig ab 0. Gemeinsame Ansichten gelten für Solo, Party und Co-op.
- Hint-Cache-Schlüssel enthalten `opening-window-v3-fast`; alte Dateien werden für neue Requests nicht wiederverwendet. Originale und eigene Medien bleiben erhalten.
- Editor/Importvalidierung, Pool-Metadaten und Erzeugungsskripte auf Opening-Fenster umgestellt. Alte Ending-Fenster eigener Pakete werden ignoriert.
- Give up erfolgt sofort, ohne Bestätigung; in Co-op für das ganze Team.
- Charaktervorschläge enthalten keinen Anime-Namen mehr.
- Anime-Anzeigen: englischer Alternativtitel zuerst, japanischer Katalogtitel darunter. Ohne englischen Katalogtitel bleibt der vorhandene Titel; keine erfundenen Übersetzungen. Aliase bleiben gültig.
- Party-Titelauflösung priorisiert exakte Titel vor Aliasen; bei normalen Quizfragen zählt ein zum Zieltitel passender Alias auch bei Katalogkollisionen.
- Accounts, bestehende Spielstände und eigene Medien nicht gelöscht oder zurückgesetzt. Browser-QA nutzt eigene Kontexte und temporäres SQLite unter /tmp.
- Aktueller regulärer Server: http://localhost:8097; QA-Server auf 8100 und 8102 nach Prüfung gestoppt; separate temporäre Datenbanken verwendet.

## Sprache und Gestaltung

- Gesamte Produktoberfläche auf ENGLISCH.
- Kommunikation mit dem Nutzer darf Deutsch sein.
- Sehr dunkle/schwarze Flächen, gedämpftes Mauve/Lila.
- Keine rote oder orange Hauptakzentfarbe, keine Neon-Effekte.
- Grundfarben ungefähr:
  Hintergrund #080808, Panels #111111 / #121212,
  Akzent #9b83a5, hellerer Akzent #b29abd.
- Poppins für UI, Lora für ausgewählte große Überschriften.
- frontend-design-Skill wurde bereits verwendet.
- Bestehende responsive Darstellung, Tastaturbedienung und reduzierte
  Animationen beibehalten.

Eigenes SVG-Branding:
- assets/mark.svg: Icon/Favicon mit Frame-/Loop-Motiv.
- assets/logo.svg: Wortmarke.
- Keine offizielle Verbindung zu AniGuessr oder Anthropic behaupten.

## Technik und wichtige Dateien

Buildlose Anwendung, keine npm-Installation für den Betrieb nötig.

- index.html: Einstieg, Englisch, lädt styles.css und skin.css.
- app.js: Solo-Quiz, Navigation, Medienplayer, Accounts, Leaderboards.
  Viele bestehende Funktionen stehen auf einer einzigen langen Zeile.
- social-ui.js: Party-/Co-op-Oberfläche, Polling, Streaks, Rewards, Shop.
- core.js: Solo-Rundenauswahl, Punkte, Vergleichslogik, Infinity-Gate.
- storage.js: localStorage, IndexedDB, Paketvalidierung.
- styles.css: ältere Basisregeln.
- skin.css: aktuelles schwarzes/Mauve-Design und Social-Oberflächen.
- server.py: Python-HTTP-Server, APIs, sichere Cookie-Verarbeitung,
  Byte-Ranges, statische Dateifreigabe.
- community.py: SQLite-Accounts und Community-Leaderboards.
- rooms.py: serverseitige Party-/Co-op-Zustände und Aktionen.
- rewards.py: tägliche Belohnungen, Streaks, Guthaben, Kosmetik.
- hint_media.py: tatsächlich unscharfe und ggf. zugeschnittene Dateien.
- media_cache.py: begrenzter Download-Cache registrierter Quellen.

Erforderlich: Python 3.12+, curl, ffmpeg und ffprobe.

Start:
    python3 server.py

Oder explizit:
    python3 server.py --port 8099

Default ist 8097; ohne explizite Portangabe wird bei Belegung ein freier
Folgeport gesucht. Zuletzt war die aktuelle App auf localhost:8099.
Nicht davon ausgehen, dass alte Prozesse noch laufen.

Ein alter Python-Prozess lädt Backend-Änderungen NICHT automatisch neu.
Ein früherer Fehler entstand dadurch: neue Oberfläche, alter Server,
POST /api/hints lieferte 501.

GET /api/health meldet u.a. hintApi, communityApi, roomsApi und rewardsApi.
Nach Backend-Änderungen den passenden Server kontrolliert neu starten.
Keine fremden Prozesse pauschal beenden.

## Medienpool und Datenschutz

data/pool.json enthält 3.259 echte Anime-Titel.

Kategorieverfügbarkeit:
- 759 Anime mit Screenshots, insgesamt 2.692 Screenshots.
- 2.895 unterschiedliche Figuren.
- 767 Anime mit Opening.
- 664 Anime mit Ending.
- 3.092 mögliche Anidle-Lösungen.

Nicht jeder Titel eignet sich für jede Kategorie.
Es wurden keine Titel künstlich vervielfacht.
Der frühere Wunsch „1000x mehr“ wurde nicht wörtlich erreicht.

Weitere Dateien:
- data/media-index.json: registrierte externe Medien.
- data/media-sources.json: Quellen lokaler Medien.
- data/pool-report.json: Bestandszahlen.
- data/starter.json: alte Demo-Testfixture, NICHT der Standardpool.
- assets/media/: etwa 342 MB vorhandene Originalmedien.
- .tools/media-cache/: Download-Cache, standardmäßig 2 GiB.
- .tools/hint-cache/: generierte Hinweise, separat begrenzt.

Originale niemals als vermeintlich geschützten Hinweis per CSS blur laden.
Bilder werden serverseitig heruntergerechnet/unscharf neu kodiert.
Videoframes werden serverseitig unscharf neu kodiert.
Begrenzte Videofenster müssen physisch zugeschnitten sein.

Der Katalog und Solo-Spielstände sind weiterhin im Browser einsehbar.
Nicht behaupten, dass die Anwendung vollständig cheat-proof ist.

## Solo-Spielregeln

Infinity:
Alle fünf Kategorien abschließen, erst dann nächste Runde freischalten.
Easy, Medium und Hard je Kategorie außer Anidle.
Zufällige Auswahl; vorherige Titel möglichst vermeiden.

Maximal 100.000 Punkte pro vollständiger Runde:

- Screenshots: 3 Aufgaben, je 10.000.
  Drei aufeinanderfolgende Hinweise, je minus 2.500.
  Zwei zusätzliche Szenen, danach maskierter Titel.

- Charaktere: 3 Aufgaben mit je 4 Figuren.
  Je Figur 2.000 für den Namen plus 500 für den Anime.
  Teilpunkte und getrennte Richtig/Falsch-Anzeigen erhalten.

- Openings: 3 Aufgaben, je 5.000.
  Videohinweis kostet einmalig 2.500.

- Endings: 3 Aufgaben, je 5.000.
  Videohinweis/Cover kostet einmalig 2.500.

- Anidle: 22 Versuche.
  Versuche 1–3: 10.000; danach minus 500 pro Versuch.
  Auch übersprungene Versuche kosten entsprechend Punkte.
  Cover ab 13, Synopsis ab 18, beliebteste Figur ab 22.
  Zusammenfassung zeigt nur aus bisherigen Tipps bekannte Eigenschaften.

Lokale Spielstände:
- localStorage: aniloop-state-v1.
- IndexedDB: aniloop-media, Store packs, Schlüssel custom.
- Standardpaket: expanded-pool-v3.
- Benutzerdefinierte Pakete nicht löschen oder still ersetzen.

## Accounts und Leaderboards

SQLite: .runtime/community.sqlite3, alternativ ANILOOP_DB.
Nicht löschen, veröffentlichen oder in Git einchecken.

- Username/Passwort, Registrierung, Login, Logout, Account-Löschung.
- Passwörter: gesalzenes scrypt, N=32768, r=8, p=3.
- Session-Token zufällig; nur Hash in SQLite.
- Cookies: HttpOnly, SameSite=Lax, 30 Tage.
- HTTPS-Deployment: ANILOOP_SECURE_COOKIES=1.
- ANILOOP_PUBLIC_ORIGIN muss zur öffentlichen Origin passen.
- State-changing APIs prüfen JSON und Origin.
- Login-Versuche sind begrenzt.
- Kein E-Mail-System, OAuth oder Passwort-Reset implementiert.
- Solo-Spielstände sind nicht automatisch zwischen Geräten synchronisiert.

Leaderboards:
- Daily und Infinity getrennt.
- All time, letzte 7 Tage, Today UTC.
- Bester vollständiger Run pro Spieler, Top 100.
- Tie-Breaker: Anzahl Runs, dann frühester erster Eintrag.
- Server berechnet Punkte aus Antworten neu.
- Doppelte Rundeneinträge werden zurückgewiesen.
- Nur Standardpool; alte Saves ohne Hint-Verlauf können nicht eingereicht werden.
- Community-Ranking, kein manipulationssicheres Wettkampfsystem.
- Veröffentlichung von Ergebnissen erfolgt ausdrücklich per Submit-Button.

## Party und Co-op: zuletzt hinzugefügt

Beide benötigen Accounts und denselben erreichbaren Backend-Server.

Party:
- Maximal 8 Spieler, sechsstelliger Raumcode und Einladungslink.
- Gleiche serverseitig ausgewählte Fragen für alle.
- Individuelle Antworten, Hinweise und Punkte.
- Host geht weiter, nachdem alle geantwortet/aufgegeben haben.

Co-op Infinity:
- Gemeinsame Antworten, Punkte und Fortschritt.
- Insgesamt acht gekaufte Hinweise pro vollständigem Loop.
- Budget betrifft Screenshot-/Video-Clues.
- Anidle-Clues bleiben an Versuche/Skips gekoppelt.
- Alle fünf Kategorien / 13 Aufgaben vor dem nächsten Loop abschließen.
- Jeder neue Loop erhält wieder acht Hinweise.
- Aufgeben beendet die aktuelle Team-Aufgabe für ALLE mit null Punkten;
  Give up erfolgt ohne Bestätigungsdialog.

Allgemein:
- Host startet erst ab 2 Spielern.
- Join nur vor Start.
- Host kann Spieler entfernen.
- Host-Abgang überträgt Hosting.
- Reconnect über denselben Account möglich.
- SQLite speichert den Raumzustand.
- Polling alle 1,5 Sekunden, keine WebSockets.
- Fragenwechsel synchronisiert; Audio/Video spielt pro Browser lokal.
- Inaktive Räume verfallen nach 24 Stunden.
- Raum-Ergebnisse bleiben getrennt von Solo-Leaderboards.

Wichtige bereits behobene Race Conditions:
- Globale Revision plus spielerspezifischer turn schützen Aktionen.
- Eine fremde Party-Antwort darf die eigene unabhängige Antwort nicht verwerfen.
- Gleichzeitige Co-op-Hinweise dürfen nicht doppelt abbuchen.
- Alte Poll-Antworten dürfen neuere Zustände nicht überschreiben.
- Entwürfe und möglichst laufende Medien bei Updates erhalten.
- Lokaler Daily-Reset darf einen aktiven Raum nicht verlassen.

## Streaks und tägliche Belohnungen

- Vollständigen Standardpool-Daily abschließen und Belohnung beanspruchen.
- 100 Loop Shards pro erfolgreicher Tages-Claim.
- Jeder siebte aufeinanderfolgende Claim-Tag: zusätzlich 50.
- Maximal ein Claim pro UTC-Tag UND pro Quiz-Datum.
- Reward-Reset: 00:00 UTC.
- Bestehender Quiz-Reset bleibt lokale Mitternacht.
- Streak zählt aufeinanderfolgende Claim-Tage.
- Verpasster Tag setzt aktuelle Streak zurück, nicht Bestwert und Badges.
- Sieben-Tage-Aktivitätsansicht und Sidebar-Zähler.
- Badges bei 3, 7, 14 und 30 Tagen.

Kosmetische Profilrahmen:
- Classic: kostenlos.
- Silver lining: 250 Shards.
- Mauve orbit: 500.
- Starlit loop: 1.000.
- Kauf rüstet aus; eigenes Inventar frei wechseln.
- Keine Echtgeldwährung und keine gekauften Spielvorteile.

Claims, Guthaben und Käufe sind transaktional in SQLite gespeichert.
Account-Löschung entfernt zugehörige Rewards, Inventar und Mitgliedschaften.

## Tests und bisherige Prüfung

Historischer Stand:
19 Node-Tests und zuletzt 34 Python-Tests bestanden im Hauptprojekt.
Solo-Browser-Regression und Zwei-Browser-Social-Test waren erfolgreich.
Docker-Image mit Social-Erweiterungen wurde gebaut.

Die letzte Social-Arbeit wurde durch nachfolgende Nutzer-/Umgebungsnachrichten
unterbrochen. Abschließenden Docker-/Release-Teststatus selbst prüfen.
Keine aktuelle vollständige Neuprüfung oder fertige Video-Korrektur behaupten.

Kommandos:
    node --test tests/core.test.js
    python3 -m unittest discover -s tests -p 'test_*.py'

Falls node nicht im PATH:
    /home/insider/IdeaProjects/Hack-Helikon-2026/.tools/node

Vorhandene Playwright-Umgebung:
    .tools/qa/bin/python tests/browser.py
    .tools/qa/bin/python tests/behaviors.py
    .tools/qa/bin/python tests/interface.py
    .tools/qa/bin/python tests/hint_failures.py
    .tools/qa/bin/python tests/large_pool.py
    .tools/qa/bin/python tests/community_browser.py
    .tools/qa/bin/python tests/social_browser.py

ANILOOP_URL passend setzen.
Account-/Social-Browsertests nur mit separatem ANILOOP_DB ausführen!
Screenshots liegen unter qa/.

Frühere QA-Ressourcen möglicherweise noch vorhanden:
- Native QA auf Port 8100 mit temporärer Datenbank.
- Docker-Container aniloop-social-qa, Port 8101.
- Image aniloop-qa:social.
Existenz prüfen, nicht einfach voraussetzen. Nur eigene QA-Ressourcen bereinigen.
Temporäre Logs unter /tmp sind inzwischen teilweise nicht mehr vorhanden.

## GitHub und Deployment

Privates GitHub-Repository: https://github.com/ohemida/AniLoop. Keine öffentliche Website deployed.

- Dockerfile, .dockerignore, .env.example vorhanden.
- .github/workflows/checks.yml vorhanden.
- DEPLOYMENT.md und SECURITY.md lesen.
- GitHub Pages allein kann Python, Accounts, Rooms und ffmpeg nicht betreiben.
- Backend auf einem geeigneten Host, HTTPS und persistentes SQLite nötig.
- Aktuell eine Instanz verwenden, keine unabhängigen SQLite-Replikas.

Release-Erzeugung:
    python3 scripts/prepare_release.py

Ziel: .release/AniLoop, zuletzt etwa 7,6 MB.
Das Script verweigert Überschreiben eines vorhandenen Ziels.
Alternativ --output mit einem neuen Zielverzeichnis verwenden.

Das Upload-Paket enthält Code, Branding und Metadaten, aber keine Accounts,
Caches oder gebündelten Anime-Mediendateien. Lokale Medienverweise werden
auf registrierte On-Demand-Quellen umgestellt.

Nach Änderungen Release aktualisieren und Tests auch dort prüfen.
Das Script kopiert Dateien über eine explizite Liste; neue Module und ggf.
diese codex.md müssen dort ergänzt werden, wenn sie ins Paket sollen.

Nicht veröffentlichen:
.runtime/, .tools/, .env, SQLite-Dateien, Browser-Exporte/QA-Daten.

Quellen und Nutzungsrechte externer Medien vor öffentlichem Launch prüfen.
Keine Lizenz ungefragt im Namen des Nutzers festlegen.

## Verifikation dieser Änderung

19 Node-Tests und 36 Python-Tests bestanden, einschließlich Cache-Version, physischem Opening-Fenster, vollständigem Ending trotz alter Fenster und Party-Alias-Kollision.
Playwright: browser.py, behaviors.py, interface.py, large_pool.py, social_browser.py und hint_failures.py.
Die erweiterten Social-Tests spielen Opening und Ending tatsächlich in Co-op und Party ab und prüfen Dauer, Offset, Seek, vollständiges Audio und unmittelbares Aufgeben.
Upload-Paket lokal unter .release/AniLoop neu erzeugt und separat mit 19 Node-/36 Python-Tests sowie echter On-Demand-Audio-/Videowiedergabe geprüft; keine Veröffentlichung.

## Weiteres Vorgehen

Nur nach ausdrücklichem Auftrag veröffentlichen oder pushen. Für vollständig übersetzte Titel müssen fehlende englische Metadaten aus einer verlässlichen Quelle ergänzt werden.

## Video hint loading improvement

Background preparation starts on the current music question without unlocking or charging points. Browser requests share a normalized promise; server cache keys exclude element IDs and ignore ending windows. Version `opening-window-v3-fast` uses 320px/20fps, boxblur=6:3 and ultrafast encoding (blur preserved). Local 30-second sample: 4.03s before, 1.06s after. External uncached downloads may still take time. Regression: tests/hint_loading.py.

## Overall performance and catalog update (2026-11-16)

Added catalog.js: WeakMap indexes per pack for ID lookups, statistics, autocomplete and library search. Added local licensed WOFF2 fonts, gzip/ETag text responses and immutable caching for successful media/hint responses only. APIs stay no-store; unknown media/errors remain revalidatable. Quiz renders before account/reward requests finish, retaining a draft entered during loading. Fixed markup inside library image alt attributes, added empty-search recovery and deferred offscreen library layout.

35 genuine catalog additions (5 from public catalog refresh, 30 sourced AniList Anidle entries). Added 25 screenshots, 16 unique characters, 6 openings and 2 endings. Provenance/IDs in data/catalog-update.json. New scripts update_catalog.py and add_anilist.py are append-only; default pack key unchanged to preserve saves. No fake music or screenshot claims for metadata-only entries.

Tests: node --test tests/*.test.js (22); Python discovery (39); tests/performance.py covers blocked account startup, draft preservation, local fonts, indexed search, empty state and a new playable Anidle entry.

## Friends and library boxing (2026-11-16)

- Library cards now explicitly use cover/text grid columns with minmax(0,1fr), safe alt text and wrapping bilingual titles. Mobile sidebar links form two readable rows. English UI, black/mauve theme retained.
- New friends.py service creates an additive friendships table in existing SQLite: exact-username requests, recipient accept/decline, sender cancellation, either-side removal, FK account-deletion cascade. Transactions prevent duplicate reciprocal/concurrent pairs; max 200 active relationships/requests per account.
- Authenticated GET /api/friends?day=YYYY-MM-DD returns the current player plus accepted friends, selected-day daily totals/category breakdowns, seven-day daily history and best Infinity/count. Results derive only from explicitly submitted existing scores, not local saves. Zero is distinct from Not submitted. No answers returned. Same-origin POST endpoints under /api/friends/ support request/accept/decline/cancel/remove.
- New frontend assets/friends-ui.js (asset path keeps static loading compatible with older server allowlists). Friends sidebar link, request management, date picker, submitted-score explanation, responsive comparisons. Refresh updates remote requests/results; no automatic publishing. Both players need same server.
- Pack identity, local saves/custom media and existing accounts retained; no publish/push.
- Tests: 22 Node tests, 46 Python tests, two-context tests/friends_browser.py covers request lifecycle, authorized score submissions, breakdown/history/Infinity, and 320–1440px card layout. Browser regression and large-pool editor regression passed. New files included in generated upload package.

Final verification: generated package also passed 22 Node and 46 Python tests plus the full two-account Friends browser test. Library/editor and full Solo browser regressions passed; existing multiplayer regression checked separately. The original database was backed up with SQLite's backup API before the 8097 restart. Both localhost:8097 and localhost:8098 report friendsApi:1 and serve assets/friends-ui.js; 8098 was left running so browser-origin saves remain accessible there. Refresh the existing page.

## Private GitHub upload authorized (2026-11-16)

The user explicitly authorized pushing to a private repository. Created https://github.com/ohemida/AniLoop with private visibility. The sanitized upload package is committed from .tools/github-upload/AniLoop, a separate persistent Git checkout. Keep that checkout when regenerating .release/AniLoop. Never push the full runtime workspace or personal databases/media. This is a source repository, not a deployed multiplayer server. No public visibility change was authorized.
