# Kündigo

Abo-Finder für Österreich und Deutschland. Kontoauszug, Screenshot oder E-Mails hochladen,
Claude erkennt wiederkehrende Zahlungen, die App zeigt Monatskosten und Kündigungsanleitungen.
Expo mit Expo Router, läuft auf iPhone und im Browser.

## Starten

```bash
npm install
npm run web      # Browser
npm run ios      # iPhone / Simulator
npm start        # Expo Dev Server, Plattform danach wählen
```

## Analyse und Freikontingent

Die Analyse läuft immer über die eigene Edge-Funktion `api/analyze.ts`:

1. Ist `ANTHROPIC_API_KEY` gesetzt, nutzt der Server diesen Schlüssel. Pro Gerät und
   Kalendermonat sind **drei Analysen frei**, gezählt in Upstash Redis (kostenloser Tarif)
   über einen anonymen, im Client erzeugten Geräte-Token (`x-device-token`).
   Ist das Kontingent aufgebraucht, antwortet die Funktion mit **429** und einer
   deutschen Meldung samt Hinweis auf eigenen Key oder Kündigo Pro.
2. Schickt die App den Header `x-anthropic-key` mit, wird dieser Eigenschlüssel benutzt.
   Er läuft am Freikontingent vorbei und wird nicht mitgezählt.

Einen Demo-Modus gibt es nicht mehr: Ohne eigenen Key analysiert die App echt,
solange Freikontingent übrig ist. Eigenen Key optional unter Einstellungen eintragen,
er bleibt im Browser bzw. auf dem Gerät.

`GET /api/analyze` mit `x-device-token` liefert den Kontingentstand, ohne etwas zu verbrauchen.
Die Screens zeigen ihn als Badge auf dem Startscreen, im Upload und in den Einstellungen.

### Umgebungsvariablen

Siehe `.env.example`. Für Vercel im Projekt hinterlegen:

| Variable | Zweck |
| --- | --- |
| `ANTHROPIC_API_KEY` | Serverschlüssel für das Freikontingent |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis, REST-Adresse |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis, REST-Token |
| `ANTHROPIC_BASE_URL` | optional, anderer Anthropic-Endpunkt |
| `ALLOW_MEMORY_QUOTA` | nur lokal: zählt ohne Upstash im Prozessspeicher |
| `EXPO_PUBLIC_API_BASE_URL` | nur native App: absolute Adresse des Proxys |

Ohne Upstash lehnt die Funktion grundsätzlich mit Status 503 ab, damit der Serverschlüssel
nicht ungezählt verbraucht wird. Nur mit `ALLOW_MEMORY_QUOTA=1` zählt ersatzweise ein
Speicher im Prozess, der ausschließlich lokal taugt.

Für den Weg über den Serverschlüssel setzt die Funktion Modell und `max_tokens` selbst
(aktuell `claude-sonnet-4-6`, höchstens 2048) und lehnt Anfragen über 5 MB mit Status 413 ab,
damit niemand über den offenen Endpunkt teure Aufrufe auf fremde Rechnung startet.
Mit eigenem Key gilt diese Beschneidung nicht.

## Gespeicherte Abos

Die Abo-Liste liegt dauerhaft unter dem Schlüssel `kuendigo_subs_v1`:
im Browser in `localStorage`, auf dem Gerät in AsyncStorage.

- Neue Analysen werden **additiv** ergänzt, nicht überschrieben.
- Demo-Daten (ohne API Key) sind flüchtig und landen erst im Speicher, wenn du
  sie bearbeitest oder eine echte Analyse startest.
- Duplikate werden über normalisierten Namen plus Betrag zusammengeführt
  („NETFLIX INTL BV" und „Netflix" bei gleichem Betrag sind ein Abo).
- „Als gekündigt markieren" und „Entfernen" überleben das Neuladen.
- Der Startscreen zeigt eine Kachel mit Anzahl der gespeicherten Abos und Gesamtkosten pro Monat.

## Fristen und Ersparnis

`utils/cancellationSteps.ts` kennt pro Dienst optional `noticePeriodDays` (Kündigungsfrist
in Tagen vor der Abbuchung) und `minTermMonths` (Mindestlaufzeit). Daraus rechnet
`latestCancelDate(nextCharge, noticePeriodDays)` den letztmöglichen Kündigungstag,
`cancelDeadline(name, nextCharge)` liefert zusätzlich die Restzeit in Tagen.

Der Tag steht auf jeder Abo-Karte und im Kündigungs-Modal. Fehlt die Frist, zeigt die App
den neutralen Hinweis „Frist unbekannt, am besten gleich kündigen" statt ein Datum zu erfinden.

Ganz oben auf der Ergebnisseite summiert eine Bilanz-Karte die Ersparnis aus allen als
gekündigt markierten Abos, pro Monat und pro Jahr. Jährliche, quartalsweise und wöchentliche
Beträge werden dafür auf Monatswerte umgerechnet (`utils/subscriptionMath.ts`, ein Monat
zählt als 4,345 Wochen, also 365 / 12 / 7). Die Markierung samt Datum liegt im Speicher, die Bilanz
überlebt damit jedes Neuladen.

