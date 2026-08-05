import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, categories } from '../constants/theme';
import type { Subscription } from '../utils/analyzeSubscriptions';

function formatEur(amount: number) {
  return `€${amount.toFixed(2).replace('.', ',')}`;
}

function monthlyAmount(s: Subscription): number {
  switch (s.frequency) {
    case 'weekly':    return s.amount * 4.33;
    case 'quarterly': return s.amount / 3;
    case 'annual':    return s.amount / 12;
    default:          return s.amount;
  }
}

function SubscriptionCard({ sub, onPress }: { sub: Subscription; onPress: () => void }) {
  const cat = categories[sub.category] ?? categories.other;
  const monthly = monthlyAmount(sub);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.cardEmoji, { backgroundColor: `${cat.color}22` }]}>
        <Text style={styles.emojiText}>{cat.emoji}</Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{sub.name}</Text>
        <View style={styles.cardMeta}>
          <View style={[styles.catBadge, { backgroundColor: `${cat.color}22` }]}>
            <Text style={[styles.catBadgeText, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <Text style={styles.cardFreq}>
            {sub.frequency === 'monthly' ? 'monatlich'
              : sub.frequency === 'annual' ? 'jährlich'
              : sub.frequency === 'quarterly' ? 'quartalsweise'
              : 'wöchentlich'}
          </Text>
        </View>
      </View>
      <View style={styles.cardAmountWrap}>
        <Text style={styles.cardAmount}>{formatEur(monthly)}</Text>
        <Text style={styles.cardAmountLabel}>/Mo</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const subscriptions: Subscription[] = params.data
    ? JSON.parse(params.data as string)
    : [];

  const totalMonthly = subscriptions.reduce((sum, s) => sum + monthlyAmount(s), 0);
  const totalAnnual = totalMonthly * 12;
  const sorted = [...subscriptions].sort((a, b) => monthlyAmount(b) - monthlyAmount(a));

  async function shareResults() {
    const lines = sorted.map(s => `${s.name}: ${formatEur(monthlyAmount(s))}/Mo`).join('\n');
    const text = `Meine Abos (Kündigo)\n\nGesamt: ${formatEur(totalMonthly)}/Monat\n\n${lines}\n\nFinde deine Abos: kuendigo.app`;
    await Share.share({ message: text });
  }

  // Group by category for chart
  const byCategory = subscriptions.reduce<Record<string, number>>((acc, s) => {
    const key = s.category;
    acc[key] = (acc[key] ?? 0) + monthlyAmount(s);
    return acc;
  }, {});

  const catItems = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.backBtn}>
          <Text style={styles.backText}>← Neu analysieren</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={shareResults} style={styles.shareBtn}>
          <Text style={styles.shareText}>Teilen</Text>
        </TouchableOpacity>
      </View>

      {/* Hero total */}
      <View style={styles.heroCard}>
        <Text style={styles.heroLabel}>Du zahlst monatlich</Text>
        <Text style={styles.heroAmount}>{formatEur(totalMonthly)}</Text>
        <Text style={styles.heroSub}>{formatEur(totalAnnual)} pro Jahr · {subscriptions.length} Abos gefunden</Text>
      </View>

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
                    <View style={[styles.categoryBar, { width: `${pct}%`, backgroundColor: cat.color }]} />
                  </View>
                  <Text style={styles.categoryAmount}>{formatEur(amount)}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}

      {/* Subscription list */}
      <Text style={styles.sectionLabel}>Alle Abos</Text>
      {sorted.map(sub => (
        <SubscriptionCard
          key={sub.id}
          sub={sub}
          onPress={() => {}}
        />
      ))}

      {/* Savings tip */}
      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>💡 Sparerpotenzial</Text>
        <Text style={styles.tipText}>
          Im Schnitt zahlen Nutzer für {Math.round(subscriptions.length * 0.3)} Abos
          die sie kaum nutzen. Das wären{' '}
          <Text style={{ color: colors.accent, fontWeight: '700' }}>
            {formatEur(totalMonthly * 0.3)}/Monat
          </Text>{' '}
          die du sparen könntest.
        </Text>
      </View>

      {/* Share CTA */}
      <TouchableOpacity style={styles.shareFullBtn} onPress={shareResults} activeOpacity={0.85}>
        <Text style={styles.shareFullBtnText}>Ergebnis teilen 📤</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, paddingTop: 56, paddingBottom: 48 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  backBtn: {},
  backText: { color: colors.textSecondary, fontSize: 15 },
  shareBtn: {
    backgroundColor: colors.surface2,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  shareText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },

  // Hero
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heroLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroAmount: {
    fontSize: 52,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -2,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  // Section labels
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textTertiary,
    fontWeight: '700',
    marginBottom: 12,
  },

  // Category breakdown
  categoryList: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 100,
  },
  categoryEmoji: { fontSize: 16 },
  categoryName: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  categoryBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surface2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBar: {
    height: '100%',
    borderRadius: 3,
  },
  categoryAmount: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
    width: 52,
    textAlign: 'right',
  },

  // Cards
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  cardEmoji: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emojiText: { fontSize: 22 },
  cardInfo: { flex: 1 },
  cardName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catBadge: {
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  catBadgeText: { fontSize: 11, fontWeight: '600' },
  cardFreq: { fontSize: 12, color: colors.textTertiary },
  cardAmountWrap: { alignItems: 'flex-end' },
  cardAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  cardAmountLabel: { fontSize: 11, color: colors.textTertiary },

  // Tip
  tipBox: {
    backgroundColor: `${colors.accent}10`,
    borderRadius: 14,
    padding: 18,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${colors.accent}25`,
  },
  tipTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Share
  shareFullBtn: {
    backgroundColor: colors.surface2,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareFullBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
