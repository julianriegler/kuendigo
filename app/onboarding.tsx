import { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  useWindowDimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import { DEMO_SUBSCRIPTIONS } from '../utils/analyzeSubscriptions';
import { loadResults, setResults } from '../utils/resultStore';
import { setOnboarded } from '../utils/storage';

const STEPS = [
  {
    icon: '💸',
    title: 'Du zahlst für Abos, die du vergessen hast',
    text: 'Im Schnitt schlummern auf einem Konto 8 bis 12 Abos, die niemand mehr nutzt. Das kostet oft mehrere hundert Euro im Jahr.',
  },
  {
    icon: '📄',
    title: 'Kündigo findet sie automatisch',
    text: 'Lade deinen Kontoauszug hoch. Kündigo erkennt jedes Abo, den Betrag und den nächsten Abbuchungstermin von selbst.',
  },
  {
    icon: '✅',
    title: 'Alle Abos auf einen Blick',
    text: 'Du siehst sofort, was du zahlst, was bald fällig wird und wie du in wenigen Schritten kündigst.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

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
      <TouchableOpacity
        style={styles.skipBtn}
        onPress={ueberspringen}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Onboarding überspringen"
      >
        <Text style={styles.skipText}>Überspringen</Text>
      </TouchableOpacity>

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
            <Text style={styles.text}>{step.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots} accessible accessibilityLabel={`Schritt ${page + 1} von ${STEPS.length}`}>
        {STEPS.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={beispielAnsehen}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Beispiel ansehen, zeigt Beispieldaten ohne eigenen API Key"
        >
          <Text style={styles.ctaText}>Beispiel ansehen →</Text>
        </TouchableOpacity>
        <Text style={styles.ctaHint}>Ohne Anmeldung, ohne eigenen API Key</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, justifyContent: 'space-between' },
  pager: { flexGrow: 0 },

  skipBtn: {
    position: 'absolute', top: 56, right: 24, zIndex: 1,
    minHeight: 44, justifyContent: 'center',
  },
  skipText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },

  slide: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, paddingTop: 96, paddingBottom: 24,
  },
  icon: { fontSize: 64, marginBottom: 28 },
  title: {
    fontSize: 24, fontWeight: '800', color: colors.textPrimary,
    textAlign: 'center', letterSpacing: -0.5, marginBottom: 14,
  },
  text: {
    fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: 24,
  },

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
  ctaHint: { fontSize: 12, color: colors.textTertiary, marginTop: 12 },
});
