import React, { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { RADIUS, useTheme } from '../theme';

export function Card({
  title,
  footer,
  children,
  style,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.cardBg }, style]}>
      {title ? <Text style={[styles.title, { color: t.textSecondary }]}>{title}</Text> : null}
      {children}
      {footer ? <Text style={[styles.footer, { color: t.textSecondary }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: RADIUS.card, gap: 12 },
  title: { fontSize: 15, fontWeight: '500' },
  footer: { fontSize: 12, lineHeight: 16 },
});
