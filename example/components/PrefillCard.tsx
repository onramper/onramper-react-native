import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { buildPrefill, prefillSummary, type PrefillForm } from '../checkout/prefill';
import { useTheme } from '../theme';
import { Card } from './Card';
import { Field } from './Field';
import { SwitchRow } from './SwitchRow';

export function PrefillCard({ value, onChange }: { value: PrefillForm; onChange: (next: PrefillForm) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const set = <K extends keyof PrefillForm>(key: K, v: PrefillForm[K]) => onChange({ ...value, [key]: v });
  const summary = prefillSummary(buildPrefill(value));

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Prefill"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(o => !o)}
        style={styles.header}>
        <Text style={[styles.title, { color: t.textSecondary }]}>Prefill</Text>
        <Text style={[styles.summary, { color: t.textSecondary }]}>
          {summary} {open ? '▾' : '▸'}
        </Text>
      </Pressable>
      {open ? (
        <View style={styles.body}>
          <SwitchRow label="Send prefill" value={value.enabled} onValueChange={v => set('enabled', v)} />
          <Text style={[styles.note, { color: t.textSecondary }]}>
            Pre-populates the OnramperID sign-in and additional-info screens. Best-effort: if it can't be applied,
            sign-in opens normally. A prefilled phone is still verified by the user.
          </Text>
          <Field
            label="First name"
            value={value.firstName}
            onChangeText={v => set('firstName', v)}
            editable={value.enabled}
          />
          <Field
            label="Last name"
            value={value.lastName}
            onChangeText={v => set('lastName', v)}
            editable={value.enabled}
          />
          <Field
            label="Phone (E.164)"
            value={value.phoneNumber}
            onChangeText={v => set('phoneNumber', v)}
            placeholder="+3712345678"
            keyboardType="phone-pad"
            editable={value.enabled}
          />
          <SwitchRow
            label="Send email"
            value={value.sendEmail}
            onValueChange={v => set('sendEmail', v)}
            disabled={!value.enabled}
          />
          <Field
            label="Email"
            value={value.email}
            onChangeText={v => set('email', v)}
            keyboardType="email-address"
            editable={value.enabled && value.sendEmail}
          />
          <Text style={[styles.note, { color: t.warning }]}>
            Email identifies which account the other values belong to. If it doesn't match the account that signs
            in, the whole prefill is dropped — only send it if you're sure.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '500' },
  summary: { fontSize: 12 },
  body: { gap: 10 },
  note: { fontSize: 12, lineHeight: 16 },
});
