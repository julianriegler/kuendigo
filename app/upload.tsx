import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, TextInput, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { colors } from '../constants/theme';
import {
  analyzeStatement, analyzeScreenshot, analyzeEmails,
} from '../utils/analyzeSubscriptions';
import { getApiKey } from '../utils/storage';
import { mergeResults } from '../utils/resultStore';
import { fetchQuota, getCachedQuota, quotaAvailable, type Quota } from '../utils/quota';
import {
  loadConsent, getConsent, isConsentLoaded, isConsentValid, grantConsent,
} from '../utils/consent';
import { ConsentModal } from '../components/ConsentModal';

/** Anzeige, solange der Serverstand noch nicht abgefragt wurde. */
const FREE_ANALYSES_HINT = 3;

/** Beispiel-Kontoauszug für den Ausprobier-Link. */
const SAMPLE_STATEMENT = [
  '15.07.2026;NETFLIX INTL BV;-13,99',
  '20.07.2026;SPOTIFY AB;-9,99',
  '01.07.2026;ADOBE SYSTEMS;-54,99',
  '10.07.2026;AMAZON PRIME;-8,99',
  '05.07.2026;MICROSOFT XBOX GAMEPASS;-14,99',
  '22.07.2026;BILLA PLUS EINKAUF;-63,20',
].join('\n');

// ─── Image helpers (web only) ────────────────────────────────────────────────

/** Resize a base64 image to max 1600px on longest side, returns JPEG base64 */
async function resizeImageWeb(base64: string, mime: string): Promise<string> {
  if (typeof document === 'undefined') return base64;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1600;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82).split(',')[1]);
    };
    img.onerror = () => resolve(base64);
    img.src = `data:${mime};base64,${base64}`;
  });
}

