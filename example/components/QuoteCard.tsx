import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { QuoteResponse } from '@onramper/onramper-react-native';
import { useTheme } from '../theme';
import { formatAmount } from '../utils/format';
import { Card } from './Card';

export function QuoteCard({
  quote,
  amount,
  fiat,
  cryptoSymbol,
}: {
  quote: QuoteResponse;
  amount: number;
  fiat: string;
  cryptoSymbol: string;
}) {
  const t = useTheme();
  const f = fiat.toUpperCase();
  const rows: [string, string][] = [
    ['You pay', `${formatAmount(amount)} ${f}`],
    ['You receive', `${formatAmount(quote.payout)} ${cryptoSymbol}`],
    ['Rate', `1 ${cryptoSymbol} ≈ ${formatAmount(quote.rate)} ${f}`],
    ['Network fee', `${formatAmount(quote.networkFee)} ${f}`],
    ['Transaction fee', `${formatAmount(quote.transactionFee)} ${f}`],
  ];
  if (quote.ramp) {
    rows.push(['Provider', quote.ramp.toUpperCase()]);
  }
  return (
    <Card title="Quote" style={styles.card}>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={[styles.label, { color: t.textSecondary }]}>{label}</Text>
          <Text style={[styles.value, { color: t.text }]}>{value}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 13 },
  value: { fontSize: 13, fontWeight: '500' },
});
