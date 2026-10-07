import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';
import { SheetHeader } from './SheetHeader';

export function OptionSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: readonly { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: t.contentBg }]}>
        <SheetHeader title={title} onClose={onClose} />
        <FlatList
          data={options}
          keyExtractor={item => item.value}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: item.value === selected }}
              onPress={() => {
                onSelect(item.value);
                onClose();
              }}
              style={[styles.row, { borderBottomColor: t.border }]}>
              <Text style={[styles.rowLabel, { color: t.text }]}>{item.label}</Text>
              {item.value === selected ? <Text style={{ color: t.accent }}>✓</Text> : null}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { fontSize: 16 },
});
