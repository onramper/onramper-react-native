import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { diagnosticStore } from '../utils/diagnostics';
import { useTheme } from '../theme';
import { Card } from './Card';
import { SwitchRow } from './SwitchRow';

export function DiagnosticsCard() {
  const t = useTheme();
  const store = diagnosticStore;
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!store) {
      setError('Diagnostic logging requires the native demo build.');
      return;
    }
    store
      .getEnabled()
      .then(value => {
        if (active) {
          setEnabled(value);
        }
      })
      .catch(() => {
        if (active) {
          setError('Could not read logging settings.');
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [store]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Could not update diagnostic logs.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Diagnostic logs"
      footer="Enable before reproducing an issue, then share the file. Logs stay on this device until shared, expire after 7 days, and are limited to 5 MB. Provider messages may contain personal information."
    >
      <SwitchRow
        label="Save SDK logs"
        value={enabled}
        disabled={busy}
        onValueChange={value => {
          if (store) {
            run(async () => {
              await store.setEnabled(value);
              setEnabled(value);
            });
          }
        }}
      />
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            if (store) {
              run(() => store.shareLogs());
            }
          }}
        >
          <Text style={{ color: t.accent }}>Share logs</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            if (store) {
              run(() => store.clearLogs());
            }
          }}
        >
          <Text style={{ color: t.danger }}>Delete logs</Text>
        </Pressable>
      </View>
      {error ? <Text style={{ color: t.danger }}>{error}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 24 },
});
