import {
  LegalPage, Section, P, Bullet, Field, PlaceholderNote, ExternalLink, InternalLink,
} from '../components/LegalPage';

/**
 * Offenlegung nach § 5 ECG, § 14 UGB sowie § 24 und § 25 Mediengesetz.
 * Die eckigen Klammern sind Platzhalter und müssen vor dem Livegang
 * durch die echten Angaben ersetzt werden.
 */
export default function ImpressumScreen() {
  return (
    <LegalPage
      title="Impressum"
      subtitle="Offenlegung nach § 5 E-Commerce-Gesetz (ECG) sowie § 24 und § 25 Mediengesetz."
      updatedAt="August 2026"
    >
      <PlaceholderNote>
        ⚠️ Vor der Veröffentlichung ausfüllen: Alle Angaben in eckigen Klammern sind Platzhalter.
        Ohne vollständige Angaben drohen Verwaltungsstrafen nach § 26 ECG.
      </PlaceholderNote>

      <Section heading="Medieninhaber, Herausgeber und Diensteanbieter">
        <Field label="Name" value="[Vor- und Nachname bzw. Firmenwortlaut]" />
        <Field label="Anschrift" value="[Straße und Hausnummer]" />
        <Field label="PLZ und Ort" value="[PLZ] [Ort]" />
        <Field label="Land" value="Österreich" />
        <Field label="E-Mail" value="[kontakt@example.at]" />
        <Field label="Telefon (optional)" value="[+43 ...]" />
      </Section>

      <Section heading="Unternehmensgegenstand">
        <P>
          [Unternehmensgegenstand eintragen, zum Beispiel: Entwicklung und Betrieb der App Kündigo,
          einer Anwendung zum Erkennen und Kündigen von Abonnements.]
        </P>
      </Section>

      <Section heading="Unternehmensdaten">
        <Field label="UID-Nummer (falls vorhanden)" value="[ATU 12345678]" />
        <Field label="Firmenbuchnummer (falls vorhanden)" value="[FN 123456a]" />
        <Field label="Firmenbuchgericht (falls vorhanden)" value="[Landesgericht ...]" />
        <Field label="Gewerbeaufsichtsbehörde" value="[Bezirkshauptmannschaft bzw. Magistrat ...]" />
        <Field label="Kammerzugehörigkeit" value="[Wirtschaftskammer ..., Fachgruppe ...]" />
        <Field
          label="Anwendbare Rechtsvorschrift"
          value="Gewerbeordnung, abrufbar unter ris.bka.gv.at"
        />
        <P>
          Fehlt eine dieser Angaben, weil sie auf dich nicht zutrifft, streiche die Zeile,
          statt sie leer stehen zu lassen.
        </P>
      </Section>

      <Section heading="Offenlegung nach § 25 Mediengesetz">
        <Field
          label="Geschäftsführung bzw. Vertretungsorgan (bei juristischen Personen)"
          value="[Name der Geschäftsführung oder des Vorstands]"
        />
        <Field
          label="Eigentums- und Beteiligungsverhältnisse (bei juristischen Personen)"
          value="[Gesellschafter und Beteiligungen in Prozent]"
        />
        <Field
          label="Grundlegende Richtung (Blattlinie)"
          value="[Zum Beispiel: Information über laufende Abonnements, Kündigungsfristen und Verbraucherrechte in Österreich und Deutschland.]"
        />
        <P>
          Betreibst du Kündigo als Einzelperson, entfallen die beiden ersten Zeilen.
        </P>
      </Section>

      <Section heading="Online-Streitbeilegung">
        <P>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit.
          Wir sind weder verpflichtet noch bereit, an einem Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </P>
        <ExternalLink label="ec.europa.eu/consumers/odr" url="https://ec.europa.eu/consumers/odr" />
      </Section>

      <Section heading="Haftung für Inhalte und Links">
        <Bullet>
          Die Inhalte dieser App werden mit Sorgfalt erstellt. Kündigungsfristen, Anleitungen und
          die von der KI erkannten Abos sind Hinweise, keine Rechtsberatung und keine Garantie.
        </Bullet>
        <Bullet>
          Prüfe eine Kündigung immer selbst beim jeweiligen Anbieter nach und hebe die Bestätigung auf.
        </Bullet>
        <Bullet>
          Für Inhalte verlinkter Seiten sind ausschließlich deren Betreiber verantwortlich.
        </Bullet>
      </Section>

      <Section heading="Datenschutz">
        <P>
          Wie Kündigo mit deinen Daten umgeht, welche Inhalte an Anthropic in die USA gehen und
          welche Rechte du hast, steht in der Datenschutzerklärung.
        </P>
        <InternalLink label="Zur Datenschutzerklärung" href="/datenschutz" />
      </Section>
    </LegalPage>
  );
}
