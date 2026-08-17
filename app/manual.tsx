import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, categories } from '../constants/theme';
import { autofillSubscription, POPULAR_SERVICES, Subscription } from '../utils/analyzeSubscriptions';
import { getApiKey } from '../utils/storage';
import { fetchQuota, getCachedQuota, quotaAvailable, type Quota } from '../utils/quota';
import {
  loadConsent, getConsent, isConsentLoaded, isConsentValid, grantConsent,
} from '../utils/consent';
import { ConsentModal } from '../components/ConsentModal';
import { mergeResults } from '../utils/resultStore';

const FREQUENCIES: { id: Subscription['frequency']; label: string }[] = [
  { id: 'monthly',   label: 'Monatlich' },
  { id: 'annual',    label: 'Jährlich' },
  { id: 'quarterly', label: 'Quartal' },
  { id: 'weekly',    label: 'Wöchentlich' },
];

const CATEGORY_KEYS = Object.keys(categories) as (keyof typeof categories)[];

export default function ManualScreen() {
  const router = useRouter();

  const [apiKey, setApiKeyState] = useState('');
  const [quota, setQuota] = useState<Quota | null>(getCachedQuota());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [consentVisible, setConsentVisible] = useState(false);
  const [pendingService, setPendingService] = useState<string | null>(null);
  useEffect(() => {
    setApiKeyState(getApiKey());
    loadConsent();
    fetchQuota().then(q => { if (q) setQuota(q); });
  }, []);

  // List of manually added subscriptions
  const [subs, setSubs] = useState<Subscription[]>([]);

  // Form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<Subscription['frequency']>('monthly');
  const [category, setCategory] = useState('streaming');
  const [autofilling, setAutofilling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter popular services by search
  const filteredServices = POPULAR_SERVICES.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  /** Auch das automatische Ergänzen überträgt Daten, also gilt dieselbe Sperre. */
  async function handleAutofill(serviceName: string) {
    setName(serviceName);
    const consent = isConsentLoaded() ? getConsent() : await loadConsent();
    if (!isConsentValid(consent)) {
      setPendingService(serviceName);
      setConsentVisible(true);
      return;
    }
    await runAutofill(serviceName);
  }

  async function acceptConsent() {
    await grantConsent();
    setConsentVisible(false);
    const service = pendingService;
    setPendingService(null);
    if (service) await runAutofill(service);
  }

  async function runAutofill(serviceName: string) {
    setAutofilling(true);
    setErrorMsg(null);
    const key = getApiKey();
    setApiKeyState(key);
    try {
      // Ohne eigenen Key übernimmt der Serverschlüssel samt Freikontingent
      const sub = await autofillSubscription(serviceName, key);

      if (sub) {
        setAmount(String(sub.amount));
        setFrequency(sub.frequency);
        setCategory(sub.category);
      }
    } catch (err: any) {
      // Auch der Autofill verbraucht Freikontingent, ein 429 darf nicht still bleiben
      setErrorMsg(err?.message ?? 'Automatisches Ergänzen hat nicht geklappt. Trage die Werte einfach selbst ein.');
    } finally {
      setAutofilling(false);
    }
  }

  function addSubscription() {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!name.trim()) return Alert.alert('Name fehlt', 'Bitte einen Servicenamen eingeben.');
    if (isNaN(parsed) || parsed <= 0) return Alert.alert('Betrag fehlt', 'Bitte einen gültigen Betrag eingeben.');

    const today = new Date();
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const sub: Subscription = {
      id: String(Date.now()),
      name: name.trim(),
      amount: parsed,
      frequency,
      category,
      lastCharged: today.toISOString().slice(0, 10),
      nextCharge: nextMonth.toISOString().slice(0, 10),
    };

    setSubs(prev => [sub, ...prev]);
    // Reset form
    setName('');
    setAmount('');
    setFrequency('monthly');
    setCategory('streaming');
  }

  function removeSubscription(id: string) {
    setSubs(prev => prev.filter(s => s.id !== id));
  }

  async function goToResults() {
    if (subs.length === 0) {
      return Alert.alert('Keine Abos', 'Füge zuerst mindestens ein Abo hinzu.');
    }
    await mergeResults(subs);
    router.push('/results');
  }

  return (
    <>
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Zurück</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Manuell eintragen</Text>
      <Text style={styles.subtitle}>Trage deine Abos direkt ein. Die KI ergänzt Preise automatisch.</Text>

      {/* Freikontingent: auch das Ergänzen läuft über eine Analyse */}
      {!apiKey && quotaAvailable() && (
        <TouchableOpacity style={styles.quotaBanner} onPress={() => router.push('/settings')} activeOpacity={0.8}>
          <Text style={styles.quotaBannerText}>
            🎁 {quota
              ? `Noch ${quota.remaining} von ${quota.limit} Gratis-Analysen diesen Monat`
              : '3 Gratis-Analysen pro Monat'}
            {'. '}Auch das automatische Ergänzen zählt dazu.
          </Text>
        </TouchableOpacity>
      )}

      {errorMsg && (
        <TouchableOpacity style={styles.errorBanner} onPress={() => setErrorMsg(null)} activeOpacity={0.8}>
          <Text style={styles.errorBannerText}>{errorMsg}</Text>
          <Text style={styles.errorBannerClose}>✕</Text>
        </TouchableOpacity>
      )}

      {/* ── Popular Services ── */}
      <Text style={styles.sectionLabel}>Beliebte Dienste</Text>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Dienst suchen…"
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.popularRow} contentContainerStyle={styles.popularContent}>
        {filteredServices.map(s => (
          <TouchableOpacity
            key={s.name}
            style={[styles.chip, name === s.name && styles.chipActive]}
            onPress={() => handleAutofill(s.name)}
            activeOpacity={0.75}
          >
            <Text style={styles.chipEmoji}>{s.emoji}</Text>
            <Text style={[styles.chipLabel, name === s.name && styles.chipLabelActive]}>{s.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Form ── */}
      <View style={styles.formCard}>
        <Text style={styles.formTitle}>Abo-Details</Text>

        {/* Service name */}
        <Text style={styles.fieldLabel}>Servicename</Text>
        <View style={styles.nameRow}>
          <TextInput
            style={[styles.input, styles.nameInput]}
            placeholder="z.B. Netflix, Spotify…"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
          />
          <TouchableOpacity
            style={[styles.autofillBtn, autofilling && styles.autofillBtnLoading]}
            onPress={() => name.trim() && handleAutofill(name.trim())}
            disabled={autofilling || !name.trim()}
          >
            {autofilling
              ? <ActivityIndicator color={colors.accent} size="small" />
              : <Text style={styles.autofillBtnText}>KI ✨</Text>
            }
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <Text style={styles.fieldLabel}>Betrag (€)</Text>
        <TextInput
          style={styles.input}
          placeholder="z.B. 13,99"
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        {/* Frequency */}
        <Text style={styles.fieldLabel}>Zahlungsintervall</Text>
        <View style={styles.freqRow}>
          {FREQUENCIES.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.freqChip, frequency === f.id && styles.freqChipActive]}
              onPress={() => setFrequency(f.id)}
            >
              <Text style={[styles.freqLabel, frequency === f.id && styles.freqLabelActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Category */}
        <Text style={styles.fieldLabel}>Kategorie</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow} contentContainerStyle={styles.catContent}>
          {CATEGORY_KEYS.map(k => {
            const cat = categories[k];
            return (
              <TouchableOpacity
                key={k}
                style={[styles.catChip, category === k && styles.catChipActive]}
                onPress={() => setCategory(k)}
              >
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <Text style={[styles.catLabel, category === k && styles.catLabelActive]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity style={styles.addBtn} onPress={addSubscription} activeOpacity={0.85}>
          <Text style={styles.addBtnText}>+ Abo hinzufügen</Text>
        </TouchableOpacity>
      </View>

      {/* ── Added Subscriptions ── */}
      {subs.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Meine Abos ({subs.length})</Text>
          {subs.map(s => {
            const cat = categories[s.category as keyof typeof categories] ?? categories.other;
            return (
              <View key={s.id} style={styles.subCard}>
                <View style={[styles.subIcon, { backgroundColor: `${cat.color}20` }]}>
                  <Text style={styles.subIconEmoji}>{cat.emoji}</Text>
                </View>
                <View style={styles.subInfo}>
                  <Text style={styles.subName}>{s.name}</Text>
                  <Text style={styles.subMeta}>{cat.label} · {FREQUENCIES.find(f => f.id === s.frequency)?.label}</Text>
                </View>
                <View style={styles.subRight}>
                  <Text style={styles.subAmount}>€{s.amount.toFixed(2)}</Text>
                  <Text style={styles.subPer}>/Mo</Text>
                </View>
                <TouchableOpacity onPress={() => removeSubscription(s.id)} style={styles.subRemove}>
                  <Text style={styles.subRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Monthly total */}
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Monatlich gesamt</Text>
            <Text style={styles.totalAmount}>
              €{subs.reduce((sum, s) => sum + s.amount, 0).toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity style={styles.resultsBtn} onPress={goToResults} activeOpacity={0.85}>
            <Text style={styles.resultsBtnText}>Analyse anzeigen →</Text>
          </TouchableOpacity>
        </>
      )}

      {subs.length === 0 && (
        <View style={styles.emptyHint}>
          <Text style={styles.emptyIcon}>☝️</Text>
          <Text style={styles.emptyText}>Wähle einen Dienst oben oder tippe einen Namen ein und drücke „KI ✨" für automatische Ergänzung.</Text>
        </View>
      )}
    </ScrollView>

    <ConsentModal
      visible={consentVisible}
      onAccept={acceptConsent}
      onCancel={() => { setConsentVisible(false); setPendingService(null); }}
      onOpenPrivacy={() => {
        // Erst schließen, dann navigieren: das Modal hängt in einem Portal
        // und bliebe sonst über der Datenschutzerklärung liegen.
        setConsentVisible(false);
        setPendingService(null);
        setTimeout(() => router.push('/datenschutz'), 0);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 24, paddingTop: 60, paddingBottom: 64 },

  backBtn: { marginBottom: 24 },
  backText: { color: colors.textSecondary, fontSize: 15 },

  title: { fontSize: 26, fontWeight: '800', color: colors.textPrimary, marginBottom: 8, letterSpacing: -0.7 },
  subtitle: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: 16 },

  quotaBanner: {
    backgroundColor: `${colors.accent}12`, borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: `${colors.accent}35`,
  },
  quotaBannerText: { fontSize: 12, color: colors.accent, lineHeight: 17, fontWeight: '600' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: `${colors.danger}15`, borderRadius: 12, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: `${colors.danger}40`,
  },
  errorBannerText: { flex: 1, fontSize: 12, color: colors.danger, lineHeight: 17 },
  errorBannerClose: { fontSize: 13, color: colors.danger, fontWeight: '700' },

  sectionLabel: {
    fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    color: colors.textTertiary, fontWeight: '700', marginBottom: 12,
  },

  // Search
  searchBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, marginBottom: 12,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: 10 },

  // Popular chips
  popularRow: { marginBottom: 24 },
  popularContent: { gap: 8, paddingRight: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}15` },
  chipEmoji: { fontSize: 16 },
  chipLabel: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  chipLabelActive: { color: colors.accent },

  // Form card
  formCard: {
    backgroundColor: colors.surface, borderRadius: 18,
    padding: 20, borderWidth: 1, borderColor: colors.border,
    gap: 14, marginBottom: 28,
  },
  formTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },

  fieldLabel: { fontSize: 12, fontWeight: '600', color: colors.textTertiary, letterSpacing: 0.5 },

  input: {
    backgroundColor: colors.surface2, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary, fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12,
  },

  nameRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  nameInput: { flex: 1 },
  autofillBtn: {
    backgroundColor: `${colors.accent}20`, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: `${colors.accent}40`,
  },
  autofillBtnLoading: { opacity: 0.6 },
  autofillBtnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },

  // Frequency
  freqRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  freqChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  freqChipActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}15` },
  freqLabel: { fontSize: 13, fontWeight: '500', color: colors.textSecondary },
  freqLabelActive: { color: colors.accent },

  // Category
  catRow: { marginBottom: 4 },
  catContent: { gap: 8, paddingRight: 8 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.surface2, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: colors.border,
  },
  catChipActive: { borderColor: colors.accent, backgroundColor: `${colors.accent}15` },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 12, fontWeight: '500', color: colors.textSecondary },
  catLabelActive: { color: colors.accent, fontWeight: '700' },

  // Add button
  addBtn: {
    backgroundColor: colors.accent, borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  addBtnText: { fontSize: 15, fontWeight: '700', color: colors.bg },

  // Subscription list
  subCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 14,
    padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  subIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  subIconEmoji: { fontSize: 18 },
  subInfo: { flex: 1 },
  subName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  subMeta: { fontSize: 12, color: colors.textTertiary },
  subRight: { alignItems: 'flex-end', marginRight: 10 },
  subAmount: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, fontVariant: ['tabular-nums'] },
  subPer: { fontSize: 11, color: colors.textTertiary },
  subRemove: { padding: 4 },
  subRemoveText: { color: colors.danger, fontSize: 14 },

  // Total card
  totalCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: `${colors.accent}12`, borderRadius: 14,
    padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: `${colors.accent}30`,
  },
  totalLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  totalAmount: { fontSize: 20, fontWeight: '800', color: colors.accent, fontVariant: ['tabular-nums'] },

  // Results button
  resultsBtn: {
    backgroundColor: colors.accent, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center',
  },
  resultsBtnText: { fontSize: 16, fontWeight: '700', color: colors.bg },

  // Empty state
  emptyHint: {
    alignItems: 'center', padding: 28,
    backgroundColor: colors.surface, borderRadius: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  emptyIcon: { fontSize: 32, marginBottom: 12 },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
