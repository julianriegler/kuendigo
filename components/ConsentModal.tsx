/**
 * Einmalige Einwilligungsabfrage vor der ersten Analyse.
 * Ohne Häkchen bleibt „Zustimmen" gesperrt, „Abbrechen" bricht die Analyse ab.
 */
import { useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView,
} from 'react-native';
import { colors } from '../constants/theme';
import { CONSENT_TITLE, CONSENT_POINTS, CONSENT_CHECKBOX_LABEL } from '../utils/consent';

export function ConsentModal({
  visible,
  onAccept,
  onCancel,
  onOpenPrivacy,
}: {
  visible: boolean;
  onAccept: () => void;
  onCancel: () => void;
  /** Schließt die Abfrage und öffnet die Datenschutzerklärung. */
  onOpenPrivacy: () => void;
}) {
  const [checked, setChecked] = useState(false);

  function accept() {
    if (!checked) return;
    setChecked(false);
    onAccept();
  }

  function cancel() {
    setChecked(false);
    onCancel();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={cancel}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={cancel} activeOpacity={1} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>{CONSENT_TITLE}</Text>
          <Text style={styles.subtitle}>
            Bevor deine Daten das Gerät verlassen, brauchen wir dein Einverständnis.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.body}>
            {CONSENT_POINTS.map((point, i) => (
              <View key={i} style={styles.pointRow}>
                <Text style={styles.pointDot}>•</Text>
                <Text style={styles.pointText}>{point}</Text>
              </View>
            ))}

            <TouchableOpacity
              onPress={() => { setChecked(false); onOpenPrivacy(); }}
              activeOpacity={0.7}
              accessibilityRole="link"
            >
              <Text style={styles.link}>Zur Datenschutzerklärung →</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => setChecked(v => !v)}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            accessibilityLabel={CONSENT_CHECKBOX_LABEL}
          >
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkboxLabel}>{CONSENT_CHECKBOX_LABEL}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptBtn, !checked && styles.acceptBtnDisabled]}
            onPress={accept}
            disabled={!checked}
            activeOpacity={0.85}
          >
            <Text style={[styles.acceptBtnText, !checked && styles.acceptBtnTextDisabled]}>
              Zustimmen
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={cancel} activeOpacity={0.8}>
            <Text style={styles.cancelBtnText}>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32,
    maxHeight: '88%',
    borderTopWidth: 1, borderColor: colors.border,
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.surface2,
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },

  title: {
    fontSize: 20, fontWeight: '800', color: colors.textPrimary,
    letterSpacing: -0.5, marginBottom: 6,
  },
  subtitle: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 16 },

  body: { marginBottom: 8 },
  pointRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pointDot: { fontSize: 13, color: colors.accent, lineHeight: 19 },
  pointText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  link: {
    fontSize: 13, color: colors.accent, marginTop: 2, marginBottom: 8,
    textDecorationLine: 'underline',
  },

  checkboxRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: colors.surface2, borderRadius: 12,
    padding: 14, marginTop: 8, marginBottom: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: colors.textTertiary,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxMark: { fontSize: 13, fontWeight: '800', color: colors.bg },
  checkboxLabel: { flex: 1, fontSize: 13, color: colors.textPrimary, lineHeight: 19 },

  acceptBtn: {
    backgroundColor: colors.accent, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginBottom: 10,
  },
  acceptBtnDisabled: { backgroundColor: colors.surface2 },
  acceptBtnText: { fontSize: 16, fontWeight: '700', color: colors.bg },
  acceptBtnTextDisabled: { color: colors.textTertiary },

  cancelBtn: { paddingVertical: 12, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
});
