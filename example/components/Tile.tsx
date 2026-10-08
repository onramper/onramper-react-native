import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, useTheme, withAlpha } from '../theme';

export function Tile({
  label,
  sublabel,
  selected,
  onPress,
  leading,
  disabled,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
  leading?: ReactNode;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          borderColor: selected ? t.accent : t.border,
          borderWidth: selected ? 1.5 : 1,
          backgroundColor: selected ? withAlpha(t.accent, 0.2) : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
        },
      ]}>
      {leading}
      <Text style={[styles.label, { color: t.text }]}>{label}</Text>
      {sublabel ? <Text style={[styles.sublabel, { color: t.textSecondary }]}>{sublabel}</Text> : null}
    </Pressable>
  );
}

export function TileRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  tile: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 8, borderRadius: RADIUS.tile, gap: 4 },
  label: { fontSize: 15, fontWeight: '600' },
  sublabel: { fontSize: 12 },
  row: { flexDirection: 'row', gap: 8 },
});
