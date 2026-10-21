import {
  LegalPage, Section, P, Bullet, Field, InternalLink,
} from '../components/LegalPage';

/**
 * Anbieterkennzeichnung für JR Coaching & Consulting Ltd, eine Gesellschaft nach
 * zyprischem Recht. Deshalb wird auf die EU-Richtlinie 2000/31/EG verwiesen und nicht
 * auf das österreichische ECG oder das deutsche DDG.
 * Anschrift, E-Mail und UID sind am 1.9.2026 von Julian bestätigt worden.
 */
export default function ImpressumScreen() {
  return (
    <LegalPage
      title="Impressum"
      subtitle="Anbieterkennzeichnung"
      updatedAt="Oktober 2026"
    >
      <Section heading="Betreiber">
        <Field label="Name" value="JR COACHING & CONSULTING LTD" />
        <Field label="Vertreten durch" value="Julian Riegler (Direktor)" />
        <Field label="Registereintrag" value="Registrar of Companies, Republik Zypern, Nr. HE 482984" />
        <Field label="Anschrift" value="Karatza 32, 3020 Limassol" />
        <Field label="Land" value="Zypern" />
        <Field label="E-Mail" value="kontakt@klickmill.app" />
        <Field label="UID-Nummer" value="CY60253218Q" />
      </Section>

      <Section heading="Pflichtangaben">
        <P>
          Diese Anbieterkennzeichnung erfolgt nach Artikel 5 der Richtlinie 2000/31/EG über den
          elektronischen Geschäftsverkehr, umgesetzt im Sitzstaat der Gesellschaft, der Republik
          Zypern. Nach dem Herkunftslandprinzip gilt für die Angaben zyprisches Recht, auch wenn
          die App in Deutschland und Österreich genutzt wird.
        </P>
        <P>
          Umsatzsteuer-Identifikationsnummer der Gesellschaft: CY60253218Q. Eine
          Kammerzugehörigkeit oder Aufsichtsbehörde für die Tätigkeit besteht nicht, es handelt
          sich um keinen reglementierten Beruf.
        </P>
      </Section>

      <Section heading="Unternehmensgegenstand">
        <P>
          Entwicklung und Betrieb der App Kündigo, einer Anwendung zum Erkennen und Kündigen
          von Abonnements.
        </P>
      </Section>

      <Section heading="Verbraucherstreitbeilegung">
        <P>
          Wir sind weder verpflichtet noch bereit, an einem Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </P>
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
