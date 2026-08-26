import React, { useRef, useState } from 'react';
import {
  Button,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Application from 'expo-application';
import {
  OnramperClient,
  type OnramperState,
  type OnramperUserPrefill,
  type QuoteResponse,
} from '@onramper/onramper-react-native';
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

// Every prefill field is optional — supply only what your app actually knows.
//
// `email` and `phoneNumber` start blank deliberately. `email` is the binding
// identity: when it matches the account that signs in, the other values may be
// applied automatically, but when it does *not* match, the server drops the
// whole prefill — strictly worse than omitting it, where the values are still
// offered to the user for confirmation. Fill it in only to test that path.
const PREFILL_DEFAULTS = {
  email: '',
  firstName: 'Ada',
  lastName: 'Lovelace',
  phoneNumber: '',
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

  const [sendPrefill, setSendPrefill] = useState(true);
  const [prefillEmail, setPrefillEmail] = useState(PREFILL_DEFAULTS.email);
  const [prefillFirstName, setPrefillFirstName] = useState(PREFILL_DEFAULTS.firstName);
  const [prefillLastName, setPrefillLastName] = useState(PREFILL_DEFAULTS.lastName);
  const [prefillPhone, setPrefillPhone] = useState(PREFILL_DEFAULTS.phoneNumber);

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

  // Only fields the user actually filled in are sent: an omitted field is not
  // the same as an empty one, and a prefill with nothing in it is skipped
  // entirely rather than spending a request the server would reject.
  const buildPrefill = (): OnramperUserPrefill => {
    if (!sendPrefill) return {};
    const supplied = (v: string) => (v.trim() === '' ? undefined : v.trim());
    return {
      email: supplied(prefillEmail),
      firstName: supplied(prefillFirstName),
      lastName: supplied(prefillLastName),
      phoneNumber: supplied(prefillPhone),
    };
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
      const prefill = buildPrefill();
      // Log which fields were sent, never their values — they're user PII, and
      // the SDK makes the same guarantee at every log level.
      const prefilled = Object.entries(prefill)
        .filter(([, v]) => v !== undefined)
        .map(([k]) => k);
      info(`prefill: ${prefilled.length > 0 ? prefilled.join(', ') : 'none'}`);

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
        prefill,
      );
      setQuote(result.quote);
      setButton(result.button);
      info(`got intent: rate=${result.quote.rate} payout=${result.quote.payout}`);
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

          <View style={styles.divider} />
          <Text style={styles.section}>User prefill (optional)</Text>
          <View style={styles.switchRow}>
            <Switch value={sendPrefill} onValueChange={setSendPrefill} />
            <Text style={styles.switchLabel}>send prefill with the next request</Text>
          </View>
          <Text style={styles.note}>
            Pre-populates the OnramperID sign-in and additional-info screens. Best-effort: if it can't be applied,
            sign-in opens normally and nothing surfaces to the app. A prefilled phone is always a candidate — the user
            still verifies it.
          </Text>
          <Text style={styles.note}>
            email is left blank on purpose. It identifies which account the other values belong to: if it doesn't match
            the account that signs in, the whole prefill is dropped — worse than omitting it, where the values are still
            offered for confirmation.
          </Text>
          <Field
            label="email"
            value={prefillEmail}
            onChangeText={setPrefillEmail}
            placeholder="(blank — only if you're sure)"
            editable={sendPrefill}
          />
          <Row>
            <Field
              label="firstName"
              value={prefillFirstName}
              onChangeText={setPrefillFirstName}
              compact
              editable={sendPrefill}
            />
            <Field
              label="lastName"
              value={prefillLastName}
              onChangeText={setPrefillLastName}
              compact
              editable={sendPrefill}
            />
          </Row>
          <Field
            label="phoneNumber"
            value={prefillPhone}
            onChangeText={setPrefillPhone}
            placeholder="(blank — E.164, e.g. +3712345678)"
            editable={sendPrefill}
          />

          <View style={styles.divider} />
          <Button title="Get checkout requirements" onPress={onGetRequirements} disabled={!client} />
          <View style={{ height: 8 }} />
          <Button title="Reset SDK" onPress={onReset} disabled={!client} color="#888" />
          <View style={{ height: 8 }} />
          <Button title="Sign out (clear OIDC)" onPress={onSignOut} disabled={!client} color="#CC0000" />

          {quote && (
            <>
              <View style={styles.divider} />
              <Text style={styles.section}>Quote</Text>
              <Text style={styles.kv}>ramp: {quote.ramp}</Text>
              <Text style={styles.kv}>rate: {quote.rate}</Text>
              <Text style={styles.kv}>networkFee: {quote.networkFee}</Text>
              <Text style={styles.kv}>transactionFee: {quote.transactionFee}</Text>
              <Text style={styles.kv}>payout: {quote.payout}</Text>
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
  placeholder,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  compact?: boolean;
  numeric?: boolean;
  placeholder?: string;
  editable?: boolean;
}) {
  return (
    <View style={[styles.field, compact && { flex: 1 }]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, !editable && styles.inputDisabled]}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholder={placeholder}
        placeholderTextColor="#AAA"
        editable={editable}
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
  inputDisabled: { backgroundColor: '#EFEFEF', color: '#999' },
  row: { flexDirection: 'row', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  switchLabel: { fontSize: 13, color: '#333' },
  note: { fontSize: 11, color: '#777', lineHeight: 15, marginBottom: 8 },
  kv: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, marginVertical: 1 },
  log: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, marginVertical: 1, color: '#333' },
  eventLine: { color: '#0066CC' },
  error: { color: '#CC0000' },
  muted: { color: '#999', fontStyle: 'italic' },
  buttonHost: { minHeight: 88, marginBottom: 8 },
});
