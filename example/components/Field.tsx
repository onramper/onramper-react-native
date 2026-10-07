import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { MONO, RADIUS, useTheme } from '../theme';

export function Field({ label, mono, style, ...input }: TextInputProps & { label?: string; mono?: boolean }) {
  const t = useTheme();
  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: t.textSecondary }]}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={t.textSecondary}
        autoCapitalize="none"
        autoCorrect={false}
        {...input}
        style={[
          styles.input,
          { backgroundColor: t.inputBg, color: input.editable === false ? t.textSecondary : t.text },
          mono && styles.mono,
          style,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  label: { fontSize: 12 },
  input: { borderRadius: RADIUS.input, padding: 12, fontSize: 15 },
  mono: { fontFamily: MONO, fontSize: 13 },
});
