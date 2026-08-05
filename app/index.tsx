import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import { getApiKey } from '../utils/storage';

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const hasKey = !!getApiKey();

  return (
    <View style={styles.container}>
      {/* Settings button */}
      <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/settings')}>
        <Text style={styles.settingsIcon}>⚙️</Text>
      </TouchableOpacity>

      {/* Demo mode badge */}
      {!hasKey && (
        <TouchableOpacity style={styles.demoBadge} onPress={() => router.push('/settings')}>
          <Text style={styles.demoBadgeText}>Demo-Modus · API Key eintragen →</Text>
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

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>Ø €158</Text>
          <Text style={styles.statLabel}>pro Monat</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>8–12</Text>
          <Text style={styles.statLabel}>vergessene Abos</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>2 min</Text>
          <Text style={styles.statLabel}>bis zum Ergebnis</Text>
        </View>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={() => router.push('/upload')}
        activeOpacity={0.85}
      >
        <Text style={styles.ctaText}>Jetzt analysieren →</Text>
      </TouchableOpacity>

      {/* Privacy note */}
      <Text style={styles.privacyNote}>
        🔒 Deine Daten werden nur auf deinem Gerät verarbeitet
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 8,
    width: '100%',
    marginBottom: 36,
    borderWidth: 1,
    borderColor: colors.border,
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
    fontSize: 11,
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

  // Privacy
  privacyNote: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  // Settings
  settingsBtn: {
    position: 'absolute',
    top: 56,
    right: 24,
    padding: 8,
  },
  settingsIcon: { fontSize: 22 },

  // Demo badge
  demoBadge: {
    position: 'absolute',
    top: 56,
    left: 24,
    backgroundColor: `${colors.warning}20`,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: `${colors.warning}40`,
  },
  demoBadgeText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
  },
});
