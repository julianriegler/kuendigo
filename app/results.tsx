import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Linking, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, categories } from '../constants/theme';
import type { Subscription } from '../utils/analyzeSubscriptions';
import { getCancellationUrl, daysUntilCharge } from '../utils/analyzeSubscriptions';

function formatEur(amount: number) {
  return `€${amount.toFixed(2).replace('.', ',')}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

function freqLabel(f: Subscription['frequency']) {
  return f === 'monthly' ? 'monatlich' : f === 'annual' ? 'jährlich' : f === 'quarterly' ? 'quartalsweise' : 'wöchentlich';
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
  if (days < 0)  return { label: 'Schon abgebucht', color: colors.textTertiary, icon: '✓' };
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

// ─── Subscription Card ───────────────────────────────────────────────────────

function SubscriptionCard({ sub }: { sub: Subscription }) {
  const cat = categories[sub.category] ?? categories.other;
  const monthly = monthlyAmount(sub);
  const days = daysUntilCharge(sub.nextCharge);
  const urgency = urgencyInfo(days);
  const cancelUrl = getCancellationUrl(sub.name);

  return (
    <View style={styles.card}>
      {/* Top row */}
      <View style={styles.cardTop}>
        <View style={[styles.cardEmoji, { backgroundColor: `${cat.color}22` }]}>
          <Text style={styles.emojiText}>{cat.emoji}</Text>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{sub.name}</Text>
          <View style={styles.cardMeta}>
            <View style={[styles.catBadge, { backgroundColor: `${cat.color}22` }]}>
              <Text style={[styles.catBadgeText, { color: cat.color }]}>{cat.label}</Text>
            </View>
            <Text style={styles.cardFreq}>{freqLabel(sub.frequency)}</Text>
          </View>
        </View>

        <View style={styles.cardAmountWrap}>
          <Text style={styles.cardAmount}>{formatEur(monthly)}</Text>
          <Text style={styles.cardAmountLabel}>/Mo</Text>
        </View>
      </View>

      {/* Renewal row */}
      <View style={styles.cardBottom}>
        <View style={styles.renewalRow}>
          {urgency ? (
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

        {/* Cancel button */}
        {cancelUrl ? (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => openUrl(cancelUrl)}
            activeOpacity={0.75}
          >
            <Text style={styles.cancelBtnText}>Kündigen →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.cancelBtnGhost}
            onPress={() => openUrl(`https://www.google.com/search?q=${encodeURIComponent(sub.name + ' Abo kündigen')}`)}
            activeOpacity={0.75}
          >
            <Text style={styles.cancelBtnGhostText}>Anleitung →</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const subscriptions: Subscription[] = params.data
    ? JSON.parse(params.data as string)
    : [];

  const totalMonthly = subscriptions.reduce((sum, s) => sum + monthlyAmount(s), 0);
  const totalAnnual = totalMonthly * 12;
  const sorted = [...subscriptions].sort((a, b) => monthlyAmount(b) - monthlyAmount(a));

  // Upcoming renewals (next 7 days)
  const urgent = subscriptions.filter(s => {
    const d = daysUntilCharge(s.nextCharge);
    return d >= 0 && d <= 7;
  }).sort((a, b) => daysUntilCharge(a.nextCharge) - daysUntilCharge(b.nextCharge));

  async function shareResults() {
    const lines = sorted.map(s => `${s.name}: ${formatEur(monthlyAmount(s))}/Mo`).join('\n');
    const text = `Meine Abos (Kündigo)\n\nGesamt: ${formatEur(totalMonthly)}/Monat · ${formatEur(totalAnnual)}/Jahr\n\n${lines}\n\nFinde deine Abos auf: kuendigo.app`;
    await Share.share({ message: text });
  }

  // Group by category for chart
  const byCategory = subscriptions.reduce<Record<string, number>>((acc, s) => {
    acc[s.category] = (acc[s.category] ?? 0) + monthlyAmount(s);
    return acc;
  }, {});

  const catItems = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
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
        {urgent.length > 0 && (
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
              Diese Abos verlängern sich bald — jetzt kündigen, um Geld zu sparen.
            </Text>
            {urgent.map(sub => {
              const days = daysUntilCharge(sub.nextCharge);
              const cancelUrl = getCancellationUrl(sub.name);
              return (
                <View key={sub.id} style={styles.urgentRow}>
                  <View style={styles.urgentLeft}>
                    <Text style={styles.urgentName}>{sub.name}</Text>
                    <Text style={styles.urgentDate}>
                      {days === 0 ? 'Verlängert sich heute' : `In ${days} Tag${days === 1 ? '' : 'en'} · ${formatDate(sub.nextCharge)}`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.urgentCancelBtn}
                    onPress={() => openUrl(cancelUrl ?? `https://www.google.com/search?q=${encodeURIComponent(sub.name + ' Abo kündigen')}`)}
                  >
                    <Text style={styles.urgentCancelText}>Jetzt kündigen</Text>
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
      {sorted.map(sub => <SubscriptionCard key={sub.id} sub={sub} />)}

      {/* Savings tip */}
      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>💡 Sparerpotenzial</Text>
        <Text style={styles.tipText}>
          Im Schnitt nutzen Nutzer {Math.round(subscriptions.length * 0.3)} ihrer Abos kaum.
          Das wären{' '}
          <Text style={{ color: colors.accent, fontWeight: '700' }}>
            {formatEur(totalMonthly * 0.3)}/Monat
          </Text>
          {' '}die du sparen könntest — einfach auf „Kündigen" tippen.
        </Text>
      </View>

      {/* Legal note (AT/DE consumer law) */}
      <View style={styles.legalBox}>
        <Text style={styles.legalTitle}>ℹ️ Deine Rechte</Text>
        <Text style={styles.legalText}>
          Laut österreichischem KSchG und deutschem BGB kannst du monatliche Abos jederzeit zum Ende des Abrechnungszeitraums kündigen. Die meisten Anbieter benötigen keine Begründung.
        </Text>
      </View>

      {/* Share CTA */}
      <TouchableOpacity style={styles.shareFullBtn} onPress={shareResults} activeOpacity={0.85}>
        <Text style={styles.shareFullBtnText}>Ergebnis teilen 📤</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingTop: 56, paddingBottom: 48 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backBtn: {},
  backText: { color: colors.textSecondary, fontSize: 15 },
  shareBtn: { backgroundColor: colors.surface2, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
  shareText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },

  // Hero
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

  // Section label
  sectionLabel: {
    fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
    color: colors.textTertiary, fontWeight: '700', marginBottom: 12,
  },

  // Urgent box
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

  // Category breakdown
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
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  cardEmoji: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emojiText: { fontSize: 22 },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catBadge: { borderRadius: 6, paddingVertical: 2, paddingHorizontal: 7 },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  cardFreq: { fontSize: 12, color: colors.textTertiary },
  cardAmountWrap: { alignItems: 'flex-end' },
  cardAmount: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  cardAmountLabel: { fontSize: 11, color: colors.textTertiary },

  // Card bottom — renewal + cancel
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
    borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8,
    borderWidth: 1,
  },
  urgencyIcon: { fontSize: 12 },
  urgencyText: { fontSize: 12, fontWeight: '600' },

  // Cancel button
  cancelBtn: {
    backgroundColor: `${colors.danger}18`,
    borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14,
    borderWidth: 1, borderColor: `${colors.danger}40`,
  },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: colors.danger },

  cancelBtnGhost: {
    backgroundColor: colors.surface2,
    borderRadius: 10, paddingVertical: 7, paddingHorizontal: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  cancelBtnGhostText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },

  // Tip
  tipBox: {
    backgroundColor: `${colors.accent}10`, borderRadius: 14, padding: 18,
    marginTop: 8, marginBottom: 12,
    borderWidth: 1, borderColor: `${colors.accent}25`,
  },
  tipTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  tipText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },

  // Legal note
  legalBox: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16,
    marginBottom: 20, borderWidth: 1, borderColor: colors.border,
  },
  legalTitle: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 },
  legalText: { fontSize: 12, color: colors.textTertiary, lineHeight: 18 },

  // Share
  shareFullBtn: {
    backgroundColor: colors.surface2, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  shareFullBtnText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
});
