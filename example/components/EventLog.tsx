import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LogEntry } from '../hooks/useOnramper';
import { MONO, useTheme } from '../theme';
import { Card } from './Card';

export function EventLog({
  entries,
  onClear,
  initiallyOpen = false,
}: {
  entries: readonly LogEntry[];
  onClear?: () => void;
  initiallyOpen?: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(initiallyOpen);
  const colorFor = (level: LogEntry['level']) =>
    level === 'error' ? t.danger : level === 'event' ? t.accent : t.textSecondary;

  return (
    <Card>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="SDK events"
          accessibilityState={{ expanded: open }}
          onPress={() => setOpen(o => !o)}>
          <Text style={[styles.title, { color: t.textSecondary }]}>
            SDK events ({entries.length}) {open ? '▾' : '▸'}
          </Text>
        </Pressable>
        {open && onClear ? (
          <Pressable accessibilityRole="button" onPress={onClear} hitSlop={8}>
            <Text style={[styles.clear, { color: t.accent }]}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      {open ? (
        entries.length === 0 ? (
          <Text style={[styles.line, { color: t.textSecondary }]}>(empty)</Text>
        ) : (
          entries.map(e => (
            <Text key={e.id} selectable style={[styles.line, { color: colorFor(e.level) }]}>
              {e.time} {e.line}
            </Text>
          ))
        )
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 15, fontWeight: '500' },
  clear: { fontSize: 14, fontWeight: '600' },
  line: { fontFamily: MONO, fontSize: 11, lineHeight: 15 },
});
