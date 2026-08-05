import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, Linking, Platform, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { colors, categories } from '../constants/theme';
import type { Subscription } from '../utils/analyzeSubscriptions';
import { getCancellationUrl, daysUntilCharge, DEMO_SUBSCRIPTIONS } from '../utils/analyzeSubscriptions';
import { getCancellationGuide } from '../utils/cancellationSteps';
import { getResults } from '../utils/resultStore';

function formatEur(amount: number) {
  return `€${amount.toFixed(2).replace('.', ',')}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

function freqLabel(f: Subscription['frequency']) {
  return f === 'monthly' ? 'monatlich' : f === 'annual' ? 'jährlich'
    : f === 'quarterly' ? 'quartalsweise' : 'wöchentlich';
}

function monthlyAmount(s: Subscription): number {
  switch (s.frequency) {
    case 'weekly':    return s.amount * 4.33;
    case 'quarterly': return s.amount / 3;
    case 'annual':    return s.amount / 12;
    default:          return s.amount;
  }
}

function urgencyInfo(days: number): { label: string; color: string; icon: string } | null {
  if (days < 0)   return { label: 'Schon abgebucht', color: colors.textTertiary, icon: '✓' };
  if (days === 0) return { label: 'Verlängert sich HEUTE', color: colors.danger, icon: '🚨' };
  if (days <= 3)  return { label: `Verlängert sich in ${days} Tag${days === 1 ? '' : 'en'}!`, color: colors.danger, icon: '🚨' };
  if (days <= 7)  return { label: `Verlängert sich in ${days} Tagen`, color: colors.warning, icon: '⚠️' };
  return null;
}

async function openUrl(url: string) {
  if (Platform.OS === 'web') {
    window.open(url, '_blank');
  } else {
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
  }
}

// ─── Cancellation Modal ───────────────────────────────────────────────────────

function CancellationModal({
  sub,
  onClose,
  onMarkCancelled,
}: {
  sub: Subscription;
  onClose: () => void;
  onMarkCancelled: () => void;
}) {
  const cat = categories[sub.category] ?? categories.other;
  const monthly = monthlyAmount(sub);
  const guide = getCancellationGuide(sub.name);
  const cancelUrl = getCancellationUrl(sub.name);

  const steps = guide?.steps ?? [
    `${sub.name} Website öffnen und anmelden`,
    'Konto- oder Profil-Einstellungen öffnen',
    'Abonnement / Mitgliedschaft finden',
    'Auf „Kündigen" tippen',
    'Kündigung bestätigen',
  ];

  const actionUrl = guide?.url ?? cancelUrl
    ?? `https://www.google.com/search?q=${encodeURIComponent(sub.name + ' Abo kündigen Österreich')}`;

  const tip = guide?.tip;
  const isAppStore = guide?.isAppStore ?? false;

  return (
    <Modal
      visible={true}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={ms.overlay}>
        <TouchableOpacity style={ms.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={ms.sheet}>
          {/* Handle */}
          <View style={ms.handle} />

          {/* Header */}
          <View style={ms.header}>
            <View style={ms.headerLeft}>
              <View style={[ms.serviceIcon, { backgroundColor: `${cat.color}22` }]}>
                <Text style={ms.serviceEmoji}>{cat.emoji}</Text>
              </View>
              <View>
                <Text style={ms.serviceName}>{sub.name}</Text>
                <Text style={ms.serviceAmount}>{formatEur(monthly)} / Monat</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={ms.closeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={ms.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* App Store hint */}
            {isAppStore && (
              <View style={ms.appStoreBanner}>
                <Text style={ms.appStoreBannerText}>
                  📱 Dieses Abo läuft über den App Store — kündige direkt in den iPhone-Einstellungen.
                </Text>
              </View>
            )}

            {/* Steps */}
            <Text style={ms.stepsTitle}>So kündigen:</Text>
            {steps.map((step, i) => (
              <View key={i} style={ms.stepRow}>
                <View style={ms.stepNumber}>
                  <Text style={ms.stepNumberText}>{i + 1}</Text>
                </View>
                <Text style={ms.stepText}>{step}</Text>
              </View>
            ))}

            {/* Tip */}
            {tip && (
              <View style={ms.tipBox}>
                <Text style={ms.tipText}>{tip}</Text>
              </View>
            )}

            {/* Primary action — opens in new tab, app stays open */}
            <TouchableOpacity
              style={ms.primaryBtn}
              onPress={() => openUrl(actionUrl)}
              activeOpacity={0.8}
            >
              <Text style={ms.primaryBtnText}>
                {isAppStore ? '📱 iPhone Einstellungen öffnen' : '🔗 Zur Kündigungsseite'}
              </Text>
            </TouchableOpacity>

            <Text style={ms.returnHint}>
              Kehre nach der Kündigung zu Kündigo zurück und bestätige es hier.
            </Text>

            {/* Mark as cancelled */}
            <TouchableOpacity
              style={ms.doneBtn}
              onPress={onMarkCancelled}
              activeOpacity={0.8}
            >
              <Text style={ms.doneBtnText}>✓ Als gekündigt markieren</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Subscription Card ───────────────────────────────────────────────────────

function SubscriptionCard({
  sub,
  onCancel,
  isCancelled,
}: {
  sub: Subscription;
  onCancel: () => void;
  isCancelled: boolean;
}) {
  const cat = categories[sub.category] ?? categories.other;
  const monthly = monthlyAmount(sub);
  const days = daysUntilCharge(sub.nextCharge);
  const urgency = urgencyInfo(days);

  return (
    <View style={[styles.card, isCancelled && styles.cardCancelled]}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.cardEmoji, { backgroundColor: `${cat.color}22`, opacity: isCancelled ? 0.5 : 1 }]}>
          <Text style={styles.emojiText}>{cat.emoji}</Text>
        </View>

        <View style={styles.cardInfo}>
          <Text style={[styles.cardName, isCancelled && styles.textStrikethrough]}>{sub.name}</Text>
          <View style={styles.cardMeta}>
            {isCancelled ? (
              <View style={styles.cancelledBadge}>
                <Text style={styles.cancelledBadgeText}>✓ Gekündigt</Text>
              </View>
            ) : (
              <>
                <View style={[styles.catBadge, { backgroundColor: `${cat.color}22` }]}>
                  <Text style={[styles.catBadgeText, { color: cat.color }]}>{cat.label}</Text>
                </View>
                <Text style={styles.cardFreq}>{freqLabel(sub.frequency)}</Text>
              </>
            )}
          </View>
        </View>

        <View style={styles.cardAmountWrap}>
          <Text style={[styles.cardAmount, isCancelled && { color: colors.textTertiary }]}>{formatEur(monthly)}</Text>
          <Text style={styles.cardAmountLabel}>/Mo</Text>
        </View>
      </View>

      {/* Renewal row + cancel button */}
      <View style={styles.cardBottom}>
        <View style={styles.renewalRow}>
          {isCancelled ? (
            <Text style={{ fontSize: 12, color: colors.textTertiary }}>Abo wurde gekündigt</Text>
          ) : urgency ? (
            <View style={[styles.urgencyBadge, { backgroundColor: `${urgency.color}20`, borderColor: `${urgency.color}40` }]}>
              <Text style={styles.urgencyIcon}>{urgency.icon}</Text>
              <Text style={[styles.urgencyText, { color: urgency.color }]}>{urgency.label}</Text>
            </View>
          ) : (
            <View style={styles.renewalInfo}>
              <Text style={styles.renewalIcon}>🔄</Text>
              <Text style={styles.renewalText}>Verlängert am {formatDate(sub.nextCharge)}</Text>
            </View>
          )}
        </View>

        {isCancelled ? (
          <TouchableOpacity style={styles.cancelledBtn} onPress={onCancel} activeOpacity={0.75}>
            <Text style={styles.cancelledBtnText}>✓ Erledigt</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.75}>
            <Text style={styles.cancelBtnText}>Kündigen →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<Subscription | null>(null);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());

  const stored = getResults();
  const subscriptions: Subscription[] = stored.length > 0 ? stored : DEMO_SUBSCRIPTIONS;

  const totalMonthly = subscriptions.reduce((sum, s) => sum + monthlyAmount(s), 0);
  const totalAnnual = totalMonthly * 12;
  const sorted = [...subscriptions].sort((a, b) => monthlyAmount(b) - monthlyAmount(a));

  const urgent = subscriptions.filter(s => {
    const d = daysUntilCharge(s.nextCharge);
    return d >= 0 && d <= 7;
  }).sort((a, b) => daysUntilCharge(a.nextCharge) - daysUntilCharge(b.nextCharge));

  function openCancelModal(sub: Subscription) {
    setActiveModal(sub);
  }

  function markCancelled(subId: string) {
    setCancelledIds(prev => new Set([...prev, subId]));
    setActiveModal(null);
  }

  async function shareResults() {
    const lines = sorted.map(s => `${s.name}: ${formatEur(monthlyAmount(s))}/Mo`).join('\n');
    const text = `Meine Abos (Kündigo)\n\nGesamt: ${formatEur(totalMonthly)}/Monat · ${formatEur(totalAnnual)}/Jahr\n\n${lines}\n\nFinde deine Abos auf: kuendigo.app`;
    await Share.share({ message: text });
  }

  const byCategory = subscriptions.reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + monthlyAmount(s);
    return acc;
  }, {});

  const catItems = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const cancelledCount = cancelledIds.size;
  const savedMonthly = [...cancelledIds].reduce((sum, id) => {
    const sub = subscriptions.find(s => s.id === id);
    return sub ? sum + monthlyAmount(sub) : sum;
  }, 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.backBtn}>
            <Text style={styles.backText}>← Neu analysieren</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={shareResults} style={styles.shareBtn}>
            <Text style={styles.shareText}>Teilen 📤</Text>
          </TouchableOpacity>
        </View>

        {/* Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Du zahlst monatlich</Text>
          <Text style={styles.heroAmount}>{formatEur(totalMonthly)}</Text>
          <Text style={styles.heroSub}>{formatEur(totalAnnual)} pro Jahr · {subscriptions.length} Abos gefunden</Text>
          {cancelledCount > 0 && (
            <View style={[styles.heroAlert, { backgroundColor: `${colors.accent}15`, borderColor: `${colors.accent}30` }]}>
              <Text style={[styles.heroAlertText, { color: colors.accent }]}>
                ✓ {cancelledCount} Abo{cancelledCount > 1 ? 's' : ''} gekündigt · {formatEur(savedMonthly)}/Mo gespart!
              </Text>
            </View>
          )}
          {urgent.length > 0 && cancelledCount === 0 && (
            <View style={styles.heroAlert}>
              <Text style={styles.heroAlertText}>
                🚨 {urgent.length} Abo{urgent.length > 1 ? 's' : ''} verlänger{urgent.length > 1 ? 'n' : 't'} sich diese Woche
              </Text>
            </View>
          )}
        </View>

        {/* Urgent renewals */}
        {urgent.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>⏰ Jetzt kündigen</Text>
            <View style={styles.urgentBox}>
              <Text style={styles.urgentBoxSubtitle}>
                Diese Abos verlängern sich bald — tippe auf „Kündigen" um eine Schritt-für-Schritt-Anleitung zu sehen.
              </Text>
              {urgent.map(sub => {
                const days = daysUntilCharge(sub.nextCharge);
                const isCancelled = cancelledIds.has(sub.id);
                return (
                  <View key={sub.id} style={styles.urgentRow}>
                    <View style={styles.urgentLeft}>
                      <Text style={[styles.urgentName, isCancelled && { opacity: 0.5, textDecorationLine: 'line-through' as any }]}>{sub.name}</Text>
                      <Text style={[styles.urgentDate, isCancelled && { color: colors.accent }]}>
                        {isCancelled ? '✓ Gekündigt' : days === 0 ? 'Verlängert sich heute' : `In ${days} Tag${days === 1 ? '' : 'en'} · ${formatDate(sub.nextCharge)}`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.urgentCancelBtn, isCancelled && { backgroundColor: `${colors.accent}30` }]}
                      onPress={() => openCancelModal(sub)}
                    >
                      <Text style={[styles.urgentCancelText, isCancelled && { color: colors.accent }]}>
                        {isCancelled ? '✓ Erledigt' : 'Kündigen →'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Category breakdown */}
        {catItems.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Nach Kategorie</Text>
            <View style={styles.categoryList}>
              {catItems.map(([key, amount]) => {
                const cat = categories[key] ?? categories.other;
                const pct = Math.round((amount / totalMonthly) * 100);
                return (
                  <View key={key} style={styles.categoryRow}>
                    <View style={styles.categoryLeft}>
                      <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                      <Text style={styles.categoryName}>{cat.label}</Text>
                    </View>
                    <View style={styles.categoryBarWrap}>
                      <View style={[styles.categoryBar, { width: `${pct}%` as any, backgroundColor: cat.color }]} />
                    </View>
                    <Text style={styles.categoryAmount}>{formatEur(amount)}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* All subscriptions */}
        <Text style={styles.sectionLabel}>Alle Abos</Text>
        {sorted.map(sub => (
          <SubscriptionCard
            key={sub.id}
            sub={sub}
            onCancel={() => openCancelModal(sub)}
            isCancelled={cancelledIds.has(sub.id)}
          />
        ))}

        {/* Savings tip */}
        <View style={styles.tipBox}>
          <Text style={styles.tipTitle}>💡 Sparerpotenzial</Text>
          <Text style={styles.tipText}>
            Im Schnitt nutzen Nutzer {Math.round(subscriptions.length * 0.3)} ihrer Abos kaum.
            Das wären{' '}
            <Text style={{ color: colors.accent, fontWeight: '700' }}>
              {formatEur(totalMonthly * 0.3)}/Monat
            </Text>
            {' '}die du sparen könntest — tippe auf „Kündigen" für die Anleitung.
          </Text>
        </View>

        {/* Legal note */}
        <View style={styles.legalBox}>
          <Text style={styles.legalTitle}>ℹ️ Deine Rechte</Text>
          <Text style={styles.legalText}>
            Laut österreichischem KSchG und deutschem BGB kannst du monatliche Abos jederzeit zum Ende des Abrechnungszeitraums kündigen. Die meisten Anbieter benötigen keine Begründung.
          </Text>
        </View>

        <TouchableOpacity style={styles.shareFullBtn} onPress={shareResults} activeOpacity={0.85}>
          <Text style={styles.shareFullBtnText}>Ergebnis teilen 📤</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Cancellation Modal */}
      {activeModal && (
        <CancellationModal
          sub={activeModal}
          onClose={() => setActiveModal(null)}
          onMarkCancelled={() => markCancelled(activeModal.id)}
        />
      )}
    </View>
  );
}

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: colors.surface2,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  serviceIcon: {
    width: 52, height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceEmoji: { fontSize: 26 },
  serviceName: {
    fontSize: 20, fontWeight: '800',
    color: colors.textPrimary, letterSpacing: -0.5,
  },
  serviceAmount: {
    fontSize: 14, color: colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32, height: 32,
    backgroundColor: colors.surface2,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { fontSize: 14, color: colors.textSecondary, fontWeight: '700' },

  appStoreBanner: {
    backgroundColor: `${'#007AFF'}15`,
    borderRadius: 12, padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${'#007AFF'}30`,
  },
  appStoreBannerText: {
    fontSize: 13, color: '#5AA3FF',
    lineHeight: 18,
  },

  stepsTitle: {
    fontSize: 12, letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
    fontWeight: '700',
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 14,
  },
  stepNumber: {
    width: 28, height: 28,
    borderRadius: 14,
    backgroundColor: `${colors.accent}20`,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
    borderWidth: 1,
    borderColor: `${colors.accent}40`,
  },
  stepNumberText: {
    fontSize: 13, fontWeight: '800',
    color: colors.accent,
  },
  stepText: {
    flex: 1,
    fontSize: 15, color: colors.textPrimary,
    lineHeight: 22,
  },
  tipBox: {
    backgroundColor: `${colors.warning}12`,
    borderRadius: 12, padding: 14,
    marginTop: 4, marginBottom: 20,
    borderWidth: 1,
    borderColor: `${colors.warning}30`,
  },
  tipText: {
    fontSize: 13, color: colors.warning,
    lineHeight: 18,
  },
  primaryBtn: {
    backgroundColor: colors.danger,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 16, fontWeight: '700',
    color: '#fff', letterSpacing: 0.2,
  },
  returnHint: {
    fontSize: 12, color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 16,
    lineHeight: 17,
  },
  doneBtn: {
    backgroundColor: `${colors.accent}15`,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.accent}40`,
  },
  doneBtnText: {
    fontSize: 16, fontWeight: '700',
    color: colors.accent,
  },
});

// ─── Screen Styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingTop: 56, paddingBottom: 48 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backBtn: {},
  backText: { color: colors.textSecondary, fontSize: 15 },
  shareBtn: { backgroundColor: colors.surface2, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  shareText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },

  heroCard: {
    backgroundColor: colors.surface, borderRadius: 20, padding: 28,
    alignItems: 'center', marginBottom: 28,
    borderWidth: 1, borderColor: colors.border,
  },
  heroLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' },
  heroAmount: { fontSize: 52, fontWeight: '800', color: colors.textPrimary, letterSpacing: -2, marginBottom: 8 },
  heroSub: { fontSize: 14, color: colors.textTertiary, textAlign: 'center', marginBottom: 4 },
  heroAlert: {
    marginTop: 16, backgroundColor: `${colors.danger}15`,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: `${colors.danger}30`,
  },
  heroAlertText: { fontSize: 13, color: colors.danger, fontWeight: '600' },

  sectionLabel: {
    fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
    color: colors.textTertiary, fontWeight: '700', marginBottom: 12,
  },

  urgentBox: {
    backgroundColor: `${colors.danger}08`, borderRadius: 16,
    borderWidth: 1, borderColor: `${colors.danger}25`,
    padding: 16, marginBottom: 28, gap: 14,
  },
  urgentBoxSubtitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 4 },
  urgentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  urgentLeft: { flex: 1 },
  urgentName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  urgentDate: { fontSize: 12, color: colors.danger },
  urgentCancelBtn: {
    backgroundColor: colors.danger, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  urgentCancelText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  categoryList: {
    backgroundColor: colors.surface, borderRadius: 16, padding: 16,
    marginBottom: 28, borderWidth: 1, borderColor: colors.border, gap: 14,
  },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  categoryLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 100 },
  categoryEmoji: { fontSize: 16 },
  categoryName: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  categoryBarWrap: { flex: 1, height: 6, backgroundColor: colors.surface2, borderRadius: 3, overflow: 'hidden' },
  categoryBar: { height: '100%', borderRadius: 3 },
  categoryAmount: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', width: 52, textAlign: 'right' },

  // Subscription card
  card: {
    backgroundColor: colors.surface, borderRadius: 16,
    marginBottom: 10, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden',
  },
  cardCancelled: {
    opacity: 0.65,
    borderColor: `${colors.accent}25`,
    backgroundColor: `${colors.accent}05`,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  cardEmoji: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emojiText: { fontSize: 22 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  textStrikethrough: { textDecorationLine: 'line-through', color: colors.textTertiary },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catBadge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  cardFreq: { fontSize: 12, color: colors.textTertiary },
  cancelledBadge: {
    backgroundColor: `${colors.accent}20`, borderRadius: 6,
    paddingVertical: 2, paddingHorizontal: 7,
    borderWidth: 1, borderColor: `${colors.accent}40`,
  },
  cancelledBadgeText: { fontSize: 11, fontWeight: '700', color: colors.accent },
  cardAmountWrap: { alignItems: 'flex-end' },
  cardAmount: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  cardAmountLabel: { fontSize: 11, color: colors.textTertiary },

  cardBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 14, paddingTop: 4, gap: 12,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  renewalRow: { flex: 1 },
  renewalInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  renewalIcon: { fontSize: 12 },
  renewalText: { fontSize: 12, color: colors.textTertiary },
  urgencyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8, borderWidth: 1,
  },
  urgencyIcon: { fontSize: 12 },
  urgencyText: { fontSize: 12, fontWeight: '600' },

  cancelBtn: {
    backgroundColor: `${colors.danger}18`,
    borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14,
    borderWidth: 1, borderColor: `${colors.danger}40`,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.danger },

  cancelledBtn: {
    backgroundColor: `${colors.accent}15`,
    borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14,
    borderWidth: 1, borderColor: `${colors.accent}40`,
  },
  cancelledBtnText: { fontSize: 13, fontWeight: '700', color: colors.accent },

  tipBox: {
    backgroundColor: `${colors.accent}10`, borderRadius: 14, padding: 18,
    marginTop: 8, marginBottom: 12,
    borderWidth: 1, borderColor: `${colors.accent}25`,
  },
  tipTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  tipText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },

  legalBox: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: colors.border,
  },
  legalTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
  legalText: { fontSize: 12, color: colors.textTertiary, lineHeight: 18 },

  shareFullBtn: {
    backgroundColor: colors.surface2, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  shareFullBtnText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
});
