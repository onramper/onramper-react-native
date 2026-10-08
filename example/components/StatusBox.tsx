import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MONO, RADIUS, useTheme, withAlpha } from '../theme';

export function StatusBox({
  tone,
  title,
  body,
  selectableBody,
  actionLabel,
  onAction,
}: {
  tone: 'success' | 'error';
  title: string;
  body?: string;
  selectableBody?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const t = useTheme();
  const color = tone === 'success' ? t.success : t.danger;
  return (
    <View style={[styles.box, { backgroundColor: withAlpha(color, 0.15), borderColor: color }]}>
      <Text style={[styles.title, { color }]}>{title}</Text>
      {body ? (
        <Text selectable={selectableBody} style={[styles.body, { color: t.text }, selectableBody && styles.mono]}>
          {body}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={[styles.action, { color }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: RADIUS.tile, padding: 12, gap: 6 },
  title: { fontSize: 15, fontWeight: '600' },
  body: { fontSize: 13 },
  mono: { fontFamily: MONO, fontSize: 12 },
  action: { fontSize: 14, fontWeight: '600' },
});
