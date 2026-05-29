/**
 * Sample React Native App — Nitro spike
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { useState } from 'react';
import { Button, StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NitroModules } from 'react-native-nitro-modules';
import type { OnramperNitro } from '@onramper/react-native/src/specs/OnramperNitro.nitro';

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
  const [result, setResult] = useState<string>('');

  const onPing = async () => {
    try {
      const obj = NitroModules.createHybridObject<OnramperNitro>('OnramperNitro');
      const res = await obj.ping('hello');
      console.log('NITRO PING:', res);
      setResult(res);
    } catch (e) {
      console.error('NITRO PING ERROR:', e);
      setResult(String(e));
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Button title="Nitro ping" onPress={onPing} />
      {result ? <Text style={styles.result}>{result}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  result: {
    marginTop: 16,
    fontSize: 16,
  },
});

export default App;
