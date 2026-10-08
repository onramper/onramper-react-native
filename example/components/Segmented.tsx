import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, useTheme, withAlpha } from '../theme';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: t.inputBg, opacity: disabled ? 0.5 : 1 }]}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && { backgroundColor: withAlpha(t.accent, 0.25) }]}>
            <Text style={[styles.label, { color: selected ? t.text : t.textSecondary }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', borderRadius: RADIUS.input, padding: 2 },
  segment: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: RADIUS.input - 2 },
  label: { fontSize: 14, fontWeight: '600' },
});
