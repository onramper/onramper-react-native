/**
 * Onramper RN (Nitro) example.
 * Exercises configure → initialize → state/event streams, getCheckoutRequirements
 * (renders the native checkout button + quote), reset / signOut.
 *
 * @format
 */

import type { ReactElement } from 'react';
import { useRef, useState } from 'react';
import {
  Button,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  OnramperClient,
  type OnramperState,
  type OnramperUserPrefill,
  type QuoteResponse,
} from '@onramper/onramper-react-native';
import { ENV } from './env.local';
import { createDemoSession } from './createDemoSession';

const TX = {
  source: 'usd',
  destination: 'sol',
  amount: 100,
  paymentMethod: 'applepay',
  wallet: { network: 'solana', address: 'Br2jjHYskB1JJikv3Qw2QcmWVQGfZvkJFng4ZEwiGSjv' },
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

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const isDark = useColorScheme() === 'dark';
  const fg = isDark ? '#FFFFFF' : '#111111';
  const muted = isDark ? '#9A9A9A' : '#777777';
  const bg = isDark ? '#000000' : '#FFFFFF';

  const [log, setLog] = useState<{ level: 'info' | 'event' | 'error'; line: string }[]>([]);
  const [client, setClient] = useState<OnramperClient | null>(null);
  const [stateKind, setStateKind] = useState<OnramperState['kind']>('idle');
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [button, setButton] = useState<ReactElement | null>(null);
  const [sendPrefill, setSendPrefill] = useState(true);
  const [prefillEmail, setPrefillEmail] = useState(PREFILL_DEFAULTS.email);
  const [prefillFirstName, setPrefillFirstName] = useState(PREFILL_DEFAULTS.firstName);
  const [prefillLastName, setPrefillLastName] = useState(PREFILL_DEFAULTS.lastName);
  const [prefillPhone, setPrefillPhone] = useState(PREFILL_DEFAULTS.phoneNumber);
  const scrollRef = useRef<ScrollView>(null);

  const append = (level: 'info' | 'event' | 'error', line: string) => {
    setLog((l) => [...l, { level, line }]);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };
  const info = (l: string) => append('info', l);
  const event = (l: string) => append('event', l);
  const fail = (l: string) => append('error', l);

  const onConfigureInitialize = async () => {
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
        theme: 'dark',
        logLevel: 'debug',
        onSessionExpired: async () => {
          info('onSessionExpired — refreshing');
          return createDemoSession(ENV.demoToken);
        },
      });
      inflight.addStateListener((s) => {
        setStateKind(s.kind);
        event(`state → ${s.kind}${s.kind === 'failed' ? `: ${s.error.code}` : ''}`);
      });
      inflight.addEventListener('completed', (e) => event(`COMPLETED ${e.checkoutId}`));
      inflight.addEventListener('failed', (e) => event(`FAILED ${e.error.code} — ${e.error.message}`));

      await inflight.initialize({ sessionId: session.sessionId, sessionToken: session.sessionToken });
      setClient(inflight);
      info('initialized OK');
    } catch (e: unknown) {
      inflight?.destroy();
      const err = e as { code?: string; message?: string };
      fail(`init error: ${err.code ?? 'unknown'} — ${err.message ?? String(e)}`);
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
      const prefill = buildPrefill();
      // Log which fields were sent, never their values — they're user PII, and
      // the SDK makes the same guarantee at every log level.
      const prefilled = Object.entries(prefill)
        .filter(([, v]) => v !== undefined)
        .map(([k]) => k);
      info(`prefill: ${prefilled.length > 0 ? prefilled.join(', ') : 'none'}`);

      const result = await client.getCheckoutRequirements(
        { source: TX.source, destination: TX.destination, amount: TX.amount, type: 'buy', paymentMethod: TX.paymentMethod, wallet: TX.wallet },
        { backgroundColor: '#0A84FF', foregroundColor: '#FFFFFF', borderRadius: 12 },
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
      info('signed out — OIDC tokens cleared');
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      fail(`signOut error: ${err.code ?? 'unknown'} — ${err.message ?? String(e)}`);
    }
  };

  const maskedKey = ENV.apiKey ? `${ENV.apiKey.slice(0, 8)}…${ENV.apiKey.slice(-4)}` : '(missing)';

  return (
    <ScrollView
      ref={scrollRef}
      style={{ backgroundColor: bg }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top }]}
    >
      <Text style={[styles.title, { color: fg }]}>Onramper RN (Nitro)</Text>

      <Text style={[styles.kv, { color: muted }]}>apiKey: {maskedKey}</Text>
      <Text style={[styles.kv, { color: muted }]}>clientId: {ENV.clientId || '(missing)'}</Text>
      <Text style={[styles.kv, { color: muted }]}>demoToken: {ENV.demoToken ? '✓ loaded' : '(missing)'}</Text>

      <View style={styles.gap} />
      <Button title="Configure + Initialize" onPress={onConfigureInitialize} />

      <Text style={[styles.section, { color: fg }]}>User prefill (optional)</Text>
      <View style={styles.switchRow}>
        <Switch value={sendPrefill} onValueChange={setSendPrefill} />
        <Text style={[styles.switchLabel, { color: fg }]}>send prefill with the next request</Text>
      </View>
      <Text style={[styles.note, { color: muted }]}>
        Pre-populates the OnramperID sign-in and additional-info screens. Best-effort: if it can't be applied, sign-in
        opens normally and nothing surfaces to the app. A prefilled phone is always a candidate — the user still
        verifies it.
      </Text>
      <Text style={[styles.note, { color: muted }]}>
        email is left blank on purpose. It identifies which account the other values belong to: if it doesn't match the
        account that signs in, the whole prefill is dropped — worse than omitting it, where the values are still offered
        for confirmation.
      </Text>
      <PrefillField
        label="email"
        value={prefillEmail}
        onChangeText={setPrefillEmail}
        placeholder="(blank — only if you're sure)"
        editable={sendPrefill}
        fg={fg}
        muted={muted}
      />
      <PrefillField
        label="firstName"
        value={prefillFirstName}
        onChangeText={setPrefillFirstName}
        editable={sendPrefill}
        fg={fg}
        muted={muted}
      />
      <PrefillField
        label="lastName"
        value={prefillLastName}
        onChangeText={setPrefillLastName}
        editable={sendPrefill}
        fg={fg}
        muted={muted}
      />
      <PrefillField
        label="phoneNumber"
        value={prefillPhone}
        onChangeText={setPrefillPhone}
        placeholder="(blank — E.164, e.g. +3712345678)"
        editable={sendPrefill}
        fg={fg}
        muted={muted}
      />

      <View style={styles.gap} />
      <Button title="Get checkout requirements" onPress={onGetRequirements} disabled={!client} />
      <View style={styles.gap} />
      <Button title="Reset" onPress={onReset} color="#888" />
      <View style={styles.gap} />
      <Button title="Sign out" onPress={onSignOut} color="#CC0000" />

      {quote && (
        <>
          <Text style={[styles.section, { color: fg }]}>Quote</Text>
          <Text style={[styles.kv, { color: muted }]}>ramp: {quote.ramp}</Text>
          <Text style={[styles.kv, { color: muted }]}>rate: {quote.rate}</Text>
          <Text style={[styles.kv, { color: muted }]}>payout: {quote.payout}</Text>
        </>
      )}

      {button && (
        <>
          <Text style={[styles.section, { color: fg }]}>Checkout button (native):</Text>
          <View style={styles.buttonHost}>{button}</View>
        </>
      )}

      <Text style={[styles.section, { color: fg }]}>State: {stateKind}</Text>

      <Text style={[styles.section, { color: fg }]}>Log:</Text>
      {log.length === 0 ? (
        <Text style={[styles.italic, { color: muted }]}>(empty — tap Configure + Initialize)</Text>
      ) : (
        log.map((l, i) => (
          <Text
            key={`${i}-${l.line}`}
            style={[styles.logLine, { color: l.level === 'error' ? '#FF6B6B' : l.level === 'event' ? '#4DA3FF' : fg }]}
          >
            {l.line}
          </Text>
        ))
      )}
    </ScrollView>
  );
}

// Declared at module scope, not inside AppContent: a component defined inside
// the render body is a new type on every render, so React would remount the
// TextInput and drop focus after each keystroke.
function PrefillField({
  label,
  value,
  onChangeText,
  placeholder,
  editable,
  fg,
  muted,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  editable: boolean;
  fg: string;
  muted: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: muted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, { color: editable ? fg : muted, borderColor: muted }]}
        placeholder={placeholder}
        placeholderTextColor={muted}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  gap: { height: 8 },
  kv: { fontFamily: 'Menlo', fontSize: 12, marginVertical: 1 },
  section: { fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  buttonHost: { minHeight: 56, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  switchLabel: { fontSize: 13 },
  note: { fontSize: 11, lineHeight: 15, marginBottom: 8 },
  field: { marginBottom: 8 },
  fieldLabel: { fontSize: 11, marginBottom: 2 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14 },
  logLine: { fontFamily: 'Menlo', fontSize: 12, marginVertical: 1 },
  italic: { fontStyle: 'italic' },
});

export default App;
