import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors } from '../constants/theme';
import { getApiKey, loadOnboarded } from '../utils/storage';
import { monthlyAmount } from '../utils/analyzeSubscriptions';
import { loadResults } from '../utils/resultStore';
import { fetchQuota, getCachedQuota, quotaAvailable, type Quota } from '../utils/quota';

function formatEur(amount: number) {
  return `€${amount.toFixed(2).replace('.', ',')}`;
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const narrow = width < 380;
  const hasKey = !!getApiKey();
  const [savedCount, setSavedCount] = useState(0);
  const [savedMonthly, setSavedMonthly] = useState(0);
  const [quota, setQuota] = useState<Quota | null>(getCachedQuota());

  // Nur beim allerersten Start: Onboarding zeigen, danach nie wieder
  // (Flag kuendigo_onboarded). Aus den Einstellungen bleibt es aufrufbar.
  useEffect(() => {
    (async () => {
      const onboarded = await loadOnboarded();
      if (!onboarded) router.replace('/onboarding');
    })();
  }, []);

  // Gespeicherte Abos bei jedem Fokus neu laden (z. B. nach dem Löschen)
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const subs = await loadResults();
        if (!alive) return;
        setSavedCount(subs.length);
        setSavedMonthly(subs.reduce((sum, s) => sum + monthlyAmount(s), 0));
        const q = await fetchQuota();
        if (alive && q) setQuota(q);
      })();
      return () => { alive = false; };
    }, [])
  );

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.container, { paddingHorizontal: narrow ? 20 : 32 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Settings button */}
      <TouchableOpacity
        style={styles.settingsBtn}
        onPress={() => router.push('/settings')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Einstellungen öffnen"
      >
        <Text style={styles.settingsIcon}>⚙️</Text>
      </TouchableOpacity>

      {/* Freikontingent */}
      {!hasKey && quotaAvailable() && (
        <TouchableOpacity
          style={styles.freeBadge}
          onPress={() => router.push('/settings')}
          hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Freikontingent, Einstellungen öffnen"
        >
          <Text style={styles.freeBadgeText}>
            {quota
              ? `🎁 ${quota.remaining} von ${quota.limit} Analysen frei`
              : '🎁 3 Analysen pro Monat gratis'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Background rings (decorative) */}
      <View style={styles.ring3} />
      <View style={styles.ring2} />
      <View style={styles.ring1} />

      {/* Logo */}
      <View style={styles.logoWrap}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoLetter}>K</Text>
        </View>
      </View>

      {/* Wordmark */}
      <Text style={styles.appName}>Kündigo</Text>
      <Text style={styles.tagline}>Alle Abos. Ein Blick.</Text>

      {/* Description */}
      <Text style={styles.description}>
        Lade deinen Kontoauszug hoch.{'\n'}
        Kündigo findet alle Abos{'\n'}
        die du vergessen hast.
      </Text>

      {/* Gespeicherte Abos */}
      {savedCount > 0 && (
        <TouchableOpacity
          style={styles.savedCard}
          onPress={() => router.push('/results')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Gespeicherte Abos ansehen, ${savedCount} ${savedCount === 1 ? 'Abo' : 'Abos'}, ${formatEur(savedMonthly)} pro Monat`}
        >
          <View style={styles.savedLeft}>
            <Text style={styles.savedLabel}>Deine gespeicherten Abos</Text>
            <Text style={styles.savedValue}>
              {savedCount} {savedCount === 1 ? 'Abo' : 'Abos'} · {formatEur(savedMonthly)} / Monat
            </Text>
          </View>
          <Text style={styles.savedArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Erfahrungswerte, ausdrücklich als Schätzung gekennzeichnet */}
      <View style={styles.statsCard}>
        <Text style={styles.statsHeading}>Schätzwerte</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>ca. €158</Text>
            <Text style={styles.statLabel}>pro Monat</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>8 bis 12</Text>
            <Text style={styles.statLabel}>vergessene Abos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>ca. 2 min</Text>
            <Text style={styles.statLabel}>bis zum Ergebnis</Text>
          </View>
        </View>
        <Text style={styles.statsSource}>
          Grobe Durchschnittsschätzung aus Erfahrungswerten, keine eigene Erhebung. Deine echten
          Zahlen siehst du nach der Analyse.
        </Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => router.push('/upload')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Jetzt analysieren"
      >
        <Text style={styles.ctaText}>Jetzt analysieren →</Text>
      </TouchableOpacity>

      {/* Datenschutzhinweis: die Analyse überträgt Inhalte, das muss hier stehen */}
      <Text style={styles.privacyNote}>
        🔒 Deine Abo-Liste bleibt lokal auf deinem Gerät. Inhalte für die Analyse werden
        verschlüsselt an unseren KI-Dienstleister Anthropic (USA) gesendet und von uns nicht
        gespeichert.{' '}
        <Text
          style={styles.privacyNoteLink}
          onPress={() => router.push('/datenschutz')}
          accessibilityRole="link"
        >
          Zur Datenschutzerklärung
        </Text>
      </Text>

      {/* Rechtliches */}
      <View style={styles.footerLinks}>
        <TouchableOpacity
          onPress={() => router.push('/impressum')}
          hitSlop={{ top: 16, bottom: 16, left: 14, right: 14 }}
          accessibilityRole="button"
          accessibilityLabel="Impressum öffnen"
        >
          <Text style={styles.footerLink}>Impressum</Text>
        </TouchableOpacity>
        <Text style={styles.footerSeparator}>·</Text>
        <TouchableOpacity
          onPress={() => router.push('/datenschutz')}
          hitSlop={{ top: 16, bottom: 16, left: 14, right: 14 }}
          accessibilityRole="button"
          accessibilityLabel="Datenschutzerklärung öffnen"
        >
          <Text style={styles.footerLink}>Datenschutz</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  // flexGrow statt flex, damit der Inhalt auf großen Bildschirmen mittig steht
  // und auf schmalen scrollbar bleibt, statt abgeschnitten zu werden.
  container: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 96,
    overflow: 'hidden',
  },

  // Decorative background rings
  ring1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: `${colors.accent}20`,
    top: '30%',
    alignSelf: 'center',
  },
  ring2: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    borderWidth: 1,
    borderColor: `${colors.accent}10`,
    top: '25%',
    alignSelf: 'center',
  },
  ring3: {
    position: 'absolute',
    width: 540,
    height: 540,
    borderRadius: 270,
    borderWidth: 1,
    borderColor: `${colors.accent}08`,
    top: '18%',
    alignSelf: 'center',
  },

  // Logo
  logoWrap: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 38,
    fontWeight: '800',
    color: colors.bg,
    letterSpacing: -1,
  },

  // Text
  appName: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -1.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 20,
    letterSpacing: 0.2,
  },
  description: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 36,
  },

  // Gespeicherte Abos
  savedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: `${colors.accent}12`,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    width: '100%',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${colors.accent}35`,
  },
  savedLeft: { flex: 1 },
  savedLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  savedValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  savedArrow: {
    fontSize: 20,
    color: colors.accent,
    fontWeight: '700',
    marginLeft: 12,
  },

  // Schätzwerte
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    width: '100%',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statsHeading: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  statsSource: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },

  // CTA
  ctaButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 40,
    width: '100%',
    alignItems: 'center',
    marginBottom: 16,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.bg,
    letterSpacing: 0.2,
  },

  // Datenschutzhinweis
  privacyNote: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    lineHeight: 18,
  },
  privacyNoteLink: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },

  // Rechtliches im Fuß
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  footerLink: {
    fontSize: 12,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  footerSeparator: {
    fontSize: 12,
    color: colors.textTertiary,
  },

  // Settings
  settingsBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    padding: 8,
  },
  settingsIcon: { fontSize: 22 },

  // Freikontingent
  freeBadge: {
    position: 'absolute',
    top: 56,
    left: 24,
    backgroundColor: `${colors.accent}18`,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: `${colors.accent}35`,
  },
  freeBadgeText: {
    fontSize: 12,
    color: colors.accent,
    fontWeight: '600',
  },
});
