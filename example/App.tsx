/**
 * Onramper RN (Nitro) demo app — modelled on oid-ios-demo.
 * The SDK initializes automatically (and again on environment / theme change or
 * after clearing sessions); Buy Crypto drives getCheckoutRequirements and the
 * native checkout button; Settings switches environment and appearance.
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DEFAULT_ENVIRONMENT, type AppEnvironment } from './config/environments';
import { useOnramper } from './hooks/useOnramper';
import { BuyCryptoScreen } from './screens/BuyCryptoScreen';
import { SettingsSheet } from './screens/SettingsSheet';
import { PALETTES, ThemeContext } from './theme';
import { describeError } from './utils/format';

function App() {
  const [isDark, setDark] = useState(true);
  const [environment, setEnvironment] = useState<AppEnvironment>(DEFAULT_ENVIRONMENT);
  const [generation, setGeneration] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const palette = PALETTES[isDark ? 'dark' : 'light'];
  const onramper = useOnramper({ environment, theme: palette.name, generation });

  // A switch finishes when the new environment's init settles (ready or error).
  useEffect(() => {
    if (onramper.status !== 'initializing') {
      setSwitching(false);
    }
  }, [onramper.status]);

  const changeEnvironment = async (next: AppEnvironment) => {
    if (next === environment || switching) {
      return;
    }
    setSwitching(true);
    try {
      await onramper.client?.signOut();
    } catch (e: unknown) {
      onramper.appendLog('error', `sign-out before switching failed: ${describeError(e).message}`);
    }
    onramper.appendLog('info', `switching environment → ${next}`);
    setEnvironment(next);
  };

  const clearSessions = async () => {
    const c = onramper.client;
    if (c) {
      await c.signOut();
      await c.reset();
    }
    onramper.appendLog('info', 'local sessions cleared — re-initializing');
    setGeneration(g => g + 1);
  };

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={palette}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <BuyCryptoScreen onramper={onramper} environment={environment} onOpenSettings={() => setSettingsOpen(true)} />
        <SettingsSheet
          visible={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          environment={environment}
          onChangeEnvironment={changeEnvironment}
          switching={switching}
          isDark={isDark}
          onChangeDark={setDark}
          onClearSessions={clearSessions}
          log={onramper.log}
          onClearLog={onramper.clearLog}
        />
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

export default App;
