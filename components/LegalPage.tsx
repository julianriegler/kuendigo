/**
 * Gemeinsames Layout für die Rechtsseiten (Impressum, Datenschutz):
 * scrollbar, im dunklen Kündigo-Theme, mit Zurück-Link und Abschnitten.
 */
import type { ReactNode } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';

export function LegalPage({
  title,
  subtitle,
  updatedAt,
  children,
}: {
  title: string;
  subtitle?: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        onPress={() => (router.canGoBack() ? router.back() : router.push('/'))}
        style={styles.backBtn}
      >
        <Text style={styles.backText}>← Zurück</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {children}

      {updatedAt ? <Text style={styles.updated}>Stand: {updatedAt}</Text> : null}
    </ScrollView>
  );
}

/** Ein Abschnitt mit Überschrift. */
export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{heading}</Text>
      {children}
    </View>
  );
}

/** Fließtext-Absatz. */
export function P({ children }: { children: ReactNode }) {
  return <Text style={styles.paragraph}>{children}</Text>;
}

/** Aufzählungspunkt. */
export function Bullet({ children }: { children: ReactNode }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

/** Feldzeile mit Beschriftung, für Anschrift und Kontakt im Impressum. */
export function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

/** Hinweis, dass hier noch echte Daten eingetragen werden müssen. */
export function PlaceholderNote({ children }: { children: ReactNode }) {
  return (
    <View style={styles.placeholderBox}>
      <Text style={styles.placeholderText}>{children}</Text>
    </View>
  );
}

/** Link auf eine andere Seite der App. */
export function InternalLink({ label, href }: { label: string; href: string }) {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.push(href as never)} activeOpacity={0.7}>
      <Text style={styles.link}>{label}</Text>
    </TouchableOpacity>
  );
}

export function ExternalLink({ label, url }: { label: string; url: string }) {
  async function open() {
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
      return;
    }
    if (await Linking.canOpenURL(url)) Linking.openURL(url);
  }
  return (
    <TouchableOpacity onPress={open} activeOpacity={0.7}>
      <Text style={styles.link}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24, paddingTop: 60, paddingBottom: 64 },

  backBtn: { marginBottom: 24 },
  backText: { color: colors.textSecondary, fontSize: 15 },

  title: {
    fontSize: 26, fontWeight: '800', color: colors.textPrimary,
    letterSpacing: -0.7, marginBottom: 8,
  },
  subtitle: {
    fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 20,
  },

  section: {
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 20, marginBottom: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 10,
  },
  paragraph: {
    fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 8,
  },

  bulletRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  bulletDot: { fontSize: 13, color: colors.accent, lineHeight: 20 },
  bulletText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  fieldRow: { marginBottom: 10 },
  fieldLabel: {
    fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase',
    color: colors.textTertiary, fontWeight: '700', marginBottom: 2,
  },
  fieldValue: { fontSize: 14, color: colors.textPrimary, lineHeight: 20 },

  placeholderBox: {
    backgroundColor: `${colors.warning}12`, borderRadius: 12, padding: 14,
    marginBottom: 14, borderWidth: 1, borderColor: `${colors.warning}35`,
  },
  placeholderText: { fontSize: 12, color: colors.warning, lineHeight: 18 },

  link: {
    fontSize: 13, color: colors.accent, lineHeight: 20,
    textDecorationLine: 'underline', marginBottom: 6,
  },

  updated: {
    fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginTop: 8,
  },
});
