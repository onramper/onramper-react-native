import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RADIUS, useTheme, withAlpha } from '../theme';

export interface DropdownOption<T extends string> {
  value: T;
  label: string;
}

/** A field showing the current choice; tapping it opens the options inline below. */
export function Dropdown<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find(o => o.value === value)?.label ?? value;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: current }}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(o => !o)}
        style={[styles.field, { backgroundColor: t.inputBg }]}
      >
        <Text style={[styles.value, { color: t.text }]}>{current}</Text>
        <Text style={[styles.chevron, { color: t.textSecondary }]}>
          {open ? '▴' : '▾'}
        </Text>
      </Pressable>
      {open ? (
        <View
          style={[
            styles.list,
            { borderColor: t.border, backgroundColor: t.cardBg },
          ]}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected }}
                onPress={() => {
                  setOpen(false);
                  if (!selected) {
                    onChange(option.value);
                  }
                }}
                style={({ pressed }) => [
                  styles.row,
                  index > 0 && {
                    borderTopColor: t.border,
                    borderTopWidth: StyleSheet.hairlineWidth,
                  },
                  (pressed || selected) && {
                    backgroundColor: withAlpha(
                      t.accent,
                      selected ? 0.15 : 0.08,
                    ),
                  },
                ]}
              >
                <Text style={[styles.value, { color: t.text }]}>
                  {option.label}
                </Text>
                {selected ? (
                  <Text style={[styles.check, { color: t.accent }]}>✓</Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: RADIUS.input,
    padding: 12,
  },
  value: { fontSize: 15 },
  chevron: { fontSize: 13 },
  list: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: RADIUS.input,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
  },
  check: { fontSize: 15, fontWeight: '600' },
});
