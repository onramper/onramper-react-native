/**
 * Sample React Native App — Nitro spike
 * Exercises spike proofs #1 ping, #2 SDK interop, #3 SwiftUI Nitro View, #4 event callback.
 *
 * @format
 */

import { useMemo, useState } from 'react';
import { Button, ScrollView, StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NitroModules, getHostComponent } from 'react-native-nitro-modules';
import type { OnramperNitro } from '@onramper/react-native/src/specs/OnramperNitro.nitro';
import type {
  NitroSpikeViewMethods,
  NitroSpikeViewProps,
} from '@onramper/react-native/src/specs/NitroSpikeView.nitro';
import NitroSpikeViewConfig from '@onramper/react-native/nitrogen/generated/shared/json/NitroSpikeViewConfig.json';

// Spike #3: the SwiftUI-backed Nitro view.
const SpikeView = getHostComponent<NitroSpikeViewProps, NitroSpikeViewMethods>(
  'NitroSpikeView',
  () => NitroSpikeViewConfig,
);

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

  const [log, setLog] = useState<string[]>([]);
  const append = (line: string) => setLog((l) => [...l, line]);

  const obj = useMemo(() => NitroModules.createHybridObject<OnramperNitro>('OnramperNitro'), []);

  const onPing = async () => {
    try {
      append(`ping → ${await obj.ping('hello')}`);
    } catch (e) {
      append(`ping ERROR: ${e}`);
    }
  };

  const onSdkProbe = async () => {
    try {
      append(`sdkProbe → ${await obj.sdkProbe()}`);
    } catch (e) {
      append(`sdkProbe ERROR: ${e}`);
    }
  };

  const onStartTicker = async () => {
    try {
      await obj.startTicker((count) => append(`TICK ${count}`));
      append('ticker started');
    } catch (e) {
      append(`startTicker ERROR: ${e}`);
    }
  };

  const onStopTicker = async () => {
    try {
      await obj.stopTicker();
      append('ticker stopped');
    } catch (e) {
      append(`stopTicker ERROR: ${e}`);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: bg }} contentContainerStyle={[styles.container, { paddingTop: insets.top }]}>
      <Text style={[styles.title, { color: fg }]}>Nitro spike</Text>

      <Button title="#1 Nitro ping" onPress={onPing} />
      <View style={styles.gap} />
      <Button title="#2 SDK probe" onPress={onSdkProbe} />
      <View style={styles.gap} />
      <Button title="#4 Start ticker" onPress={onStartTicker} />
      <View style={styles.gap} />
      <Button title="#4 Stop ticker" onPress={onStopTicker} color="#888" />

      <Text style={[styles.section, { color: fg }]}>#3 SwiftUI Nitro View:</Text>
      <SpikeView label="hello from SwiftUI" style={styles.spikeView} />

      <Text style={[styles.section, { color: fg }]}>Log:</Text>
      {log.length === 0 ? (
        <Text style={[styles.muted, { color: muted }]}>(empty — tap the buttons)</Text>
      ) : (
        log.map((l, i) => (
          <Text key={`${i}-${l}`} style={[styles.logLine, { color: fg }]}>
            {l}
          </Text>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48, flexGrow: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 16 },
  gap: { height: 8 },
  section: { fontSize: 14, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  spikeView: { height: 60, width: '100%', borderWidth: 1, borderColor: '#CCC', borderRadius: 8 },
  logLine: { fontFamily: 'Menlo', fontSize: 12, marginVertical: 1 },
  muted: { fontStyle: 'italic' },
});

export default App;
