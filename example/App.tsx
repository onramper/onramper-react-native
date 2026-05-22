import React, { useRef, useState } from 'react';
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { OnramperClient, type OnramperState, type QuoteResponse } from '@onramper/react-native';

type LogEntry = { level: 'info' | 'event' | 'error'; line: string };

const DEFAULTS = {
  apiKey: '',
  clientId: '',
  sessionId: '',
  sessionToken: '',
  // Test transaction defaults — adjust per partner.
  onramp: 'demo',
  source: 'usd',
  destination: 'eth',
  amount: '100',
  paymentMethod: 'creditcard',
  walletNetwork: 'ethereum',
  walletAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
};

export default function App() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [apiKey, setApiKey] = useState(DEFAULTS.apiKey);
  const [clientId, setClientId] = useState(DEFAULTS.clientId);
  const [sessionId, setSessionId] = useState(DEFAULTS.sessionId);
  const [sessionToken, setSessionToken] = useState(DEFAULTS.sessionToken);
  const [onramp, setOnramp] = useState(DEFAULTS.onramp);
  const [source, setSource] = useState(DEFAULTS.source);
  const [destination, setDestination] = useState(DEFAULTS.destination);
  const [amount, setAmount] = useState(DEFAULTS.amount);
  const [paymentMethod, setPaymentMethod] = useState(DEFAULTS.paymentMethod);
  const [walletNetwork, setWalletNetwork] = useState(DEFAULTS.walletNetwork);
  const [walletAddress, setWalletAddress] = useState(DEFAULTS.walletAddress);

  const [client, setClient] = useState<OnramperClient | null>(null);
  const [state, setState] = useState<OnramperState>({ kind: 'idle' });
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [button, setButton] = useState<React.ReactElement | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const append = (entry: LogEntry) => {
    setLog((l) => [...l, entry]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };
  const info = (line: string) => append({ level: 'info', line });
  const event = (line: string) => append({ level: 'event', line });
  const fail = (line: string) => append({ level: 'error', line });

  const setupClient = (c: OnramperClient) => {
    c.addStateListener((s) => {
      setState(s);
      event(`state → ${s.kind}${s.kind === 'failed' ? `: ${s.error.code}` : ''}`);
    });
    c.addEventListener('checkoutStarted', (e) => event(`checkout started: ${e.intentId}`));
    c.addEventListener('loginRequired', () => event('login required'));
    c.addEventListener('readyToCheckout', () => event('ready to checkout'));
    c.addEventListener('requirementSatisfied', (e) => event(`requirement satisfied: ${e.requirementType}`));
    c.addEventListener('checkoutFinalized', () => event('checkout finalized'));
    c.addEventListener('renderingStarted', (e) => event(`rendering: ${e.renderType} ${e.url}`));
    c.addEventListener('completed', (e) => event(`COMPLETED checkoutId=${e.checkoutId}`));
    c.addEventListener('failed', (e) => event(`FAILED: ${e.error.code} ${e.error.message}`));
  };

  const onConfigureInitialize = async () => {
    try {
      // Destroy any prior client so the bridge state is clean for re-runs.
      client?.destroy();
      setQuote(null);
      setButton(null);

      const c = new OnramperClient({
        apiKey,
        clientId,
        environment: 'development',
        // Real async — fetched on demand when the SDK calls it.
        onSessionExpired: async () => {
          info('onSessionExpired invoked — returning current creds');
          return { sessionId, sessionToken };
        },
      });
      setupClient(c);
      await c.initialize({ sessionId, sessionToken });
      setClient(c);
      info('initialized OK');
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      fail(`init error: ${err.code ?? 'unknown'} — ${err.message ?? String(e)}`);
    }
  };

  const onGetRequirements = async () => {
    if (!client) {
      fail('configure + initialize first');
      return;
    }
    try {
      const parsed = Number(amount);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        fail('amount must be a positive number');
        return;
      }
      const result = await client.getCheckoutRequirements(
        {
          onramp,
          source,
          destination,
          amount: parsed,
          type: 'buy',
          paymentMethod,
          wallet: { network: walletNetwork, address: walletAddress },
        },
        {
          backgroundColor: '#0A84FF',
          foregroundColor: '#FFFFFF',
          borderRadius: 12,
        },
      );
      setQuote(result.quote);
      setButton(result.button);
      info(`got intent: rate=${result.quote.rate ?? 'n/a'} payout=${result.quote.payout ?? 'n/a'}`);
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      fail(`getCheckoutRequirements error: ${err.code ?? 'unknown'} — ${err.message ?? String(e)}`);
    }
  };

  const onReset = async () => {
    if (!client) return;
    try {
      await client.reset();
      setQuote(null);
      setButton(null);
      info('reset OK');
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      fail(`reset error: ${err.code ?? 'unknown'} — ${err.message ?? String(e)}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Onramper RN Example</Text>

          <Text style={styles.section}>Credentials (staging)</Text>
          <Field label="apiKey" value={apiKey} onChangeText={setApiKey} secure />
          <Field label="clientId" value={clientId} onChangeText={setClientId} />
          <Field label="sessionId" value={sessionId} onChangeText={setSessionId} />
          <Field label="sessionToken" value={sessionToken} onChangeText={setSessionToken} secure />
          <Button title="Configure + Initialize" onPress={onConfigureInitialize} />

          <View style={styles.divider} />
          <Text style={styles.section}>Transaction</Text>
          <Row>
            <Field label="onramp" value={onramp} onChangeText={setOnramp} compact />
            <Field label="payment" value={paymentMethod} onChangeText={setPaymentMethod} compact />
          </Row>
          <Row>
            <Field label="source" value={source} onChangeText={setSource} compact />
            <Field label="destination" value={destination} onChangeText={setDestination} compact />
            <Field label="amount" value={amount} onChangeText={setAmount} compact numeric />
          </Row>
          <Field label="wallet.network" value={walletNetwork} onChangeText={setWalletNetwork} />
          <Field label="wallet.address" value={walletAddress} onChangeText={setWalletAddress} />
          <Button title="Get checkout requirements" onPress={onGetRequirements} disabled={!client} />
          <View style={{ height: 8 }} />
          <Button title="Reset SDK" onPress={onReset} disabled={!client} color="#888" />

          {quote && (
            <>
              <View style={styles.divider} />
              <Text style={styles.section}>Quote</Text>
              <Text style={styles.kv}>ramp: {quote.ramp ?? '—'}</Text>
              <Text style={styles.kv}>rate: {quote.rate ?? '—'}</Text>
              <Text style={styles.kv}>networkFee: {quote.networkFee ?? '—'}</Text>
              <Text style={styles.kv}>transactionFee: {quote.transactionFee ?? '—'}</Text>
              <Text style={styles.kv}>payout: {quote.payout ?? '—'}</Text>
              {quote.errors?.length ? (
                <Text style={styles.error}>errors: {JSON.stringify(quote.errors)}</Text>
              ) : null}
            </>
          )}

          {button && (
            <>
              <View style={styles.divider} />
              <Text style={styles.section}>Checkout button (native)</Text>
              <View style={styles.buttonHost}>{button}</View>
            </>
          )}

          <View style={styles.divider} />
          <Text style={styles.section}>State: {state.kind}</Text>

          <View style={styles.divider} />
          <Text style={styles.section}>Log</Text>
          {log.length === 0 ? (
            <Text style={styles.muted}>(empty)</Text>
          ) : (
            log.map((l, i) => (
              <Text
                key={`${i}-${l.line}`}
                style={[
                  styles.log,
                  l.level === 'error' && styles.error,
                  l.level === 'event' && styles.eventLine,
                ]}
              >
                {l.line}
              </Text>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  compact = false,
  numeric = false,
  secure = false,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  compact?: boolean;
  numeric?: boolean;
  secure?: boolean;
}) {
  return (
    <View style={[styles.field, compact && { flex: 1 }]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        secureTextEntry={secure}
      />
    </View>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F7F7' },
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  section: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 4, color: '#333' },
  divider: { height: 1, backgroundColor: '#E0E0E0', marginVertical: 16 },
  field: { marginBottom: 8 },
  label: { fontSize: 11, color: '#666', marginBottom: 2 },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 10,
    backgroundColor: '#FFF',
    fontSize: 14,
  },
  row: { flexDirection: 'row', gap: 8 },
  kv: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, marginVertical: 1 },
  log: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, marginVertical: 1, color: '#333' },
  eventLine: { color: '#0066CC' },
  error: { color: '#CC0000' },
  muted: { color: '#999', fontStyle: 'italic' },
  buttonHost: { minHeight: 88, marginBottom: 8 },
});
