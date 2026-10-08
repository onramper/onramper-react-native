/**
 * Onramper RN (Nitro) demo app — modelled on oid-ios-demo.
 * The SDK initializes automatically (and again on environment / theme change or
 * after clearing sessions); Buy Crypto drives getCheckoutRequirements and the
 * native checkout button; Settings switches environment and appearance.
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { Appearance, StatusBar } from 'react-native';
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
  // Target of an in-flight environment switch; the picker is locked until that
  // environment's init run settles (ready or error).
  const [switchTarget, setSwitchTarget] = useState<AppEnvironment | null>(null);
  const switching = switchTarget !== null;
  const palette = PALETTES[isDark ? 'dark' : 'light'];
  const onramper = useOnramper({ environment, theme: palette.name, generation });

  // Native views follow the iOS appearance, not this in-app toggle: without
  // this, SwiftUI content such as the SDK button's ToS text (`.secondary`)
  // renders light-on-white when the phone is in dark mode and the app isn't.
  useEffect(() => {
    Appearance.setColorScheme(palette.name);
  }, [palette.name]);

  // Watch the settled environment rather than `status`: a failed run followed
  // by another failed run leaves `status` at 'error' throughout, which would
  // never unlock the picker.
  useEffect(() => {
    if (switchTarget !== null && environment === switchTarget && onramper.settledEnvironment === switchTarget) {
      setSwitchTarget(null);
    }
  }, [switchTarget, environment, onramper.settledEnvironment]);

  const changeEnvironment = async (next: AppEnvironment) => {
    if (next === environment || switching) {
      return;
    }
    setSwitchTarget(next);
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
    if (!c) {
      // Stored OnramperID tokens can only be cleared through an initialized
      // client; re-minting a demo session alone would leave them in place.
      throw new Error("The SDK isn't initialized, so there are no sessions to clear. Use Retry on the Buy screen.");
    }
    await c.signOut();
    await c.reset();
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
