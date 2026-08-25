import {
  LegalPage, Section, P, Bullet, Field, PlaceholderNote, ExternalLink, InternalLink,
} from '../components/LegalPage';

/**
 * Datenschutzerklärung nach DSGVO. Beschreibt genau das, was die App
 * tatsächlich tut: lokale Speicherung der Abos, Übermittlung der
 * hochgeladenen Inhalte an Anthropic und den Zähler für das Freikontingent.
 */
export default function DatenschutzScreen() {
  return (
    <LegalPage
      title="Datenschutzerklärung"
      subtitle="Was Kündigo mit deinen Daten macht, an wen etwas übermittelt wird und welche Rechte du hast."
      updatedAt="August 2026"
    >
      <PlaceholderNote>
        ⚠️ Vor der Veröffentlichung ausfüllen: Verantwortlicher, Kontakt und der Stand der
        Auftragsverarbeitungsverträge (Anthropic, Vercel, Upstash) sind Platzhalter.
      </PlaceholderNote>

      <Section heading="1. Verantwortlicher">
        <Field label="Name" value="JR COACHING & CONSULTING LTD" />
        <Field label="Register" value="Registrar of Companies, Republik Zypern, Nr. HE 482984" />
        <Field label="Anschrift" value="Karatza 32, 3020 Limassol, Zypern" /> {/* RECHT_ANSCHRIFT */}
        <Field label="E-Mail" value="kontakt@klickmill.app" /> {/* RECHT_EMAIL */}
        <P>
          Ein Datenschutzbeauftragter ist nicht bestellt, weil die Voraussetzungen nach Art. 37 DSGVO
          nicht vorliegen. Die vollständigen Angaben stehen im Impressum.
        </P>
        <InternalLink label="Zum Impressum" href="/impressum" />
      </Section>

      <Section heading="2. Abo-Daten bleiben auf deinem Gerät">
        <P>
          Deine erkannten Abos speichert Kündigo ausschließlich lokal: im Browser in
          localStorage, auf iPhone und Android im App-Speicher (AsyncStorage). Es gibt kein
          Nutzerkonto und keine Kopie dieser Liste auf unseren Servern.
        </P>
        <Bullet>kuendigo_subs_v1: Name, Betrag, Zahlungsrhythmus, Kategorie, Datum der letzten und der nächsten Abbuchung, Markierung als gekündigt samt Datum.</Bullet>
        <Bullet>kuendigo_device_v1: eine zufällige Geräte-Kennung ohne Personenbezug, nur für das Freikontingent.</Bullet>
        <Bullet>kuendigo_api_key: dein eigener Anthropic API Key, falls du einen hinterlegst.</Bullet>
        <Bullet>kuendigo_consent_v1: Zeitpunkt, Textversion und Wortlaut deiner Einwilligung in die Analyse.</Bullet>
        <P>
          Du kannst diese Daten jederzeit selbst löschen: einzelne Abos über „Entfernen" in der
          Liste, alles zusammen über das Löschen der Website-Daten im Browser bzw. das Löschen der App.
        </P>
      </Section>

      <Section heading="3. Analyse deiner Hochladungen (Anthropic)">
        <P>
          Für die Analyse übermittelt die App genau das, was du hochlädst oder einfügst: den Text
          deines Kontoauszugs, das Bild deines Banking-Screenshots, eingefügte E-Mail-Texte oder den
          Namen eines Dienstes beim automatischen Ergänzen. Diese Inhalte können Kontobewegungen und
          damit sensible Angaben zu deiner Lebensführung enthalten.
        </P>
        <P>
          Der Weg: deine App sendet die Inhalte an unsere Funktion /api/analyze (gehostet bei
          Vercel) und diese leitet sie an Anthropic PBC weiter, die das Sprachmodell Claude betreibt.
          Wir speichern die Inhalte dabei nicht, sie laufen nur durch. Ergebnis der Analyse ist die
          Abo-Liste, die wieder ausschließlich auf deinem Gerät landet.
        </P>
        <Bullet>Empfänger: Anthropic PBC, 548 Market St, San Francisco, CA 94104, USA, als Auftragsverarbeiter nach Art. 28 DSGVO.</Bullet>
        <Bullet>Hosting der Funktion und Auslieferung der Web-App: Vercel Inc., USA.</Bullet>
        <Bullet>Zähler für das Freikontingent: Upstash (Redis), Serverstandort [Region eintragen].</Bullet>
        <P>
          Hinterlegst du deinen eigenen Anthropic API Key, wird die Analyse deinem Anthropic-Konto
          zugerechnet und nicht auf das Freikontingent angerechnet. In der App auf iPhone und Android
          geht die Anfrage in diesem Fall direkt an Anthropic, ohne Umweg über unsere Funktion.
        </P>
      </Section>

      <Section heading="4. Drittlandtransfer in die USA">
        <P>
          Anthropic und Vercel verarbeiten Daten in den USA, also außerhalb der EU. Für diese
          Übermittlung stützen wir uns auf die Standardvertragsklauseln der EU-Kommission nach
          Art. 46 Abs. 2 lit. c DSGVO sowie, soweit die Anbieter zertifiziert sind, auf den
          Angemessenheitsbeschluss zum EU-US Data Privacy Framework.
        </P>
        <P>
          Trotz dieser Absicherung besteht ein Restrisiko: US-Behörden können unter bestimmten
          Voraussetzungen auf Daten zugreifen, und das europäische Schutzniveau lässt sich dort nicht
          in jedem Fall vollständig durchsetzen. Wenn du das nicht möchtest, lade keine Kontoauszüge
          oder Screenshots hoch und trage deine Abos stattdessen manuell ein.
        </P>
        <PlaceholderNote>
          ⚠️ Vor dem Livegang: Auftragsverarbeitungsverträge mit Anthropic, Vercel und Upstash
          abschließen und hier die tatsächlich gewählte Grundlage (Standardvertragsklauseln oder
          Data Privacy Framework) je Anbieter eintragen.
        </PlaceholderNote>
      </Section>

      <Section heading="5. Freikontingent und Missbrauchsschutz">
        <P>
          Ohne eigenen API Key sind drei Analysen pro Gerät und Monat frei. Dafür erzeugt die App
          eine zufällige Geräte-Kennung und zählt damit die Anzahl deiner Analysen im laufenden
          Monat. Gespeichert werden nur diese Kennung, der Monat und ein Zähler, keine Inhalte,
          keine Namen und keine IP-Adresse.
        </P>
      </Section>

      <Section heading="6. Server-Protokolle">
        <P>
          Beim Aufruf der Web-App und der Analyse-Funktion fallen bei Vercel technische Protokolle
          an (IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browserkennung). Sie dienen dem Betrieb
          und der Abwehr von Missbrauch und werden von Vercel nach kurzer Zeit gelöscht.
        </P>
      </Section>

      <Section heading="7. Rechtsgrundlagen">
        <Bullet>
          Analyse deiner Hochladungen und Anzeige der Ergebnisse: Vertragserfüllung
          nach Art. 6 Abs. 1 lit. b DSGVO, denn genau dafür nutzt du die App.
        </Bullet>
        <Bullet>
          Übermittlung der Inhalte an Anthropic in die USA: deine ausdrückliche Einwilligung nach
          Art. 6 Abs. 1 lit. a und Art. 49 Abs. 1 lit. a DSGVO. Vor der ersten Analyse erscheint
          dafür eine Abfrage, in der du das Häkchen setzt und auf „Zustimmen" tippst. Ohne diese
          Zustimmung wird nichts übertragen. Widerrufen kannst du sie jederzeit in den
          Einstellungen über „Einwilligung widerrufen", danach fragt die App vor der nächsten
          Analyse erneut.
        </Bullet>
        <Bullet>
          Freikontingent, Missbrauchsschutz und Server-Protokolle: berechtigtes Interesse nach
          Art. 6 Abs. 1 lit. f DSGVO an einem funktionierenden und bezahlbaren Betrieb.
        </Bullet>
        <P>
          Ein Widerruf der Einwilligung berührt die Rechtmäßigkeit der bis dahin erfolgten
          Verarbeitung nicht. Ohne Einwilligung kannst du die App weiter nutzen und deine Abos
          manuell eintragen.
        </P>
      </Section>

      <Section heading="8. Speicherdauer">
        <Bullet>Abo-Liste, Geräte-Kennung und eigener API Key: auf deinem Gerät, bis du sie löschst.</Bullet>
        <Bullet>Einwilligung: auf deinem Gerät, bis du sie widerrufst oder die App-Daten löschst.</Bullet>
        <Bullet>Zähler für das Freikontingent: rund 40 Tage, danach läuft der Eintrag automatisch ab.</Bullet>
        <Bullet>Hochgeladene Inhalte bei uns: keine Speicherung, sie werden nur durchgereicht.</Bullet>
        <Bullet>Hochgeladene Inhalte bei Anthropic: Speicherung nach deren Vorgaben zur Missbrauchsprüfung, aktuell in der Regel bis zu 30 Tage, ohne Nutzung für das Training der Modelle.</Bullet>
        <Bullet>Server-Protokolle bei Vercel: nach deren Aufbewahrungsfristen.</Bullet>
      </Section>

      <Section heading="9. Keine Werbung, kein Tracking">
        <P>
          Kündigo setzt keine Werbe-Cookies, bindet keine Analysedienste ein und verkauft keine
          Daten. Der lokale Speicher wird ausschließlich für die Funktion der App verwendet.
        </P>
      </Section>

      <Section heading="10. Deine Rechte">
        <Bullet>Auskunft über die zu dir verarbeiteten Daten (Art. 15 DSGVO).</Bullet>
        <Bullet>Berichtigung unrichtiger Daten (Art. 16 DSGVO).</Bullet>
        <Bullet>Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO).</Bullet>
        <Bullet>Datenübertragbarkeit (Art. 20 DSGVO).</Bullet>
        <Bullet>Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO).</Bullet>
        <Bullet>Widerruf erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO).</Bullet>
        <P>
          Weil die Abo-Daten nur auf deinem Gerät liegen, kannst du Auskunft, Berichtigung und
          Löschung dort unmittelbar selbst ausüben. Für alles Weitere schreib uns an
          [datenschutz@example.at].
        </P>
      </Section>

      <Section heading="11. Beschwerde bei der Aufsichtsbehörde">
        <P>
          Du hast das Recht, dich bei einer Aufsichtsbehörde zu beschweren. Zuständig für
          unseren Sitz ist:
        </P>
        <Field label="Behörde" value="Commissioner for Personal Data Protection, Republik Zypern" />
        <ExternalLink label="dataprotection.gov.cy" url="https://www.dataprotection.gov.cy" />
        <P>
          Daneben kannst du dich auch an die Datenschutz-Aufsichtsbehörde deines eigenen
          Wohnortes wenden.
        </P>
      </Section>
    </LegalPage>
  );
}
