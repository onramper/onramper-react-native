import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { DiagnosticsCard } from '../components/DiagnosticsCard';
import { EventLog } from '../components/EventLog';
import { Field } from '../components/Field';
import { Segmented } from '../components/Segmented';
import { SwitchRow } from '../components/SwitchRow';
import { ENVIRONMENTS, environmentLabel, type AppEnvironment } from '../config/environments';
import { BUNDLED_SDK_VERSION, LIBRARY_VERSION } from '../config/versions';
import type { TrustedLoginResult } from '../createDemoSession';
import type { LogEntry } from '../hooks/useOnramper';
import { RADIUS, useTheme, withAlpha } from '../theme';
import { describeError } from '../utils/format';
import { SheetHeader } from '../components/SheetHeader';

export interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  environment: AppEnvironment;
  onChangeEnvironment: (env: AppEnvironment) => void;
  switching: boolean;
  /** Email the current session was minted with ('' = trusted login off). */
  trustedLoginEmail: string;
  /** What the last mint reported for trusted login (null = not reported / failed). */
  trustedLogin: TrustedLoginResult | null;
  onApplyTrustedLoginEmail: (email: string) => Promise<void>;
  isDark: boolean;
  onChangeDark: (value: boolean) => void;
  onClearSessions: () => Promise<void>;
  log: readonly LogEntry[];
  onClearLog: () => void;
}

const ENV_OPTIONS = ENVIRONMENTS.map(value => ({ value, label: environmentLabel(value) }));

const TRUSTED_LOGIN_LABEL: Record<TrustedLoginResult, string> = { bound: 'Bound', unavailable: 'Unavailable' };

export function SettingsSheet(props: SettingsSheetProps) {
  const t = useTheme();
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState(props.trustedLoginEmail);
  const [applying, setApplying] = useState(false);

  // Start every visit (and every applied change) from the email actually in
  // use, so an abandoned edit never looks applied.
  useEffect(() => {
    if (props.visible) {
      setEmailDraft(props.trustedLoginEmail);
    }
  }, [props.visible, props.trustedLoginEmail]);

  const emailUnchanged = emailDraft.trim() === props.trustedLoginEmail;
  const applyDisabled = emailUnchanged || props.switching || applying;
  const trustedLoginStatus =
    props.trustedLoginEmail === '' ? 'Off' : props.trustedLogin ? TRUSTED_LOGIN_LABEL[props.trustedLogin] : '—';
  const trustedLoginColor =
    props.trustedLogin === 'bound' && props.trustedLoginEmail !== ''
      ? t.success
      : props.trustedLogin === 'unavailable' && props.trustedLoginEmail !== ''
        ? t.warning
        : t.textSecondary;

  const applyTrustedLogin = async () => {
    setApplying(true);
    try {
      await props.onApplyTrustedLoginEmail(emailDraft.trim());
    } finally {
      setApplying(false);
    }
  };

  const clearSessions = async () => {
    setClearing(true);
    setClearError(null);
    try {
      await props.onClearSessions();
      props.onClose();
    } catch (e: unknown) {
      const { code, message } = describeError(e);
      setClearError(`${code} — ${message}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <Modal visible={props.visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={props.onClose}>
      <View style={[styles.sheet, { backgroundColor: t.contentBg }]}>
        <SheetHeader title="Settings" onClose={props.onClose} />
        <ScrollView contentContainerStyle={styles.content}>
          <Card
            title="Environment"
            footer="Switching signs out, then re-initializes the SDK against the selected environment.">
            <Segmented
              options={ENV_OPTIONS}
              value={props.environment}
              onChange={props.onChangeEnvironment}
              disabled={props.switching}
            />
            {props.switching ? (
              <View style={styles.inline}>
                <ActivityIndicator color={t.accent} />
                <Text style={{ color: t.textSecondary }}>Switching environment…</Text>
              </View>
            ) : null}
          </Card>

          <Card
            title="Trusted partner login"
            footer={
              'Applying signs out, mints a demo session bound to this email and re-creates the SDK client, so ' +
              'Buy signs that user in to OnramperID without an OTP. Leave empty for normal OTP sign-in. The demo ' +
              'service only accepts @onramper.com and @moonpay.com addresses.'
            }>
            <Field
              label="Email"
              value={emailDraft}
              onChangeText={setEmailDraft}
              placeholder="you@onramper.com"
              keyboardType="email-address"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.aboutRow}>
              <Text style={{ color: t.textSecondary }}>Last session</Text>
              <Text testID="trusted-login-status" style={{ color: trustedLoginColor }}>
                {trustedLoginStatus}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Apply & restart session"
              accessibilityState={{ disabled: applyDisabled }}
              disabled={applyDisabled}
              onPress={applyTrustedLogin}
              style={[
                styles.secondary,
                { backgroundColor: withAlpha(t.accent, 0.15) },
                applyDisabled && styles.disabled,
              ]}>
              {applying ? (
                <ActivityIndicator color={t.accent} />
              ) : (
                <Text style={[styles.destructiveLabel, { color: t.accent }]}>Apply & restart session</Text>
              )}
            </Pressable>
          </Card>

          <Card footer="Signs out of OnramperID, resets checkout state, and re-initializes with a fresh demo session.">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear local sessions"
              disabled={clearing}
              onPress={clearSessions}
              style={[styles.destructive, { backgroundColor: withAlpha(t.danger, 0.15) }]}>
              {clearing ? (
                <ActivityIndicator color={t.danger} />
              ) : (
                <Text style={[styles.destructiveLabel, { color: t.danger }]}>Clear local sessions</Text>
              )}
            </Pressable>
            {clearError ? <Text style={{ color: t.danger }}>{clearError}</Text> : null}
          </Card>

          <Card title="Appearance" footer="Re-initializes the SDK with the matching theme.">
            <SwitchRow label="Dark mode" value={props.isDark} onValueChange={props.onChangeDark} />
          </Card>

          <DiagnosticsCard />

          <EventLog entries={props.log} onClear={props.onClearLog} />

          <Card title="About">
            {(
              [
                ['Library', LIBRARY_VERSION],
                ['OnramperSDK', BUNDLED_SDK_VERSION],
                ['Environment', environmentLabel(props.environment)],
              ] as const
            ).map(([label, value]) => (
              <View key={label} style={styles.aboutRow}>
                <Text style={{ color: t.textSecondary }}>{label}</Text>
                <Text style={{ color: t.text }}>{value}</Text>
              </View>
            ))}
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  destructive: { borderRadius: RADIUS.button, paddingVertical: 14, alignItems: 'center' },
  destructiveLabel: { fontSize: 16, fontWeight: '600' },
  secondary: { borderRadius: RADIUS.button, paddingVertical: 14, alignItems: 'center' },
  disabled: { opacity: 0.4 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