API des Stores in `utils/resultStore.ts`, alle Funktionen sind asynchron:
`loadResults`, `setResults`, `mergeResults`, `upsertSubscription`, `removeSubscription`,
`clearResults`, `hasStoredResults`. Dazu synchron: `normalizeList` (bereinigt ohne zu
speichern) und `lastPersistFailed` (Speicher blockiert, etwa Safari Privatmodus).

## Einwilligung vor der Übertragung

Vor der ersten Analyse fragt die App einmal um Zustimmung (`components/ConsentModal.tsx`):
Der Inhalt geht an Anthropic in die USA, Kündigo speichert ihn nicht, die Zustimmung ist
freiwillig und widerrufbar. Ohne Häkchen bleibt „Zustimmen" gesperrt, „Abbrechen" verhindert
jede Übertragung. Dieselbe Sperre gilt für das automatische Ergänzen im Manuell-Screen,
weil auch dort Daten übertragen werden.

Gespeichert wird unter `kuendigo_consent_v1` der Zeitpunkt, die Textversion und der Wortlaut,
dem zugestimmt wurde (`utils/consent.ts`, Nachweispflicht nach Art. 7 Abs. 1 DSGVO). Wird
`CONSENT_VERSION` erhöht, weil sich der Text inhaltlich ändert, fragt die App erneut.

Die Einstellungen zeigen den Status mit Datum und Uhrzeit und bieten „Einwilligung widerrufen".
Nach dem Widerruf erscheint die Abfrage vor der nächsten Analyse wieder.

## Impressum und Datenschutz

`app/impressum.tsx` (§ 5 ECG, § 24 und § 25 Mediengesetz) und `app/datenschutz.tsx` (DSGVO)
liegen als eigene Routen `/impressum` und `/datenschutz`, verlinkt aus den Einstellungen und
aus dem Fuß des Startscreens. Gemeinsames Layout in `components/LegalPage.tsx`.

**Vor dem Livegang auszufüllen** (alles in eckigen Klammern ist Platzhalter):

- Impressum: Name, Anschrift, E-Mail, Unternehmensgegenstand, UID, Firmenbuch, Gewerbebehörde,
  Kammerzugehörigkeit, Blattlinie
- Datenschutz: Verantwortlicher, Kontaktadresse, Upstash-Region sowie die je Anbieter tatsächlich
  gewählte Grundlage für den USA-Transfer (Standardvertragsklauseln oder Data Privacy Framework)
- Auftragsverarbeitungsverträge mit Anthropic, Vercel und Upstash abschließen

Die Datenschutzerklärung beschreibt den tatsächlichen Datenfluss der App: lokale Abo-Liste,
Übermittlung der Hochladungen über `/api/analyze` an Anthropic in den USA, Zähler für das
Freikontingent, Server-Protokolle, Rechtsgrundlagen, Speicherdauer und Betroffenenrechte.

## Prüfen

```bash
node node_modules/typescript/lib/tsc.js --noEmit   # Typprüfung
npm run test:store                                 # Logiktest des Stores (simuliertes Neuladen, Dedupe, Löschen)
npm run test:logic                                 # Fristen und Ersparnis (inkl. Jahres- und Wochenabo)
node node_modules/expo/bin/cli export -p web       # Web-Build wie auf Vercel, Ergebnis in dist/
npm run test:web                                   # Browser-Test gegen dist/ (Chrome via playwright-core)
npm run test:api                                   # Freikontingent, Serverschlüssel, 429 (Ersatzdienste, keine Kosten)
npm run test:api -- vercel                         # derselbe Test gegen `vercel dev`
```

`npm run test:api` startet Ersatzdienste für Anthropic und Upstash, es entstehen keine
Kosten und es geht nichts nach außen. Ohne Argument läuft der Test gegen einen lokalen
Server, der `api/analyze.ts` direkt ausführt. Für die Variante `-- vercel` muss einmalig
`npx vercel login` gelaufen sein, sonst bricht die Vercel-CLI mit einer Anmeldeaufforderung ab.
`npm run dev:api` startet `vercel dev` (Frontend aus `dist/` plus die Funktion unter `/api`).

`npm run test:web` startet einen kleinen Server auf `dist/`, steuert das installierte
Google Chrome und prüft: Beispieldaten werden nicht gespeichert, ein gelöschtes Abo
bleibt nach dem Neuladen gelöscht, die Startscreen-Kachel stimmt, und eine Kündigung
überlebt den Reload.

## Deploy

Vercel baut mit `npx expo export -p web` nach `dist` (siehe `vercel.json`).
Die Analyse läuft über den Edge-Proxy `api/analyze`, damit der Serverschlüssel
nicht im Browser landet und CORS auf iOS Safari funktioniert.

Vor dem ersten Deploy im Vercel-Projekt hinterlegen: `ANTHROPIC_API_KEY`,
`UPSTASH_REDIS_REST_URL` und `UPSTASH_REDIS_REST_TOKEN` (Upstash Redis, kostenloser Tarif).

Deploy-URL: noch nicht gesetzt (Vercel-Projekt in diesem Verzeichnis noch nicht verknüpft).
