/**
 * Onramper RN (Nitro) example — Phase 1 core module.
 * Exercises configure → initialize → state/event streams → reset / signOut.
 *
 * @format
 */

import { useRef, useState } from 'react';
import { Button, ScrollView, StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnramperClient, type OnramperState } from '@onramper/react-native';
import { ENV } from './env.local';
import { createDemoSession } from './createDemoSession';

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

  const onReset = async () => {
    if (!client) return;
    try {
      await client.reset();
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
      <View style={styles.gap} />
      <Button title="Reset" onPress={onReset} color="#888" />
      <View style={styles.gap} />
      <Button title="Sign out" onPress={onSignOut} color="#CC0000" />

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

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  gap: { height: 8 },
  kv: { fontFamily: 'Menlo', fontSize: 12, marginVertical: 1 },
  section: { fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  logLine: { fontFamily: 'Menlo', fontSize: 12, marginVertical: 1 },
  italic: { fontStyle: 'italic' },
});

export default App;
