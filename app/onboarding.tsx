import { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import { DEMO_SUBSCRIPTIONS } from '../utils/analyzeSubscriptions';
import { loadResults, setResults } from '../utils/resultStore';
import { getApiKey, setOnboarded } from '../utils/storage';
import { zaehle } from '../utils/messung';
import { fetchQuota, quotaAvailable } from '../utils/quota';

/**
 * Aufbau nach dem Muster von Klartext (Julian, 29.10.): oben Name und Nutzen, Seite 1 stellt eine
 * konkrete Frage und zeigt Problem, Lösung und ersten Schritt. Die Analyse wird nur versprochen,
 * wenn sie wirklich geht (Julian, 27.10.).
 */
function steps(canAnalyze: boolean) {
  return [
    {
      icon: '💸',
      title: 'Zahlst du für Abos, die du vergessen hast?',
      paragraphs: [
        'Das Problem: Abos laufen jeden Monat weiter, auch wenn du sie längst nicht mehr nutzt.',
        canAnalyze
          ? 'Die Lösung: Du lädst deinen Kontoauszug hoch. Kündigo findet deine Abos und zeigt dir, was sie im Monat und im Jahr kosten.'
          : 'Die Lösung: Du trägst deine Abos ein. Kündigo zeigt dir, was sie im Monat und im Jahr kosten.',
        canAnalyze
          ? 'So fängst du an: Lade einen Kontoauszug oder Screenshot hoch.'
          : 'So fängst du an: Trag dein erstes Abo ein, zum Beispiel Netflix.',
      ],
    },
    {
      icon: '📋',
      title: 'Alles auf einen Blick',
      paragraphs: canAnalyze
        ? ['Jedes Abo mit seinem Preis, zusammengerechnet für Monat und Jahr.']
        : [
            'Jedes Abo mit seinem Preis, zusammengerechnet für Monat und Jahr.',
            'Abos aus dem Kontoauszug einlesen kommt später.',
          ],
    },
    {
      icon: '✅',
      title: 'Dann kündigst du',
      // Fälligkeiten kennt Kündigo nur aus der Analyse; selbst eingetragene Abos bekommen ein geschätztes Datum
      paragraphs: [canAnalyze
        ? 'Du siehst, was bald fällig wird. Für viele bekannte Dienste zeigt Kündigo dir Schritt für Schritt, wie du kündigst.'
        : 'Für viele bekannte Dienste zeigt Kündigo dir Schritt für Schritt, wie du kündigst.'],
    },
  ];
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [canAnalyze, setCanAnalyze] = useState(() => !!getApiKey() || quotaAvailable());
  useEffect(() => {
    fetchQuota().then(() => setCanAnalyze(!!getApiKey() || quotaAvailable()));
  }, []);
  const STEPS = steps(canAnalyze);
  const last = page >= STEPS.length - 1;

  function weiter() {
    const next = Math.min(page + 1, STEPS.length - 1);
    // ohne Animation: Zwischenstände beim Blättern würden die Seitenzahl kurz zurücksetzen
    scrollRef.current?.scrollTo({ x: width * next, animated: false });
    setPage(next);
  }

  /** Direkter Weg ohne Beispiel: eintragen (heute) oder hochladen (mit Analyse). */
  async function selbstAnfangen() {
    await setOnboarded();
    zaehle(canAnalyze ? 'analyse_start' : 'eintragen_start');
    router.replace(canAnalyze ? '/upload' : '/manual');
  }

  function onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(next);
  }

  /**
   * Sofort-Demo ohne Hürde: schreibt die Beispieldaten in den Store (als
   * demo markiert, siehe resultStore.ts/analyzeSubscriptions.ts) und geht
   * direkt zum Ergebnis, ohne API Key und ohne Kontoauszug.
   *
   * Bestandsnutzer, die ohne kuendigo_onboarded-Flag hier landen (Update
   * einer laufenden App), dürfen NICHT überschrieben werden: erst prüfen,
   * ob schon echte (nicht-demo) Abos gespeichert sind, dann nur navigieren.
   */
  async function beispielAnsehen() {
    await setOnboarded();
    zaehle('beispiel_start');
    const bestehende = await loadResults();
    if (!bestehende.some(s => !s.demo)) {
      await setResults(DEMO_SUBSCRIPTIONS.map(sub => ({ ...sub, demo: true })));
    }
    router.replace('/results');
  }

  /** Direkt weiter ohne Beispiel, für alle die den Pager nicht brauchen. */
  async function ueberspringen() {
    await setOnboarded();
    router.replace('/');
  }

  return (
    <View style={styles.root}>
      {/* Name und Nutzen oben, wie bei Klartext */}
      <View style={styles.headerRow}>
        <View style={styles.brand}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandLetter}>K</Text>
          </View>
          <View>
            <Text style={styles.brandName}>Kündigo</Text>
            <Text style={styles.brandTagline}>Sieh, was deine Abos kosten.</Text>
          </View>
        </View>
        {!last && (
          <TouchableOpacity
            onPress={ueberspringen}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Einführung überspringen"
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>Überspringen</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        onScroll={onScrollEnd}
        scrollEventThrottle={16}
        style={styles.pager}
      >
        {STEPS.map((step, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <Text style={styles.icon}>{step.icon}</Text>
            <Text style={styles.title}>{step.title}</Text>
            {step.paragraphs.map((t, j) => (
              <Text key={j} style={[styles.text, j > 0 && styles.textNext]}>{t}</Text>
            ))}
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessible accessibilityLabel={`Schritt ${page + 1} von ${STEPS.length}`}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        {!last ? (
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={weiter}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Weiter zur nächsten Seite"
          >
            <Text style={styles.ctaText}>Weiter →</Text>
          </TouchableOpacity>
        ) : (
          <>
            {/* Zwei gleich große Wege: selbst anfangen oder erst das Beispiel */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={selbstAnfangen}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={canAnalyze ? 'Kontoauszug hochladen' : 'Erstes Abo eintragen'}
            >
              <Text style={styles.ctaText}>{canAnalyze ? 'Kontoauszug hochladen →' : 'Erstes Abo eintragen →'}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondButton}
              onPress={beispielAnsehen}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Beispiel ansehen, zeigt eine Liste mit Beispiel-Abos"
            >
              <Text style={styles.secondText}>Beispiel ansehen</Text>
            </TouchableOpacity>
          </>
        )}
        <Text style={styles.ctaHint}>Ohne Anmeldung.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between' },
  pager: { flexGrow: 0 },

  headerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 48,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandBadge: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  brandLetter: { fontSize: 18, fontWeight: '800', color: colors.bg },
  brandName: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  brandTagline: { fontSize: 13, color: colors.textSecondary },
  skipBtn: { minHeight: 44, justifyContent: 'center' },
  skipText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  slide: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingTop: 40, paddingBottom: 24,
  },
  icon: { fontSize: 64, marginBottom: 28 },
  title: {
    fontSize: 24, fontWeight: '800', color: colors.textPrimary,
    textAlign: 'center', letterSpacing: -0.5, marginBottom: 14,
  },
  text: {
    fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24,
  },
  textNext: { marginTop: 12 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  dot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.accent, width: 22 },

  footer: { paddingHorizontal: 32, paddingBottom: 48, paddingTop: 24, alignItems: 'center' },
  ctaButton: {
    backgroundColor: colors.accent, borderRadius: 14,
    paddingVertical: 18, paddingHorizontal: 40,
    width: '100%', minHeight: 44, alignItems: 'center',
  },
  ctaText: { fontSize: 17, fontWeight: '700', color: colors.bg, letterSpacing: 0.2 },
  secondButton: {
    borderRadius: 14, borderWidth: 1.5, borderColor: colors.accent,
    paddingVertical: 17, paddingHorizontal: 40,
    width: '100%', minHeight: 44, alignItems: 'center', marginTop: 12,
  },
  secondText: { fontSize: 17, fontWeight: '700', color: colors.accent, letterSpacing: 0.2 },
  ctaHint: { fontSize: 12, color: colors.textTertiary, marginTop: 12 },
});
