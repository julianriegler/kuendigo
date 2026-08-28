import {
  LegalPage, Section, P, Bullet, Field, PlaceholderNote, ExternalLink, InternalLink,
} from '../components/LegalPage';

/**
 * Anbieterkennzeichnung für JR Coaching & Consulting Ltd.
 * Anschrift und E-Mail werden noch nachgetragen (siehe Marker RECHT_ANSCHRIFT
 * und RECHT_EMAIL).
 */
export default function ImpressumScreen() {
  return (
    <LegalPage
      title="Impressum"
      subtitle="Anbieterkennzeichnung"
      updatedAt="August 2026"
    >
      <Section heading="Betreiber">
        <Field label="Name" value="JR COACHING & CONSULTING LTD" />
        <Field label="Vertreten durch" value="Julian Riegler (Direktor)" />
        <Field label="Registereintrag" value="Registrar of Companies, Republik Zypern, Nr. HE 482984" />
        <Field label="Anschrift" value="Karatza 32, 3020 Limassol" /> {/* RECHT_ANSCHRIFT */}
        <Field label="Land" value="Zypern" />
        <Field label="E-Mail" value="kontakt@klickmill.app" /> {/* RECHT_EMAIL */}
      </Section>

      <Section heading="Unternehmensgegenstand">
        <P>
          Entwicklung und Betrieb der App Kündigo, einer Anwendung zum Erkennen und Kündigen
          von Abonnements.
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
