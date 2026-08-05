import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, Linking, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '../constants/theme';
import { getApiKey, setApiKey, clearApiKey } from '../utils/storage';

export default function SettingsScreen() {
  const router = useRouter();
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);
  const [hasKey, setHasKey] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const existing = getApiKey();
    if (existing) {
      setKey(existing);
      setHasKey(true);
    }
  }, []);

  function save() {
    const trimmed = key.trim();
    if (!trimmed.startsWith('sk-ant-')) {
      Alert.alert(
        'Ungültiger Key',
        'Anthropic API Keys beginnen mit „sk-ant-". Bitte prüfe deinen Key auf console.anthropic.com.',
      );
      return;
    }
    setApiKey(trimmed);
    setHasKey(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function remove() {
    Alert.alert(
      'API Key löschen?',
      'Du wechselst in den Demo-Modus. Screenshots und Uploads werden nicht mehr echt analysiert.',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen', style: 'destructive',
          onPress: () => {
            clearApiKey();
            setKey('');
            setHasKey(false);
          },
        },
      ],
    );
  }

  function openConsole() {
    const url = 'https://console.anthropic.com/settings/keys';
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Zurück</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Einstellungen</Text>

      {/* Status card */}
      <View style={[styles.statusCard, hasKey ? styles.statusCardActive : styles.statusCardDemo]}>
        <Text style={styles.statusIcon}>{hasKey ? '✅' : '🔵'}</Text>
        <View style={styles.statusText}>
          <Text style={[styles.statusTitle, hasKey ? styles.statusTitleActive : styles.statusTitleDemo]}>
            {hasKey ? 'Echte KI-Analyse aktiv' : 'Demo-Modus aktiv'}
          </Text>
          <Text style={styles.statusSub}>
            {hasKey
              ? 'Deine Screenshots und Uploads werden mit Claude analysiert.'
              : 'Trage deinen Anthropic API Key ein, um echte Abos zu erkennen.'}
          </Text>
        </View>
      </View>

      {/* API Key section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔑 Anthropic API Key</Text>
        <Text style={styles.sectionDesc}>
          Der Key wird nur auf deinem Gerät gespeichert und nie weitergegeben. Er wird ausschließlich für die Abo-Analyse verwendet.
        </Text>

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="sk-ant-api03-..."
            placeholderTextColor={colors.textTertiary}
            value={key}
            onChangeText={setKey}
            secureTextEntry={!showKey}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowKey(v => !v)}>
            <Text style={styles.eyeIcon}>{showKey ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnSuccess]}
          onPress={save}
          activeOpacity={0.85}
        >
          <Text style={styles.saveBtnText}>{saved ? '✓ Gespeichert!' : 'Speichern'}</Text>
        </TouchableOpacity>

        {hasKey && (
          <TouchableOpacity style={styles.deleteBtn} onPress={remove}>
            <Text style={styles.deleteBtnText}>Key löschen</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* How to get a key */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wo bekomme ich einen Key?</Text>

        <View style={styles.stepsBox}>
          {[
            'console.anthropic.com öffnen',
            'Konto erstellen oder einloggen',
            'Links auf „API Keys" klicken',
            '„Create Key" drücken',
            'Key hier einfügen und speichern',
          ].map((step, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.consoleBtn} onPress={openConsole} activeOpacity={0.8}>
          <Text style={styles.consoleBtnText}>console.anthropic.com öffnen →</Text>
        </TouchableOpacity>

        <View style={styles.costBox}>
          <Text style={styles.costIcon}>💰</Text>
          <Text style={styles.costText}>
            Kosten: ca. 1–3 Cent pro Analyse. Neue Konten erhalten $5 Gratisguthaben — das reicht für hunderte Analysen.
          </Text>
        </View>
      </View>

      {/* Privacy */}
      <View style={styles.privacyBox}>
        <Text style={styles.privacyTitle}>🔒 Datenschutz</Text>
        <Text style={styles.privacyText}>
          Dein API Key wird ausschließlich lokal auf deinem Gerät gespeichert. Kündigo sendet ihn nur direkt an die Anthropic API — niemals an eigene Server. Deine Kontoauszüge und Screenshots verlassen dein Gerät nur für die KI-Analyse und werden nicht gespeichert.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24, paddingTop: 60, paddingBottom: 64 },

  backBtn: { marginBottom: 24 },
  backText: { color: colors.textSecondary, fontSize: 15 },

  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginBottom: 24, letterSpacing: -0.7 },

  // Status card
  statusCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    borderRadius: 16, padding: 18, marginBottom: 28,
    borderWidth: 1.5,
  },
  statusCardActive: {
    backgroundColor: `${colors.accent}10`,
    borderColor: `${colors.accent}40`,
  },
  statusCardDemo: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  statusIcon: { fontSize: 24 },
  statusText: { flex: 1 },
  statusTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  statusTitleActive: { color: colors.accent },
  statusTitleDemo: { color: colors.textPrimary },
  statusSub: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  // Section
  section: {
    backgroundColor: colors.surface, borderRadius: 16,
    padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border, gap: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sectionDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface2, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  input: {
    flex: 1, color: colors.textPrimary, fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    fontFamily: 'monospace',
  },
  eyeBtn: { padding: 12 },
  eyeIcon: { fontSize: 16 },

  // Save button
  saveBtn: {
    backgroundColor: colors.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  saveBtnSuccess: { backgroundColor: colors.accentDark },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: colors.bg },

  // Delete button
  deleteBtn: { alignItems: 'center', paddingVertical: 4 },
  deleteBtnText: { fontSize: 13, color: colors.danger, fontWeight: '500' },

  // Steps
  stepsBox: { gap: 10 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: `${colors.accent}20`,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  stepNumText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  stepText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  // Console button
  consoleBtn: {
    backgroundColor: `${colors.accent}15`, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: `${colors.accent}30`,
  },
  consoleBtnText: { fontSize: 14, fontWeight: '600', color: colors.accent },

  // Cost note
  costBox: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: colors.surface2, borderRadius: 10, padding: 12,
  },
  costIcon: { fontSize: 14 },
  costText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  // Privacy
  privacyBox: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.border, gap: 8,
  },
  privacyTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  privacyText: { fontSize: 12, color: colors.textTertiary, lineHeight: 19 },
});
