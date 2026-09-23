import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Share, Platform } from 'react-native';
import { colors } from '../constants/theme';
import { sendeFeedback, zaehle } from '../utils/messung';

/** Der Kurzlink zählt Klicks und leitet in die App, deshalb teilen wir ihn statt der Rohadresse. */
const APP_LINK = 'https://klickmill.app/go/kuendigo?s=teilen';
const TEIL_TEXT = 'Kündigo findet alle Abos aus einem Screenshot vom Kontoauszug. Läuft im Browser.';

/**
 * Ehrliche Beta-Ansprache (Julians Vorgabe 23.9.): die Leute wissen, dass sie
 * eine Testfassung nutzen, und können teilen und Feedback schicken. So
 * entwickeln sie die App mit uns weiter.
 */
export default function BetaHinweis() {
  const [text, setText] = useState('');
  const [kontakt, setKontakt] = useState('');
  const [stand, setStand] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function teilen() {
    zaehle('teilen_app');
    try {
      if (Platform.OS === 'web') {
        const nav = navigator as Navigator & { share?: (d: { title: string; text: string; url: string }) => Promise<void> };
        if (nav.share) {
          await nav.share({ title: 'Kündigo', text: TEIL_TEXT, url: APP_LINK });
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(APP_LINK);
          setStand(`Link kopiert: ${APP_LINK}`);
        } else {
          setStand(`Link zum Weitergeben: ${APP_LINK}`);
        }
      } else {
        await Share.share({ message: `${TEIL_TEXT} ${APP_LINK}` });
      }
    } catch {
      // Abgebrochen oder blockiert: kein Fehler für den Nutzer.
    }
  }

  async function senden() {
    setBusy(true);
    const ergebnis = await sendeFeedback(text, kontakt);
    setBusy(false);
    if (ergebnis === 'zu_kurz') {
      setStand('Schreib bitte ein, zwei Sätze, dann können wir etwas damit anfangen.');
    } else if (ergebnis === 'gesendet' || ergebnis === 'dev') {
      setText('');
      setKontakt('');
      setStand(ergebnis === 'dev' ? 'Entwicklungsmodus: nicht gesendet.' : 'Danke, dein Feedback ist angekommen.');
    } else {
      setStand('Senden hat nicht geklappt. Versuch es später noch einmal.');
    }
  }

  return (
    <View style={styles.karte} accessibilityRole="summary">
      <Text style={styles.titel}>Du testest Kündigo mit</Text>
      <Text style={styles.text}>
        Kündigo ist eine Testfassung. Die App läuft im Browser, damit wir ohne Umweg über einen
        App-Store schnell verbessern können. In den Play Store und den App Store geht sie erst, wenn
        du und viele andere sie gern nutzen.
      </Text>
      <Text style={styles.text}>
        Wenn sie dir hilft: teile sie. Und sag uns, was fehlt oder stört. So bauen wir sie mit dir
        zusammen weiter.
      </Text>

      <TouchableOpacity style={styles.knopf} onPress={teilen} accessibilityRole="button" accessibilityLabel="App teilen">
        <Text style={styles.knopfText}>App teilen</Text>
      </TouchableOpacity>

      <Text style={styles.label}>Dein Feedback</Text>
      <TextInput
        style={[styles.feld, styles.feldMehrzeilig]}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={1000}
        placeholder="Was fehlt dir, was stört, was gefällt?"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Dein Feedback"
      />
      <Text style={styles.label}>Kontakt für Rückfragen (freiwillig)</Text>
      <TextInput
        style={styles.feld}
        value={kontakt}
        onChangeText={setKontakt}
        maxLength={200}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="E-Mail oder leer lassen"
        placeholderTextColor={colors.textTertiary}
        accessibilityLabel="Kontakt für Rückfragen, freiwillig"
      />
      <TouchableOpacity
        style={[styles.knopf, busy && styles.knopfAus]}
        onPress={senden}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Feedback senden"
      >
        <Text style={styles.knopfText}>{busy ? 'Sendet …' : 'Feedback senden'}</Text>
      </TouchableOpacity>

      {stand ? (
        <Text style={styles.stand} accessibilityLiveRegion="polite">
          {stand}
        </Text>
      ) : null}
      <Text style={styles.klein}>
        Dein Feedback geht an uns (klickmill.app), ohne IP-Adresse und ohne Kennung. Mehr dazu in der
        Datenschutzerklärung.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  karte: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginTop: 28,
    gap: 10,
  },
  titel: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  text: { color: colors.textSecondary, fontSize: 14, lineHeight: 21 },
  label: { color: colors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 4 },
  feld: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    color: colors.textPrimary,
    fontSize: 15,
  },
  feldMehrzeilig: { minHeight: 88, textAlignVertical: 'top' },
  knopf: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  knopfAus: { opacity: 0.6 },
  knopfText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  stand: { color: colors.textPrimary, fontSize: 14 },
  klein: { color: colors.textTertiary, fontSize: 12, lineHeight: 17 },
});
