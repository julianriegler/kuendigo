import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { colors } from '../constants/theme';
import {
  analyzeStatement, analyzeScreenshot, analyzeEmails,
  DEMO_SUBSCRIPTIONS,
} from '../utils/analyzeSubscriptions';

// ← Trage hier deinen Anthropic API Key ein
const ANTHROPIC_API_KEY = '';

type Method = 'statement' | 'screenshot' | 'email' | 'manual' | null;

const METHODS = [
  {
    id: 'statement' as Method,
    icon: '📄',
    title: 'Kontoauszug',
    sub: 'CSV oder PDF hochladen',
  },
  {
    id: 'screenshot' as Method,
    icon: '📸',
    title: 'Screenshot',
    sub: 'Foto der Banking-App',
  },
  {
    id: 'email' as Method,
    icon: '📧',
    title: 'E-Mail',
    sub: 'Rechnungs-E-Mails einfügen',
  },
  {
    id: 'manual' as Method,
    icon: '✏️',
    title: 'Manuell',
    sub: 'Abos selbst eintragen',
  },
];

export default function UploadScreen() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>(null);
  const [loading, setLoading] = useState(false);

  // Statement state
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  // Screenshot state
  const [screenshotB64, setScreenshotB64] = useState<string | null>(null);
  const [screenshotMime, setScreenshotMime] = useState('image/jpeg');
  const [screenshotName, setScreenshotName] = useState<string | null>(null);

  // Email state
  const [emailText, setEmailText] = useState('');

  async function pickStatement() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/plain', 'application/pdf'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFileName(asset.name);
    try {
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      setFileContent(content);
    } catch {
      setFileContent('[PDF]');
    }
  }

  async function pickScreenshot() {
    // Dynamic import so the module only loads when needed
    const ImagePicker = await import('expo-image-picker');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Bitte erlaube den Zugriff auf deine Fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setScreenshotB64(asset.base64 ?? null);
    setScreenshotMime(asset.mimeType ?? 'image/jpeg');
    setScreenshotName(asset.fileName ?? 'screenshot.jpg');
  }

  async function analyze() {
    setLoading(true);
    try {
      let subs;
      const useDemo = !ANTHROPIC_API_KEY;

      if (useDemo) {
        await new Promise(r => setTimeout(r, 2000));
        subs = DEMO_SUBSCRIPTIONS;
      } else if (method === 'statement' && fileContent) {
        subs = await analyzeStatement(fileContent, ANTHROPIC_API_KEY);
      } else if (method === 'screenshot' && screenshotB64) {
        subs = await analyzeScreenshot(screenshotB64, screenshotMime, ANTHROPIC_API_KEY);
      } else if (method === 'email' && emailText.trim()) {
        subs = await analyzeEmails(emailText, ANTHROPIC_API_KEY);
      } else {
        subs = DEMO_SUBSCRIPTIONS;
      }

      router.push({ pathname: '/results', params: { data: JSON.stringify(subs) } });
    } catch (err: any) {
      Alert.alert('Fehler', err.message ?? 'Analyse fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  const canAnalyze =
    (method === 'statement' && !!fileName) ||
    (method === 'screenshot' && !!screenshotB64) ||
    (method === 'email' && emailText.trim().length > 20);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Zurück</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Wie möchtest du starten?</Text>
      <Text style={styles.subtitle}>Wähle eine Methode — du kannst sie jederzeit wechseln.</Text>

      {/* 2×2 Method Grid */}
      <View style={styles.methodGrid}>
        {METHODS.map(m => (
          <TouchableOpacity
            key={m.id}
            style={[styles.methodCard, method === m.id && styles.methodCardActive]}
            onPress={() => {
              setMethod(m.id);
              if (m.id === 'manual') router.push('/manual');
            }}
            activeOpacity={0.75}
          >
            <Text style={styles.methodIcon}>{m.icon}</Text>
            <Text style={[styles.methodTitle, method === m.id && styles.methodTitleActive]}>
              {m.title}
            </Text>
            <Text style={styles.methodSub}>{m.sub}</Text>
            {method === m.id && m.id !== 'manual' && (
              <View style={styles.methodCheck}><Text style={styles.methodCheckText}>✓</Text></View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Kontoauszug ── */}
      {method === 'statement' && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.uploadArea, fileName && styles.uploadAreaActive]}
            onPress={pickStatement}
            activeOpacity={0.8}
          >
            {fileName ? (
              <>
                <Text style={styles.uploadIconDone}>✅</Text>
                <Text style={styles.uploadFileName}>{fileName}</Text>
                <Text style={styles.uploadChange}>Andere Datei wählen</Text>
              </>
            ) : (
              <>
                <Text style={styles.uploadIcon}>📄</Text>
                <Text style={styles.uploadTitle}>Datei auswählen</Text>
                <Text style={styles.uploadHint}>CSV oder PDF · max. 10 MB</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.demoBtn} onPress={() => { setFileName('demo.csv'); setFileContent('DEMO'); }}>
            <Text style={styles.demoBtnText}>Demo-Daten verwenden →</Text>
          </TouchableOpacity>

          <View style={styles.howBox}>
            <Text style={styles.howTitle}>Kontoauszug exportieren</Text>
            <Text style={styles.howStep}>1. Online-Banking öffnen</Text>
            <Text style={styles.howStep}>2. Umsätze / Transaktionen aufrufen</Text>
            <Text style={styles.howStep}>3. Export als CSV oder PDF wählen</Text>
            <Text style={styles.howStep}>4. Datei hier hochladen</Text>
          </View>
        </View>
      )}

      {/* ── Screenshot ── */}
      {method === 'screenshot' && (
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.uploadArea, screenshotB64 && styles.uploadAreaActive]}
            onPress={pickScreenshot}
            activeOpacity={0.8}
          >
            {screenshotB64 ? (
              <>
                <Text style={styles.uploadIconDone}>🖼️</Text>
                <Text style={styles.uploadFileName}>{screenshotName}</Text>
                <Text style={styles.uploadChange}>Anderes Foto wählen</Text>
              </>
            ) : (
              <>
                <Text style={styles.uploadIcon}>📸</Text>
                <Text style={styles.uploadTitle}>Foto auswählen</Text>
                <Text style={styles.uploadHint}>Screenshot der Banking-App</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.demoBtn} onPress={() => { setScreenshotB64('DEMO'); setScreenshotName('demo-screenshot.jpg'); }}>
            <Text style={styles.demoBtnText}>Demo-Daten verwenden →</Text>
          </TouchableOpacity>

          <View style={styles.howBox}>
            <Text style={styles.howTitle}>So machst du den Screenshot</Text>
            <Text style={styles.howStep}>1. Banking-App öffnen (George, N26, ING…)</Text>
            <Text style={styles.howStep}>2. Zu Umsätze / Transaktionen navigieren</Text>
            <Text style={styles.howStep}>3. Screenshot machen (Seitentaste + Lautstärke)</Text>
            <Text style={styles.howStep}>4. Screenshot hier hochladen</Text>
          </View>
        </View>
      )}

      {/* ── E-Mail ── */}
      {method === 'email' && (
        <View style={styles.section}>
          <View style={styles.emailBox}>
            <Text style={styles.emailLabel}>Rechnungs-E-Mails hier einfügen</Text>
            <TextInput
              style={styles.emailInput}
              multiline
              placeholder={"Öffne deine Rechnungs-E-Mails in Gmail,\nkopiere den Text und füge ihn hier ein.\n\nBeispiel:\n'Deine Netflix-Rechnung: €13,99 am 15.07.2026'\n'Spotify Premium – Monatliche Zahlung: €9,99'"}
              placeholderTextColor={colors.textTertiary}
              value={emailText}
              onChangeText={setEmailText}
              textAlignVertical="top"
            />
            {emailText.length > 0 && (
              <TouchableOpacity onPress={() => setEmailText('')} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕ Löschen</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={styles.demoBtn} onPress={() => setEmailText('Netflix Rechnung: €13,99 am 15.07.2026\nSpotify Premium monatlich €9,99 am 20.07.2026\nAdobe Creative Cloud €54,99 Rechnung Juli 2026\nAmazon Prime Mitgliedschaft €8,99 am 10.07.2026')}>
            <Text style={styles.demoBtnText}>Demo-Text einfügen →</Text>
          </TouchableOpacity>

          <View style={styles.howBox}>
            <Text style={styles.howTitle}>So findest du Rechnungs-E-Mails</Text>
            <Text style={styles.howStep}>1. Gmail öffnen</Text>
            <Text style={styles.howStep}>2. Suche: "Rechnung" oder "invoice" oder "receipt"</Text>
            <Text style={styles.howStep}>3. E-Mail-Texte kopieren und hier einfügen</Text>
          </View>

          <View style={styles.privacyBox}>
            <Text style={styles.privacyIcon}>🔒</Text>
            <Text style={styles.privacyText}>Deine E-Mail-Inhalte werden nur für die Analyse verwendet und nicht gespeichert.</Text>
          </View>
        </View>
      )}

      {/* ── Analyze Button ── */}
      {method && method !== 'manual' && (
        <TouchableOpacity
          style={[styles.analyzeBtn, !canAnalyze && !loading && styles.analyzeBtnDisabled]}
          onPress={analyze}
          disabled={(!canAnalyze && !ANTHROPIC_API_KEY === false) || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.analyzeBtnText}>Abos analysieren →</Text>
          }
        </TouchableOpacity>
      )}

      {/* Demo fallback when no API key */}
      {method && method !== 'manual' && !ANTHROPIC_API_KEY && !canAnalyze && (
        <TouchableOpacity style={styles.analyzeBtn} onPress={analyze} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color={colors.bg} />
            : <Text style={styles.analyzeBtnText}>Demo starten →</Text>
          }
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24, paddingTop: 60, paddingBottom: 48 },

  backBtn: { marginBottom: 24 },
  backText: { color: colors.textSecondary, fontSize: 15 },

  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginBottom: 8, letterSpacing: -0.7 },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 24 },

  // Method grid
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 28 },
  methodCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    borderColor: colors.border,
    position: 'relative',
  },
  methodCardActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}10` },
  methodIcon: { fontSize: 28, marginBottom: 10 },
  methodTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  methodTitleActive: { color: colors.accent },
  methodSub: { fontSize: 12, color: colors.textTertiary, lineHeight: 16 },
  methodCheck: {
    position: 'absolute', top: 10, right: 10,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  methodCheckText: { fontSize: 11, color: colors.bg, fontWeight: '800' },

  // Shared section
  section: { gap: 14 },

  // Upload area (statement + screenshot)
  uploadArea: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed',
    padding: 32, alignItems: 'center',
  },
  uploadAreaActive: { borderColor: colors.accent, borderStyle: 'solid' },
  uploadIcon: { fontSize: 36, marginBottom: 10 },
  uploadIconDone: { fontSize: 36, marginBottom: 10 },
  uploadTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  uploadFileName: { fontSize: 14, fontWeight: '600', color: colors.accent, marginBottom: 4 },
  uploadHint: { fontSize: 12, color: colors.textTertiary },
  uploadChange: { fontSize: 12, color: colors.textSecondary },

  // Demo
  demoBtn: { alignItems: 'center', paddingVertical: 8 },
  demoBtnText: { fontSize: 13, color: colors.accent, fontWeight: '500' },

  // Email
  emailBox: {
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  emailLabel: {
    fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase',
    color: colors.textTertiary, fontWeight: '700',
    padding: 14, paddingBottom: 8,
  },
  emailInput: {
    color: colors.textPrimary, fontSize: 14, lineHeight: 22,
    padding: 14, paddingTop: 4, minHeight: 180,
  },
  clearBtn: { padding: 12, alignItems: 'flex-end' },
  clearBtnText: { fontSize: 12, color: colors.danger },

  // How-to
  howBox: {
    backgroundColor: colors.surface, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: colors.border,
  },
  howTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  howStep: { fontSize: 13, color: colors.textSecondary, lineHeight: 24 },

  // Privacy
  privacyBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: `${colors.accent}10`, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: `${colors.accent}25`,
  },
  privacyIcon: { fontSize: 16 },
  privacyText: { flex: 1, fontSize: 12, color: colors.accent, lineHeight: 18 },

  // Analyze button
  analyzeBtn: {
    backgroundColor: colors.accent, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', marginTop: 8,
  },
  analyzeBtnDisabled: { backgroundColor: colors.surface2 },
  analyzeBtnText: { fontSize: 16, fontWeight: '700', color: colors.bg },
});