/** Open a native <input type="file"> on web and return the chosen image */
function pickImageWeb(): Promise<{ base64: string; mime: string; name: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = 'image/*';
    input.onchange = async (e: any) => {
      const file: File | undefined = e.target?.files?.[0];
      if (!file) { resolve(null); return; }
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const raw = dataUrl.split(',')[1];
        const resized = await resizeImageWeb(raw, file.type);
        resolve({ base64: resized, mime: 'image/jpeg', name: file.name });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    // If the user cancels the dialog without picking a file
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

// ─── Source definitions ──────────────────────────────────────────────────────

type SourceType = 'file' | 'screenshot' | 'text' | 'manual';

interface Source {
  id: string;
  icon: string;
  title: string;
  sub: string;
  badge: string | null;
  type: SourceType;
  steps: string[];
  tip: string | null;
}

const SOURCES: Source[] = [
  {
    id: 'iphone',
    icon: '📱',
    title: 'iPhone Abonnements',
    sub: 'Alle App Store Abos auf einmal',
    badge: '⭐ Top-Tipp',
    type: 'screenshot',
    steps: [
      'Einstellungen öffnen',
      'Oben auf deinen Namen tippen',
      '„Abonnements" auswählen',
      'Screenshot machen & hier hochladen',
    ],
    tip: 'Zeigt ALLE aktiven App-Store-Abos auf einem einzigen Screen — der schnellste Weg.',
  },
  {
    id: 'googleplay',
    icon: '🤖',
    title: 'Google Play',
    sub: 'Alle Android Abos',
    badge: '⭐ Top-Tipp',
    type: 'screenshot',
    steps: [
      'Play Store App öffnen',
      'Auf dein Profilbild tippen (oben rechts)',
      '„Abonnements" auswählen',
      'Screenshot machen & hier hochladen',
    ],
    tip: 'Zeigt alle aktiven Abos aus Android-Apps — inklusive Abos die du vergessen hast.',
  },
  {
    id: 'kreditkarte',
    icon: '💳',
    title: 'Kreditkarte',
    sub: 'Abrechnung hochladen',
    badge: 'Wichtig',
    type: 'file',
    steps: [
      'Kreditkarten-App öffnen (Visa, Mastercard, Amex…)',
      'Zu Abrechnungen / Umsätze navigieren',
      'Monatsabrechnung als CSV oder PDF exportieren',
      'Datei hier hochladen',
    ],
    tip: 'Viele US-Dienste (Netflix, Adobe, Spotify) laufen auf Kreditkarte — nicht auf dem Girokonto!',
  },
  {
    id: 'paypal',
    icon: '🔵',
    title: 'PayPal Autopay',
    sub: 'Alle automatischen Zahlungen',
    badge: null,
    type: 'screenshot',
    steps: [
      'paypal.com im Browser öffnen',
      'Einstellungen → Zahlungen öffnen',
      '„Automatische Zahlungen" wählen',
      'Screenshot der Liste machen & hochladen',
    ],
    tip: 'PayPal versteckt Abos unter „Automatische Zahlungen" — oft der größte blinde Fleck.',
  },
  {
    id: 'girokonto',
    icon: '🏦',
    title: 'Girokonto',
    sub: 'CSV oder PDF hochladen',
    badge: null,
    type: 'file',
    steps: [
      'Online-Banking öffnen (George, Erste, Raiffeisen, N26…)',
      'Umsätze / Transaktionen aufrufen',
      'Export als CSV oder PDF wählen',
      'Datei hier hochladen',
    ],
    tip: null,
  },
  {
    id: 'email',
    icon: '📧',
    title: 'E-Mail',
    sub: 'Rechnungs-E-Mails einfügen',
    badge: null,
    type: 'text',
    steps: [
      'Gmail öffnen',
      'Suche: „Rechnung" oder „invoice" oder „receipt"',
      'E-Mail-Texte kopieren und hier einfügen',
    ],
    tip: null,
  },
  {
    id: 'manual',
    icon: '✏️',
    title: 'Manuell eingeben',
    sub: 'Abos selbst eintragen, KI ergänzt',
    badge: null,
    type: 'manual',
    steps: [],
    tip: null,
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function UploadScreen() {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKeyState] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(getCachedQuota());
  const [consentVisible, setConsentVisible] = useState(false);

  useEffect(() => {
    setApiKeyState(getApiKey());
    loadConsent();
    fetchQuota().then(q => { if (q) setQuota(q); });
  }, []);

  // File state (girokonto + kreditkarte)
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);

  // Screenshot state
  const [screenshotB64, setScreenshotB64] = useState<string | null>(null);
  const [screenshotMime, setScreenshotMime] = useState('image/jpeg');
  const [screenshotName, setScreenshotName] = useState<string | null>(null);

  // Email state
  const [emailText, setEmailText] = useState('');

  function selectSource(source: Source) {
    if (source.type === 'manual') {
      router.push('/manual');
      return;
    }
    // Reset input when switching source
    if (activeId !== source.id) {
      setFileName(null);
      setFileContent(null);
      setScreenshotB64(null);
      setScreenshotName(null);
      setEmailText('');
    }
    setActiveId(prev => prev === source.id ? null : source.id);
  }

  async function pickFile() {
    try {
      if (Platform.OS === 'web') {
        // Web: native file input
        await new Promise<void>((resolve) => {
          const input = document.createElement('input');
          input.type   = 'file';
          input.accept = '.csv,.txt,.pdf,text/csv,text/plain,application/pdf';
          input.onchange = (e: any) => {
            const file: File | undefined = e.target?.files?.[0];
            if (!file) { resolve(); return; }
            setFileName(file.name);
            const reader = new FileReader();
            reader.onload = () => { setFileContent(reader.result as string); resolve(); };
            reader.onerror = () => { setFileContent('[Lesefehler]'); resolve(); };
            // PDFs can't be read as text — just mark them
            if (file.type === 'application/pdf') {
              setFileContent('[PDF — wird mit KI analysiert]');
              resolve();
            } else {
              reader.readAsText(file, 'utf-8');
            }
          };
          input.addEventListener('cancel', () => resolve());
          input.click();
        });
      } else {
        // Native
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
          setFileContent('[PDF — wird mit KI analysiert]');
        }
      }
    } catch (err: any) {
      Alert.alert('Fehler', err?.message ?? 'Datei konnte nicht geöffnet werden.');
    }
  }

  async function pickScreenshot() {
    try {
      if (Platform.OS === 'web') {
        // Web: use native <input type="file"> — more reliable than expo-image-picker on web
        const picked = await pickImageWeb();
        if (!picked) return;
        setScreenshotB64(picked.base64);
        setScreenshotMime(picked.mime);
        setScreenshotName(picked.name);
      } else {
        // Native iOS / Android: use expo-image-picker
        const ImagePicker = await import('expo-image-picker');
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Berechtigung benötigt', 'Bitte erlaube den Zugriff auf deine Fotos.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          base64: true,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        // Resize before storing so the API call doesn't fail on large images
        const resized = asset.base64
          ? await resizeImageWeb(asset.base64, asset.mimeType ?? 'image/jpeg')
          : null;
        setScreenshotB64(resized);
        setScreenshotMime('image/jpeg');
        setScreenshotName(asset.fileName ?? 'screenshot.jpg');
      }
    } catch (err: any) {
      Alert.alert('Fehler beim Laden', err?.message ?? 'Foto konnte nicht geöffnet werden.');
    }
  }

  /**
   * Startet die Analyse erst, wenn die Einwilligung vorliegt. Fehlt sie,
   * öffnet sich die Abfrage und es wird nichts übertragen.
   */
  async function analyze() {
    const source = SOURCES.find(s => s.id === activeId);
    if (!source) return;

    const consent = isConsentLoaded() ? getConsent() : await loadConsent();
    if (!isConsentValid(consent)) {
      setConsentVisible(true);
      return;
    }
    await runAnalysis();
  }

  async function acceptConsent() {
    await grantConsent();
    setConsentVisible(false);
    await runAnalysis();
  }

  async function runAnalysis() {
    const source = SOURCES.find(s => s.id === activeId);
    if (!source) return;

    // Refresh key at analysis time (user might have set it in settings)
    const key = getApiKey();
    setApiKeyState(key);

    setErrorMsg(null);
    setLoading(true);
    try {
      // Der Serverschlüssel übernimmt, wenn kein eigener Key hinterlegt ist,
      // deshalb gibt es hier keinen Demo-Zweig mehr.
      let subs;
      if (source.type === 'file' && fileContent) {
        subs = await analyzeStatement(fileContent, key);
      } else if (source.type === 'screenshot' && screenshotB64) {
        subs = await analyzeScreenshot(screenshotB64, screenshotMime, key);
      } else if (source.type === 'text' && emailText.trim()) {
        subs = await analyzeEmails(emailText, key);
      } else {
        setErrorMsg('Bitte zuerst einen Kontoauszug, einen Screenshot oder E-Mail-Text hinzufügen.');
        return;
      }
      await mergeResults(subs ?? []);
      router.push('/results');
    } catch (err: any) {
      const msg: string = err?.message ?? 'Analyse fehlgeschlagen';
      setErrorMsg(msg);
      // Also try native Alert as fallback
      try { Alert.alert('Fehler', msg); } catch {}
    } finally {
      setLoading(false);
    }
  }

  const activeSource = SOURCES.find(s => s.id === activeId);
  const hasInput =
    (activeSource?.type === 'file' && !!fileName) ||
    (activeSource?.type === 'screenshot' && !!screenshotB64) ||
    (activeSource?.type === 'text' && emailText.trim().length > 20);

  return (
    <>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Zurück</Text>
      </TouchableOpacity>

      <View style={styles.headerRow}>
        <Text style={styles.title}>Wo sind deine Abos?</Text>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsLink}>
          <Text style={styles.settingsLinkIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.subtitle}>
        Abos verstecken sich an 5 verschiedenen Stellen. Wähle eine Quelle — oder mehrere nacheinander.
      </Text>

      {/* Freikontingent */}
      {!apiKey && quotaAvailable() && (
        <TouchableOpacity style={styles.quotaBanner} onPress={() => router.push('/settings')} activeOpacity={0.8}>
          <Text style={styles.quotaBannerIcon}>🎁</Text>
          <View style={styles.quotaBannerText}>
            <Text style={styles.quotaBannerTitle}>
              {quota
                ? `Noch ${quota.remaining} von ${quota.limit} Gratis-Analysen diesen Monat`
                : `${FREE_ANALYSES_HINT} Gratis-Analysen pro Monat`}
            </Text>
            <Text style={styles.quotaBannerSub}>
              Danach eigenen API Key eintragen oder Pro holen. Tippe hier für die Einstellungen.
            </Text>
          </View>
          <Text style={styles.quotaBannerArrow}>→</Text>
        </TouchableOpacity>
      )}

      {/* Error banner */}
      {errorMsg && (
        <TouchableOpacity style={styles.errorBanner} onPress={() => setErrorMsg(null)} activeOpacity={0.8}>
          <Text style={styles.errorBannerIcon}>❌</Text>
          <Text style={styles.errorBannerText}>{errorMsg}</Text>
          <Text style={styles.errorBannerClose}>✕</Text>
        </TouchableOpacity>
      )}

      {/* Coverage hint */}
      <View style={styles.coverageBar}>
        <Text style={styles.coverageIcon}>💡</Text>
        <Text style={styles.coverageText}>
          Für 100% Abdeckung: iPhone-Abonnements + Kreditkarte + PayPal prüfen
        </Text>
      </View>

      {/* Source list */}
      {SOURCES.map(source => {
        const isActive = activeId === source.id;
        return (
          <View key={source.id}>
            <TouchableOpacity
              style={[styles.sourceCard, isActive && styles.sourceCardActive]}
              onPress={() => selectSource(source)}
              activeOpacity={0.75}
            >
              <View style={styles.sourceLeft}>
                <Text style={styles.sourceIcon}>{source.icon}</Text>
                <View style={styles.sourceText}>
                  <View style={styles.sourceTitleRow}>
                    <Text style={[styles.sourceTitle, isActive && styles.sourceTitleActive]}>
                      {source.title}
                    </Text>
                    {source.badge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{source.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.sourceSub}>{source.sub}</Text>
                </View>
              </View>
              <Text style={[styles.chevron, isActive && styles.chevronActive]}>
                {isActive ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {/* Expanded panel */}
            {isActive && (
              <View style={styles.panel}>
                {/* Steps */}
                {source.steps.length > 0 && (
                  <View style={styles.stepsBox}>
                    {source.steps.map((step, i) => (
                      <View key={i} style={styles.step}>
                        <View style={styles.stepNum}>
                          <Text style={styles.stepNumText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.stepText}>{step}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Tip */}
                {source.tip && (
                  <View style={styles.tipBox}>
                    <Text style={styles.tipIcon}>💡</Text>
                    <Text style={styles.tipText}>{source.tip}</Text>
                  </View>
                )}

                {/* Input: file */}
                {source.type === 'file' && (
                  <>
                    <TouchableOpacity
                      style={[styles.uploadArea, fileName && styles.uploadAreaDone]}
                      onPress={pickFile}
                      activeOpacity={0.8}
                    >
                      {fileName ? (
                        <>
                          <Text style={styles.uploadIconLg}>✅</Text>
                          <Text style={styles.uploadDoneText}>{fileName}</Text>
                          <Text style={styles.uploadChangeText}>Andere Datei wählen</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.uploadIconLg}>📂</Text>
                          <Text style={styles.uploadPromptText}>Datei auswählen</Text>
                          <Text style={styles.uploadHint}>CSV oder PDF</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.demoLink}
                      onPress={() => { setFileName('beispiel-auszug.csv'); setFileContent(SAMPLE_STATEMENT); }}
                    >
                      <Text style={styles.demoLinkText}>Beispiel-Auszug einsetzen →</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Input: screenshot */}
                {source.type === 'screenshot' && (
                  <>
                    <TouchableOpacity
                      style={[styles.uploadArea, screenshotB64 && styles.uploadAreaDone]}
                      onPress={pickScreenshot}
                      activeOpacity={0.8}
                    >
                      {screenshotB64 ? (
                        <>
                          <Text style={styles.uploadIconLg}>🖼️</Text>
                          <Text style={styles.uploadDoneText}>{screenshotName}</Text>
                          <Text style={styles.uploadChangeText}>Anderes Foto wählen</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.uploadIconLg}>📸</Text>
                          <Text style={styles.uploadPromptText}>Screenshot hochladen</Text>
                          <Text style={styles.uploadHint}>Foto aus deiner Galerie</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {/* Input: text/email */}
                {source.type === 'text' && (
                  <>
                    <View style={styles.emailBox}>
                      <TextInput
                        style={styles.emailInput}
                        multiline
                        placeholder={"E-Mail-Text hier einfügen…\n\nBeispiel:\n'Netflix Rechnung: €13,99 am 15.07.2026'\n'Spotify Premium monatlich: €9,99'"}
                        placeholderTextColor={colors.textTertiary}
                        value={emailText}
                        onChangeText={setEmailText}
                        textAlignVertical="top"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.demoLink}
                      onPress={() => setEmailText('Netflix Rechnung: €13,99 am 15.07.2026\nSpotify Premium monatlich €9,99 am 20.07.2026\nAdobe Creative Cloud €54,99 Rechnung Juli 2026\nAmazon Prime Mitgliedschaft €8,99 am 10.07.2026')}
                    >
                      <Text style={styles.demoLinkText}>Beispiel-Text einfügen →</Text>
                    </TouchableOpacity>
                  </>
                )}

                {/* Analyze button */}
                <TouchableOpacity
                  style={[
                    styles.analyzeBtn,
                    (!hasInput || loading) && styles.analyzeBtnDemo,
                  ]}
                  onPress={analyze}
                  disabled={loading || !hasInput}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color={colors.bg} />
                    : <Text style={styles.analyzeBtnText}>Abos analysieren →</Text>
                  }
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {/* Datenschutzhinweis vor der Übermittlung */}
      <View style={styles.privacyRow}>
        <Text style={styles.privacyIcon}>🔒</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.privacyText}>
            Für die Analyse gehen deine hochgeladenen Inhalte an Anthropic in den USA. Kündigo
            speichert sie nicht, die erkannten Abos bleiben auf deinem Gerät. Vor der ersten
            Analyse fragen wir dich einmal um deine Zustimmung.
          </Text>
          <TouchableOpacity onPress={() => router.push('/datenschutz')} activeOpacity={0.7}>
            <Text style={styles.privacyLink}>Details in der Datenschutzerklärung →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>

    <ConsentModal
      visible={consentVisible}
      onAccept={acceptConsent}
      onCancel={() => setConsentVisible(false)}
      onOpenPrivacy={() => {
        // Erst schließen, dann navigieren: das Modal hängt in einem Portal
        // und bliebe sonst über der Datenschutzerklärung liegen.
        setConsentVisible(false);
        setTimeout(() => router.push('/datenschutz'), 0);
      }}
    />
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingTop: 60, paddingBottom: 48 },

  backBtn: { marginBottom: 24 },
  backText: { color: colors.textSecondary, fontSize: 15 },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: {
    fontSize: 26, fontWeight: '800', color: colors.textPrimary,
    letterSpacing: -0.7, flex: 1,
  },
  settingsLink: { padding: 4 },
  settingsLinkIcon: { fontSize: 22 },

  subtitle: {
    fontSize: 14, color: colors.textSecondary,
    lineHeight: 20, marginBottom: 16,
  },

  // Freikontingent
  quotaBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: `${colors.accent}12`,
    borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: `${colors.accent}35`,
  },
  quotaBannerIcon: { fontSize: 18 },
  quotaBannerText: { flex: 1 },
  quotaBannerTitle: { fontSize: 13, fontWeight: '700', color: colors.accent, marginBottom: 2 },
  quotaBannerSub: { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  quotaBannerArrow: { fontSize: 16, color: colors.accent },

  // Coverage bar
  coverageBar: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: `${colors.accent}10`, borderRadius: 12,
    padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: `${colors.accent}25`,
  },
  coverageIcon: { fontSize: 15 },
  coverageText: { flex: 1, fontSize: 13, color: colors.accent, lineHeight: 19, fontWeight: '500' },

  // Source cards
  sourceCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: 14,
    padding: 16, marginBottom: 2,
    borderWidth: 1.5, borderColor: colors.border,
  },
  sourceCardActive: {
    borderColor: colors.accent,
    backgroundColor: `${colors.accent}08`,
    borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  sourceLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  sourceIcon: { fontSize: 24, width: 32, textAlign: 'center' },
  sourceText: { flex: 1 },
  sourceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  sourceTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  sourceTitleActive: { color: colors.accent },
  sourceSub: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },

  badge: {
    backgroundColor: `${colors.accent}25`, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.accent, letterSpacing: 0.3 },

  chevron: { fontSize: 10, color: colors.textTertiary, marginLeft: 8 },
  chevronActive: { color: colors.accent },

  // Expanded panel
  panel: {
    backgroundColor: `${colors.accent}05`,
    borderWidth: 1.5, borderTopWidth: 0, borderColor: colors.accent,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    padding: 16, gap: 12, marginBottom: 8,
  },

  // Steps
  stepsBox: { gap: 8 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  stepNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: `${colors.accent}20`,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  stepText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  // Tip
  tipBox: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    backgroundColor: colors.surface2, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  tipIcon: { fontSize: 14 },
  tipText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  // Upload area
  uploadArea: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border,
    borderRadius: 12, padding: 24, alignItems: 'center',
    backgroundColor: colors.surface,
  },
  uploadAreaDone: { borderColor: colors.accent, borderStyle: 'solid' },
  uploadIconLg: { fontSize: 32, marginBottom: 8 },
  uploadPromptText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 4 },
  uploadDoneText: { fontSize: 13, fontWeight: '600', color: colors.accent, marginBottom: 4 },
  uploadChangeText: { fontSize: 12, color: colors.textSecondary },
  uploadHint: { fontSize: 12, color: colors.textTertiary },

  // Demo link
  demoLink: { alignItems: 'center', paddingVertical: 4 },
  demoLinkText: { fontSize: 13, color: colors.accent, fontWeight: '500' },

  // Email
  emailBox: {
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  emailInput: {
    color: colors.textPrimary, fontSize: 14, lineHeight: 22,
    padding: 14, minHeight: 150,
  },

  // Analyze button
  analyzeBtn: {
    backgroundColor: colors.accent, borderRadius: 12,
    paddingVertical: 16, alignItems: 'center',
  },
  analyzeBtnDemo: { backgroundColor: colors.accentDark },
  analyzeBtnText: { fontSize: 15, fontWeight: '700', color: colors.bg },

  // Error banner
  errorBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: `${colors.danger}15`,
    borderRadius: 12, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: `${colors.danger}40`,
  },
  errorBannerIcon: { fontSize: 16 },
  errorBannerText: { flex: 1, fontSize: 13, color: colors.danger, lineHeight: 19 },
  errorBannerClose: { fontSize: 13, color: colors.danger },

  // Privacy
  privacyRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 16,
  },
  privacyIcon: { fontSize: 13 },
  privacyText: { fontSize: 12, color: colors.textTertiary, lineHeight: 18 },
  privacyLink: {
    fontSize: 12, color: colors.accent, lineHeight: 18,
    marginTop: 4, textDecorationLine: 'underline',
  },
});
