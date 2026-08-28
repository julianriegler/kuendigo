import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Share, Linking, Platform, Modal, ActivityIndicator, Alert, TextInput
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, categories } from '../constants/theme';
import type { Subscription } from '../utils/analyzeSubscriptions';
import {
  getCancellationUrl, daysUntilCharge, monthlyAmount, DEMO_SUBSCRIPTIONS,
} from '../utils/analyzeSubscriptions';
import { getCancellationGuide, cancelDeadline, type CancelDeadline } from '../utils/cancellationSteps';
import { cancelledSavings } from '../utils/subscriptionMath';
import {
  loadResults, setResults, upsertSubscription, removeSubscription,
  normalizeList, lastPersistFailed, hasStoredResults,
} from '../utils/resultStore';
import { buildLetterHtml } from '../utils/cancellationLetter';
import { loadSenderInfo, saveSenderInfo, type SenderInfo } from '../utils/storage';

function formatEur(amount: number) {
  return `€${amount.toFixed(2).replace('.', ',')}`;
}

/**
 * YYYY-MM-DD als TT.MM.JJJJ. Wird bewusst aus den Zahlen gebaut: new Date(iso)
 * liest UTC-Mitternacht und würde westlich von UTC einen Tag zu früh anzeigen.
 */
function formatDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (match) return `${match[3]}.${match[2]}.${match[1]}`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso ?? '';
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}.${d.getFullYear()}`;
}

/**
 * Text zur Kündigungsfrist. Ohne bekannte Frist bleibt es bewusst neutral,
 * statt ein Datum zu erfinden.
 */
function deadlineLabel(info: CancelDeadline): { text: string; urgent: boolean } {
  if (!info.date || info.daysLeft === null) {
    return { text: 'Frist unbekannt, am besten gleich kündigen', urgent: false };
  }
  if (info.daysLeft < 0) {
    return { text: `Frist war am ${formatDate(info.date)}, gilt jetzt für die nächste Periode`, urgent: false };
  }
  if (info.daysLeft === 0) {
    return { text: `Heute ist der letzte Tag zum Kündigen (${formatDate(info.date)})`, urgent: true };
  }
  return {
    text: `Kündigen bis ${formatDate(info.date)} (noch ${info.daysLeft} Tag${info.daysLeft === 1 ? '' : 'e'})`,
    urgent: info.daysLeft <= 7,
  };
}

function freqLabel(f: Subscription['frequency']) {
  return f === 'monthly' ? 'monatlich' : f === 'annual' ? 'jährlich'
    : f === 'quarterly' ? 'quartalsweise' : 'wöchentlich';
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

// Alert.alert ist in react-native-web ein No-Op, deshalb die Weiche.
function meldung(titel: string, text: string) {
  if (Platform.OS === 'web') window.alert(`${titel}\n\n${text}`);
  else Alert.alert(titel, text);
}

// ─── Cancellation Modal ───────────────────────────────────────────────────────

function CancellationModal({
  sub,
  onClose,
  onMarkCancelled,
  onUndoCancelled,
}: {
  sub: Subscription;
  onClose: () => void;
  onMarkCancelled: () => void;
  onUndoCancelled: () => void;
}) {
  const [letterFormVisible, setLetterFormVisible] = useState(false);
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
  const deadline = cancelDeadline(sub.name, sub.nextCharge);
  const deadlineText = deadlineLabel(deadline);

  return (
    <Modal
      visible={true}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={ms.overlay}>
        <TouchableOpacity
          style={ms.backdrop}
          onPress={onClose}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Kündigungsanleitung schließen"
        />
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
            <TouchableOpacity
              onPress={onClose}
              style={ms.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Text style={ms.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
            {/* Frist */}
            <View style={[ms.deadlineBox, deadlineText.urgent && ms.deadlineBoxUrgent]}>
              <Text style={[ms.deadlineTitle, deadlineText.urgent && { color: colors.danger }]}>
                ⏳ {deadlineText.text}
              </Text>
              <Text style={ms.deadlineSub}>
                {deadline.noticePeriodDays === undefined
                  ? `Für ${sub.name} ist keine Kündigungsfrist hinterlegt. Nächste Abbuchung: ${formatDate(sub.nextCharge)}.`
                  : deadline.noticePeriodDays === 0
                    ? `Kündbar bis zur nächsten Abbuchung am ${formatDate(sub.nextCharge)}.`
                    : `${deadline.noticePeriodDays} Tag${deadline.noticePeriodDays === 1 ? '' : 'e'} Frist vor der Abbuchung am ${formatDate(sub.nextCharge)}.`}
                {deadline.minTermMonths ? ` Mindestlaufzeit: ${deadline.minTermMonths} Monate.` : ''}
              </Text>
            </View>

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
              accessibilityRole="button"
              accessibilityLabel={isAppStore ? 'iPhone Einstellungen öffnen' : 'Zur Kündigungsseite'}
            >
              <Text style={ms.primaryBtnText}>
                {isAppStore ? '📱 iPhone Einstellungen öffnen' : '🔗 Zur Kündigungsseite'}
              </Text>
            </TouchableOpacity>

            <Text style={ms.returnHint}>
              Kehre nach der Kündigung zu Kündigo zurück und bestätige es hier.
            </Text>

            {/* Kündigungsschreiben als PDF */}
            <TouchableOpacity
              style={ms.letterBtn}
              onPress={() => setLetterFormVisible(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Kündigungsschreiben erstellen"
            >
              <Text style={ms.letterBtnText}>📄 Kündigungsschreiben erstellen</Text>
            </TouchableOpacity>

            {/* Mark as cancelled */}
            {sub.cancelled ? (
              <TouchableOpacity
                style={ms.undoBtn}
                onPress={onUndoCancelled}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Doch nicht gekündigt"
              >
                <Text style={ms.undoBtnText}>↩︎ Doch nicht gekündigt</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={ms.doneBtn}
                onPress={onMarkCancelled}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Als gekündigt markieren"
              >
                <Text style={ms.doneBtnText}>✓ Als gekündigt markieren</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>

      {letterFormVisible && (
        <LetterFormModal sub={sub} onClose={() => setLetterFormVisible(false)} />
      )}
    </Modal>
  );
}

// ─── Letter Form Modal ────────────────────────────────────────────────────────

function LetterFormModal({ sub, onClose }: { sub: Subscription; onClose: () => void }) {
  const [name, setName] = useState('');
  const [street, setStreet] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [email, setEmail] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [contractStart, setContractStart] = useState('');
  const [desiredDate, setDesiredDate] = useState('');

  // Zuletzt gespeicherte Absenderdaten vorausfüllen, damit sie nicht bei
  // jedem Kündigungsschreiben neu eingetippt werden müssen.
  useEffect(() => {
    let alive = true;
    loadSenderInfo().then(info => {
      if (!alive || !info) return;
      setName(info.name ?? '');
      setStreet(info.street ?? '');
      setZip(info.zip ?? '');
      setCity(info.city ?? '');
      setEmail(info.email ?? '');
    });
    return () => { alive = false; };
  }, []);

  function printOnWeb(html: string) {
    const win = window.open('', '_blank');
    if (!win) {
      meldung('Fenster blockiert', 'Bitte Pop-ups für Kündigo erlauben und erneut versuchen.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    // Kurze Verzögerung, damit der Browser das Dokument fertig gerendert hat, bevor der Druckdialog öffnet.
    setTimeout(() => win.print(), 300);
  }

  async function createLetter() {
    if (!name.trim() || !street.trim() || !zip.trim() || !city.trim()) {
      meldung('Angaben fehlen', 'Bitte Name, Straße, PLZ und Ort ausfüllen.');
      return;
    }

    const sender: SenderInfo = {
      name: name.trim(),
      street: street.trim(),
      zip: zip.trim(),
      city: city.trim(),
      email: email.trim() || undefined,
    };
    await saveSenderInfo(sender);

    const html = buildLetterHtml({
      sender,
      serviceName: sub.name,
      customerNumber: customerNumber.trim() || undefined,
      contractStart: contractStart.trim() || undefined,
      desiredDate: desiredDate.trim() || undefined,
    });

    if (Platform.OS === 'web') {
      printOnWeb(html);
      onClose();
      return;
    }

    // expo-print ist in diesem Projekt nicht installiert (siehe package.json),
    // die PDF-Erstellung läuft deshalb aktuell nur im Web-Build.
    meldung(
      'Nur im Web verfügbar',
      'Die PDF-Erstellung für Kündigungsschreiben ist aktuell nur in der Web-Version von Kündigo verfügbar.'
    );
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={ms.overlay}>
        <TouchableOpacity
          style={ms.backdrop}
          onPress={onClose}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel="Formular schließen"
        />
        <View style={ms.sheet}>
          <View style={ms.handle} />

          <View style={ms.header}>
            <Text style={ms.serviceName}>Absenderdaten</Text>
            <TouchableOpacity
              onPress={onClose}
              style={ms.closeBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Text style={ms.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }} keyboardShouldPersistTaps="handled">
            <Text style={ms.formHint}>
              Diese Daten bleiben nur auf deinem Gerät und werden für künftige Kündigungsschreiben wiederverwendet.
            </Text>

            <Text style={ms.fieldLabel}>Name</Text>
            <TextInput
              style={ms.input}
              value={name}
              onChangeText={setName}
              placeholder="Max Mustermann"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Name"
            />

            <Text style={ms.fieldLabel}>Straße und Hausnummer</Text>
            <TextInput
              style={ms.input}
              value={street}
              onChangeText={setStreet}
              placeholder="Musterstraße 1"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Straße und Hausnummer"
            />

            <View style={ms.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={ms.fieldLabel}>PLZ</Text>
                <TextInput
                  style={ms.input}
                  value={zip}
                  onChangeText={setZip}
                  placeholder="12345"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="number-pad"
                  accessibilityLabel="Postleitzahl"
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={ms.fieldLabel}>Ort</Text>
                <TextInput
                  style={ms.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Musterstadt"
                  placeholderTextColor={colors.textTertiary}
                  accessibilityLabel="Ort"
                />
              </View>
            </View>

            <Text style={ms.fieldLabel}>E-Mail (optional)</Text>
            <TextInput
              style={ms.input}
              value={email}
              onChangeText={setEmail}
              placeholder="max@beispiel.de"
              placeholderTextColor={colors.textTertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              accessibilityLabel="E-Mail-Adresse, optional"
            />

            <Text style={ms.formSectionLabel}>Zum Vertrag (optional)</Text>

            <Text style={ms.fieldLabel}>Kundennummer</Text>
            <TextInput
              style={ms.input}
              value={customerNumber}
              onChangeText={setCustomerNumber}
              placeholder="z.B. 123456"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Kundennummer, optional"
            />

            <Text style={ms.fieldLabel}>Vertragsbeginn</Text>
            <TextInput
              style={ms.input}
              value={contractStart}
              onChangeText={setContractStart}
              placeholder="TT.MM.JJJJ"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Vertragsbeginn, optional, Format Tag Punkt Monat Punkt Jahr"
            />

            <Text style={ms.fieldLabel}>Wunschtermin</Text>
            <TextInput
              style={ms.input}
              value={desiredDate}
              onChangeText={setDesiredDate}
              placeholder="TT.MM.JJJJ"
              placeholderTextColor={colors.textTertiary}
              accessibilityLabel="Wunschtermin, optional, Format Tag Punkt Monat Punkt Jahr"
            />

            <TouchableOpacity
              style={ms.primaryBtn}
              onPress={createLetter}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Kündigungsschreiben erstellen"
            >
              <Text style={ms.primaryBtnText}>📄 Schreiben erstellen</Text>
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
  onDelete,
  isCancelled,
}: {
  sub: Subscription;
  onCancel: () => void;
  onDelete: () => void;
  isCancelled: boolean;
}) {
  const cat = categories[sub.category] ?? categories.other;
  const monthly = monthlyAmount(sub);
  const days = daysUntilCharge(sub.nextCharge);
  const urgency = urgencyInfo(days);
  const deadlineText = deadlineLabel(cancelDeadline(sub.name, sub.nextCharge));

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

      {/* Kündigungsfrist */}
      {!isCancelled && (
        <View style={styles.deadlineRow}>
          <Text style={[styles.deadlineText, deadlineText.urgent && { color: colors.danger, fontWeight: '700' }]}>
            ⏳ {deadlineText.text}
          </Text>
        </View>
      )}

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

        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={onDelete}
            activeOpacity={0.75}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`${sub.name} entfernen`}
          >
            <Text style={styles.deleteBtnText}>🗑 Entfernen</Text>
          </TouchableOpacity>

          {isCancelled ? (
            <TouchableOpacity
              style={styles.cancelledBtn}
              onPress={onCancel}
              activeOpacity={0.75}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`${sub.name}, Kündigung erledigt, Anleitung erneut öffnen`}
            >
              <Text style={styles.cancelledBtnText}>✓ Erledigt</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              activeOpacity={0.75}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              accessibilityRole="button"
              accessibilityLabel={`${sub.name} kündigen`}
            >
              <Text style={styles.cancelBtnText}>Kündigen →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ResultsScreen() {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<Subscription | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  // Bei jedem Fokus neu laden, damit eine zwischenzeitliche Analyse oder ein
  // gelöschtes Abo auch auf einer alten Instanz im Verlauf sichtbar wird.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        // everStored unterscheidet "noch nie benutzt" von "alles gelöscht",
        // sonst kämen nach dem Löschen des letzten Abos die Demo-Daten zurück.
        const everStored = await hasStoredResults();
        const stored = await loadResults();
        if (!alive) return;
        // Ohne gespeicherte Abos wird die Demo-Liste nur angezeigt, nicht gespeichert.
        const demo = !everStored && stored.length === 0;
        setIsDemo(demo);
        setSubscriptions(demo ? normalizeList(DEMO_SUBSCRIPTIONS) : stored);
        setLoading(false);
      })();
      return () => { alive = false; };
    }, [])
  );

  /** Demo-Daten werden erst gespeichert, wenn der Nutzer wirklich etwas ändert. */
  async function ensurePersisted() {
    if (!isDemo) return;
    await setResults(subscriptions);
    setIsDemo(false);
  }

  const cancelledIds = new Set(subscriptions.filter(s => s.cancelled).map(s => s.id));

  // Bilanz aus allen als gekündigt markierten Abos. Die Markierung liegt im
  // Speicher, die Summe überlebt damit jedes Neuladen.
  const savings = cancelledSavings(subscriptions);

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

  async function markCancelled(subId: string) {
    setActiveModal(null);
    const sub = subscriptions.find(s => s.id === subId);
    if (!sub) return;
    await ensurePersisted();
    const next = await upsertSubscription({
      ...sub,
      cancelled: true,
      cancelledAt: sub.cancelledAt ?? new Date().toISOString().slice(0, 10),
    });
    setSubscriptions(next);
    setStorageWarning(lastPersistFailed());
  }

  /** Fehlklick zurücknehmen, damit die Bilanz ehrlich bleibt. */
  async function undoCancelled(subId: string) {
    setActiveModal(null);
    const sub = subscriptions.find(s => s.id === subId);
    if (!sub) return;
    await ensurePersisted();
    const next = await upsertSubscription({ ...sub, cancelled: false, cancelledAt: undefined });
    setSubscriptions(next);
    setStorageWarning(lastPersistFailed());
  }

  async function deleteSubscription(sub: Subscription) {
    const confirmed = Platform.OS === 'web'
      ? window.confirm(`„${sub.name}" wirklich aus deiner Liste entfernen?`)
      : await new Promise<boolean>(resolve => {
          Alert.alert(
            'Abo entfernen',
            `„${sub.name}" wirklich aus deiner Liste entfernen?`,
            [
              { text: 'Abbrechen', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Entfernen', style: 'destructive', onPress: () => resolve(true) },
            ],
          );
        });
    if (!confirmed) return;
    await ensurePersisted();
    const next = await removeSubscription(sub.id);
    setSubscriptions(next);
    setStorageWarning(lastPersistFailed());
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

  // Ältestes Kündigungsdatum für die Bilanz-Karte
  const firstCancelledAt = subscriptions
    .filter(s => s.cancelled && s.cancelledAt)
    .map(s => s.cancelledAt as string)
    .sort()[0] ?? null;

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Abos werden geladen …</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.push('/')}
            style={styles.backBtn}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            accessibilityRole="button"
            accessibilityLabel="Neu analysieren"
          >
            <Text style={styles.backText}>← Neu analysieren</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={shareResults}
            style={styles.shareBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Ergebnis teilen"
          >
            <Text style={styles.shareText}>Teilen 📤</Text>
          </TouchableOpacity>
        </View>

        {/* Bilanz aus allen gekündigten Abos */}
        <View style={[styles.balanceCard, savings.count === 0 && styles.balanceCardEmpty]}>
          <Text style={styles.balanceLabel}>Deine Ersparnis</Text>
          {savings.count === 0 ? (
            <Text style={styles.balanceEmptyText}>
              Noch nichts gekündigt. Sobald du ein Abo als gekündigt markierst, zählt Kündigo hier mit.
            </Text>
          ) : (
            <>
              <Text style={styles.balanceAmount}>{formatEur(savings.perMonth)}</Text>
              <Text style={styles.balanceSub}>pro Monat · {formatEur(savings.perYear)} pro Jahr</Text>
              <View style={styles.balanceFooter}>
                <Text style={styles.balanceFooterText}>
                  ✓ {savings.count} Abo{savings.count > 1 ? 's' : ''} gekündigt
                  {firstCancelledAt ? ` · seit ${formatDate(firstCancelledAt)}` : ''}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Hinweise */}
        {isDemo && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>
              👀 Beispieldaten. Deine Liste wird gespeichert, sobald du eine echte Analyse startest oder hier etwas änderst.
            </Text>
          </View>
        )}
        {storageWarning && (
          <View style={[styles.noticeBox, styles.noticeBoxDanger]}>
            <Text style={[styles.noticeText, { color: colors.danger }]}>
              ⚠️ Änderungen konnten nicht gespeichert werden. Im privaten Modus deines Browsers gehen sie beim Neuladen verloren.
            </Text>
          </View>
        )}

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
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      accessibilityRole="button"
                      accessibilityLabel={isCancelled ? `${sub.name}, Kündigung erledigt, Anleitung erneut öffnen` : `${sub.name} kündigen`}
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
        {sorted.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              Keine gespeicherten Abos. Starte eine neue Analyse, um deine Liste zu füllen.
            </Text>
          </View>
        ) : sorted.map(sub => (
          <SubscriptionCard
            key={sub.id}
            sub={sub}
            onCancel={() => openCancelModal(sub)}
            onDelete={() => deleteSubscription(sub)}
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

        <TouchableOpacity
          style={styles.shareFullBtn}
          onPress={shareResults}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Ergebnis teilen"
        >
          <Text style={styles.shareFullBtnText}>Ergebnis teilen 📤</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Cancellation Modal */}
      {activeModal && (
        <CancellationModal
          sub={activeModal}
          onClose={() => setActiveModal(null)}
          onMarkCancelled={() => markCancelled(activeModal.id)}
          onUndoCancelled={() => undoCancelled(activeModal.id)}
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
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
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

  deadlineBox: {
    backgroundColor: colors.surface2, borderRadius: 12, padding: 14,
    marginBottom: 20, borderWidth: 1, borderColor: colors.border,
  },
  deadlineBoxUrgent: {
    backgroundColor: `${colors.danger}12`, borderColor: `${colors.danger}35`,
  },
  deadlineTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  deadlineSub: { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },

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
  undoBtn: {
    backgroundColor: colors.surface2,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  undoBtnText: {
    fontSize: 16, fontWeight: '600',
    color: colors.textSecondary,
  },

  letterBtn: {
    backgroundColor: colors.surface2,
    borderRadius: 14, paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  letterBtnText: {
    fontSize: 15, fontWeight: '700',
    color: colors.textPrimary,
  },

  // Absenderdaten-Formular
  formHint: {
    fontSize: 12, color: colors.textTertiary,
    lineHeight: 17, marginBottom: 18,
  },
  formSectionLabel: {
    fontSize: 12, letterSpacing: 1, textTransform: 'uppercase',
    color: colors.textTertiary, fontWeight: '700',
    marginTop: 8, marginBottom: 4,
  },
  formRow: {
    flexDirection: 'row', gap: 10,
  },
  fieldLabel: {
    fontSize: 12, fontWeight: '600', color: colors.textTertiary,
    letterSpacing: 0.5, marginTop: 12, marginBottom: 6,
  },
  input: {
    backgroundColor: colors.surface2, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border,
    color: colors.textPrimary, fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12,
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

  // Bilanz
  balanceCard: {
    backgroundColor: `${colors.accent}12`, borderRadius: 18, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: `${colors.accent}35`,
  },
  balanceCardEmpty: {
    backgroundColor: colors.surface, borderColor: colors.border,
  },
  balanceLabel: {
    fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase',
    color: colors.textSecondary, fontWeight: '700', marginBottom: 6,
  },
  balanceAmount: {
    fontSize: 34, fontWeight: '800', color: colors.accent,
    letterSpacing: -1.2, marginBottom: 2,
  },
  balanceSub: { fontSize: 13, color: colors.textSecondary },
  balanceFooter: {
    marginTop: 12, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: `${colors.accent}25`,
  },
  balanceFooterText: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  balanceEmptyText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  // Frist auf der Karte
  deadlineRow: {
    paddingHorizontal: 16, paddingBottom: 10, marginTop: -4,
  },
  deadlineText: { fontSize: 12, color: colors.textSecondary },

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
  catBadgeText: { fontSize: 12, fontWeight: '600' },
  cardFreq: { fontSize: 12, color: colors.textTertiary },
  cancelledBadge: {
    backgroundColor: `${colors.accent}20`, borderRadius: 6,
    paddingVertical: 2, paddingHorizontal: 7,
    borderWidth: 1, borderColor: `${colors.accent}40`,
  },
  cancelledBadgeText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  cardAmountWrap: { alignItems: 'flex-end' },
  cardAmount: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  cardAmountLabel: { fontSize: 12, color: colors.textTertiary },

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

  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn: {
    borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12,
    borderWidth: 1, borderColor: colors.border,
  },
  deleteBtnText: { fontSize: 13, fontWeight: '600', color: colors.textTertiary },

  emptyBox: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 18,
    marginBottom: 12, borderWidth: 1, borderColor: colors.border,
  },
  emptyText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

  noticeBox: {
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  noticeBoxDanger: {
    backgroundColor: `${colors.danger}12`, borderColor: `${colors.danger}35`,
  },
  noticeText: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

  loadingWrap: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  loadingText: { fontSize: 14, color: colors.textSecondary },

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
