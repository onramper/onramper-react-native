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
import * as Application from 'expo-application';
import { OnramperClient, type OnramperState, type QuoteResponse } from '@onramper/onramper-react-native';
import { ENV } from './env.local';
import { createDemoSession } from './createDemoSession';

type LogEntry = { level: 'info' | 'event' | 'error'; line: string };

const TX_DEFAULTS = {
  source: 'usd',
  destination: 'sol',
  amount: '100',
  paymentMethod: 'applepay',
  country: 'es',
  subdivision: '',
  walletNetwork: 'solana',
  walletAddress: 'Br2jjHYskB1JJikv3Qw2QcmWVQGfZvkJFng4ZEwiGSjv',
};

export default function App() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const [source, setSource] = useState(TX_DEFAULTS.source);
  const [destination, setDestination] = useState(TX_DEFAULTS.destination);
  const [amount, setAmount] = useState(TX_DEFAULTS.amount);
  const [paymentMethod, setPaymentMethod] = useState(TX_DEFAULTS.paymentMethod);
  const [country, setCountry] = useState(TX_DEFAULTS.country);
  const [subdivision, setSubdivision] = useState(TX_DEFAULTS.subdivision);
  const [walletNetwork, setWalletNetwork] = useState(TX_DEFAULTS.walletNetwork);
  const [walletAddress, setWalletAddress] = useState(TX_DEFAULTS.walletAddress);

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
    // Destroy any prior client so its listeners come off the native emitter
    // before we create a new one. Otherwise every retry doubles the handlers.
    client?.destroy();
    setQuote(null);
    setButton(null);

    let inflight: OnramperClient | null = null;
    try {
      info('minting demo session…');
      const session = await createDemoSession(ENV.demoToken);
      info(`minted session: ${session.sessionId}`);

      inflight = new OnramperClient({
        apiKey: ENV.apiKey,
        clientId: ENV.clientId,
        environment: 'development',
        logLevel: 'debug',
        theme: 'light',
        onSessionExpired: async () => {
          info('onSessionExpired invoked — refreshing');
          return createDemoSession(ENV.demoToken);
        },
      });
      setupClient(inflight);
      await inflight.initialize({ sessionId: session.sessionId, sessionToken: session.sessionToken });
      setClient(inflight);
      info('initialized OK');
    } catch (e: unknown) {
      // Tear down the half-initialized client so its listeners don't leak.
      inflight?.destroy();
      const err = e as { code?: string; message?: string; info?: Record<string, unknown> };
      fail(`init error: ${err.code ?? 'unknown'} — ${err.message ?? String(e)}`);
      if (err.info && Object.keys(err.info).length > 0) {
        fail(`  info: ${JSON.stringify(err.info)}`);
      }
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
          source,
          destination,
          amount: parsed,
          type: 'buy',
          country,
          subdivision: subdivision || undefined,
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

  const onSignOut = async () => {
    if (!client) return;
    try {
      await client.signOut();
      setQuote(null);
      setButton(null);
      info('signed out — OIDC tokens cleared, next checkout will re-present login');
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      fail(`signOut error: ${err.code ?? 'unknown'} — ${err.message ?? String(e)}`);
    }
  };

  const maskedKey = ENV.apiKey ? `${ENV.apiKey.slice(0, 8)}…${ENV.apiKey.slice(-4)}` : '(missing)';

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Onramper RN Example</Text>

          <Text style={styles.section}>Build info</Text>
          <Text style={styles.kv}>bundleId: {Application.applicationId ?? '(unknown)'}</Text>
          <Text style={styles.kv}>version: {Application.nativeApplicationVersion ?? '(unknown)'} ({Application.nativeBuildVersion ?? '(unknown)'})</Text>

          <View style={styles.divider} />
          <Text style={styles.section}>Credentials (from env.local.ts)</Text>
          <Text style={styles.kv}>apiKey: {maskedKey}</Text>
          <Text style={styles.kv}>clientId: {ENV.clientId || '(missing)'}</Text>
          <Text style={styles.kv}>demoToken: {ENV.demoToken ? '✓ loaded' : '(missing)'}</Text>
          <View style={{ height: 8 }} />
          <Button title="Configure + Initialize" onPress={onConfigureInitialize} />

          <View style={styles.divider} />
          <Text style={styles.section}>Transaction</Text>
          <Row>
            <Field label="payment" value={paymentMethod} onChangeText={setPaymentMethod} />
          </Row>
          <Row>
            <Field label="country" value={country} onChangeText={setCountry} compact />
            <Field label="subdivision" value={subdivision} onChangeText={setSubdivision} compact />
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
          <View style={{ height: 8 }} />
          <Button title="Sign out (clear OIDC)" onPress={onSignOut} disabled={!client} color="#CC0000" />

          {quote && (
            <>
              <View style={styles.divider} />
              <Text style={styles.section}>Quote</Text>
              <Text style={styles.kv}>ramp: {quote.ramp ?? '—'}</Text>
              <Text style={styles.kv}>rate: {quote.rate ?? '—'}</Text>
              <Text style={styles.kv}>networkFee: {quote.networkFee ?? '—'}</Text>
              <Text style={styles.kv}>transactionFee: {quote.transactionFee ?? '—'}</Text>
              <Text style={styles.kv}>payout: {quote.payout ?? '—'}</Text>
              {quote.errors?.length ? <Text style={styles.error}>errors: {JSON.stringify(quote.errors)}</Text> : null}
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
                style={[styles.log, l.level === 'error' && styles.error, l.level === 'event' && styles.eventLine]}
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
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  compact?: boolean;
  numeric?: boolean;
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
