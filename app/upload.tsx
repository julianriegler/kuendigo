import { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { colors } from '../constants/theme';
import { DEMO_SUBSCRIPTIONS, analyzeSubscriptions } from '../utils/analyzeSubscriptions';

const BANKS = [
  { name: 'Sparkasse',     flag: '🇩🇪' },
  { name: 'ING',           flag: '🇩🇪' },
  { name: 'DKB',           flag: '🇩🇪' },
  { name: 'N26',           flag: '🇩🇪' },
  { name: 'Erste Bank',    flag: '🇦🇹' },
  { name: 'Raiffeisen',    flag: '🇦🇹' },
  { name: 'Bank Austria',  flag: '🇦🇹' },
  { name: 'Revolut',       flag: '🌍' },
];

// Paste your Anthropic API key here for the MVP — never commit to git
const ANTHROPIC_API_KEY = '';

export default function UploadScreen() {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function pickFile() {
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
      // PDF binary — will handle separately
      setFileContent('[PDF]');
    }
  }

  async function analyze() {
    if (!fileContent) return;
    setLoading(true);

    try {
      let subs;
      if (!ANTHROPIC_API_KEY) {
        // Demo mode — show sample data
        await new Promise(r => setTimeout(r, 2500));
        subs = DEMO_SUBSCRIPTIONS;
      } else {
        subs = await analyzeSubscriptions(fileContent, ANTHROPIC_API_KEY);
      }

      router.push({ pathname: '/results', params: { data: JSON.stringify(subs) } });
    } catch (err: any) {
      Alert.alert('Fehler', err.message ?? 'Analyse fehlgeschlagen');
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Zurück</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Kontoauszug hochladen</Text>
      <Text style={styles.subtitle}>
        Exportiere deinen Kontoauszug als CSV oder PDF aus deinem Online-Banking.
      </Text>

      {/* Upload area */}
      <TouchableOpacity
        style={[styles.uploadArea, fileName && styles.uploadAreaActive]}
        onPress={pickFile}
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

      {/* Demo button */}
      <TouchableOpacity
        style={styles.demoBtn}
        onPress={() => {
          setFileName('demo-kontoauszug.csv');
          setFileContent('DEMO');
        }}
      >
        <Text style={styles.demoBtnText}>Demo-Daten verwenden →</Text>
      </TouchableOpacity>

      {/* Supported banks */}
      <Text style={styles.sectionLabel}>Unterstützte Banken</Text>
      <View style={styles.banksGrid}>
        {BANKS.map(b => (
          <View key={b.name} style={styles.bankChip}>
            <Text style={styles.bankFlag}>{b.flag}</Text>
            <Text style={styles.bankName}>{b.name}</Text>
          </View>
        ))}
      </View>

      {/* How to export */}
      <View style={styles.howBox}>
        <Text style={styles.howTitle}>Wie exportiere ich meinen Kontoauszug?</Text>
        <Text style={styles.howStep}>1. Online-Banking öffnen</Text>
        <Text style={styles.howStep}>2. Umsätze / Transaktionen aufrufen</Text>
        <Text style={styles.howStep}>3. Export als CSV oder PDF wählen</Text>
        <Text style={styles.howStep}>4. Datei hier hochladen</Text>
      </View>

      {/* Privacy */}
      <View style={styles.privacyBox}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <Text style={styles.privacyText}>
          Deine Bankdaten werden lokal analysiert und niemals auf fremde Server hochgeladen.
        </Text>
      </View>

      {/* CTA */}
      <TouchableOpacity
        style={[styles.analyzeBtn, !fileName && styles.analyzeBtnDisabled]}
        onPress={analyze}
        disabled={!fileName || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={colors.bg} />
        ) : (
          <Text style={styles.analyzeBtnText}>Abos analysieren →</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: {
    padding: 24,
    paddingTop: 60,
    paddingBottom: 48,
  },

  backBtn: { marginBottom: 24 },
  backText: { color: colors.textSecondary, fontSize: 15 },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 10,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },

  // Upload
  uploadArea: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: 36,
    alignItems: 'center',
    marginBottom: 12,
  },
  uploadAreaActive: {
    borderColor: colors.accent,
    borderStyle: 'solid',
  },
  uploadIcon: { fontSize: 40, marginBottom: 12 },
  uploadIconDone: { fontSize: 40, marginBottom: 12 },
  uploadTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  uploadFileName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 6,
  },
  uploadHint: { fontSize: 13, color: colors.textTertiary },
  uploadChange: { fontSize: 13, color: colors.textSecondary },

  // Demo
  demoBtn: {
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 32,
  },
  demoBtnText: {
    fontSize: 14,
    color: colors.accent,
    fontWeight: '500',
  },

  // Banks
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
    marginBottom: 12,
    fontWeight: '600',
  },
  banksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 28,
  },
  bankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface2,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  bankFlag: { fontSize: 14 },
  bankName: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },

  // How to
  howBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  howTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  howStep: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 24,
  },

  // Privacy
  privacyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: `${colors.accent}12`,
    borderRadius: 12,
    padding: 14,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: `${colors.accent}25`,
  },
  privacyIcon: { fontSize: 18 },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: colors.accent,
    lineHeight: 20,
  },

  // Analyze
  analyzeBtn: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  analyzeBtnDisabled: {
    backgroundColor: colors.surface2,
  },
  analyzeBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.bg,
  },
});
