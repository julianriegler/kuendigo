# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Werkzeuge für den App-Bau (seit 26.10.2026)

- `/feature-dev` (Plugin feature-dev-pinned): für neue Funktionen und Verbesserungen an bestehendem Code. Liest erst den Code mit Helfern, stellt Rückfragen, entwirft, baut, prüft. Ersetzt den `pruefer` nicht, der läuft danach trotzdem.
- Expo-Skills `expo:*` (Plugin expo-pinned, 22 Skills): bei jeder Expo-Arbeit zuerst `expo:expo-overview` laden, der leitet zum passenden Skill. Entfernt wurden `eas-simulator` (Cloud-Simulator, kostet) und das Feedback an Expo.
- Die Skills schreiben oft `npx eas-cli@latest`. Nie `@latest` ausführen, sondern eine feste eas-cli-Version. EAS-Dienste (Build, Update, Hosting, Workflows) kosten über der Gratisgrenze: vorher Julians Freigabe mit Betrag.
- Kündigo: eas-cli ist noch nicht festgelegt (`eas.json` → `cli.version` ist nur ">= 0.34.0", in `package.json` fehlt eas-cli). Vor dem ersten EAS-Befehl eine feste Version wählen und eintragen.
- Herkunft und Prüfung: `~/Projekte/claude-marketplaces/<plugin>/HERKUNFT.txt`, Urteile in `second-brain/60-Werkzeuge.md`.
