import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

/**
 * Header for page sheets, matching the SDK's own sheets (checkout / OnramperID
 * webviews): a secondary-coloured close mark on the leading edge and a centred
 * title.
 */
export function SheetHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.header}>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: t.text }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}
        hitSlop={12}
        style={styles.close}
      >
        <View
          style={[
            styles.bar,
            styles.barForward,
            { backgroundColor: t.textSecondary },
          ]}
        />
        <View
          style={[
            styles.bar,
            styles.barBack,
            { backgroundColor: t.textSecondary },
          ]}
        />
      </Pressable>
    </View>
  );
}

const MARK = 14;

const styles = StyleSheet.create({
  header: { height: 56, justifyContent: 'center', paddingHorizontal: 16 },
  // Absolutely centred so the close button doesn't push it off-centre.
  title: {
    position: 'absolute',
    left: 56,
    right: 56,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
  },
  close: {
    width: MARK + 16,
    height: MARK + 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    position: 'absolute',
    width: MARK * Math.SQRT2,
    height: 2.5,
    borderRadius: 1.25,
  },
  barForward: { transform: [{ rotate: '45deg' }] },
  barBack: { transform: [{ rotate: '-45deg' }] },
});
