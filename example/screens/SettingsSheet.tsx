import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../components/Card';
import { EventLog } from '../components/EventLog';
import { Segmented } from '../components/Segmented';
import { SwitchRow } from '../components/SwitchRow';
import { ENVIRONMENTS, environmentLabel, type AppEnvironment } from '../config/environments';
import { BUNDLED_SDK_VERSION, LIBRARY_VERSION } from '../config/versions';
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
  isDark: boolean;
  onChangeDark: (value: boolean) => void;
  onClearSessions: () => Promise<void>;
  log: readonly LogEntry[];
  onClearLog: () => void;
}

const ENV_OPTIONS = ENVIRONMENTS.map(value => ({ value, label: environmentLabel(value) }));

export function SettingsSheet(props: SettingsSheetProps) {
  const t = useTheme();
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

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
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
