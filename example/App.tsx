import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, View, TextInput, Button, StyleSheet } from 'react-native';
import { OnramperClient } from '@onramper/react-native';

export default function App() {
  const [log, setLog] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState('');
  const [clientId, setClientId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [sessionToken, setSessionToken] = useState('');
  const [client, setClient] = useState<OnramperClient | null>(null);

  const append = (line: string) => setLog((l) => [...l, line]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Onramper RN Example</Text>
        <TextInput placeholder="apiKey" value={apiKey} onChangeText={setApiKey} style={styles.input} />
        <TextInput placeholder="clientId" value={clientId} onChangeText={setClientId} style={styles.input} />
        <TextInput placeholder="sessionId" value={sessionId} onChangeText={setSessionId} style={styles.input} />
        <TextInput placeholder="sessionToken" value={sessionToken} onChangeText={setSessionToken} style={styles.input} />
        <Button
          title="Configure + Initialize"
          onPress={async () => {
            try {
              const c = new OnramperClient({
                apiKey, clientId, environment: 'development',
                onSessionExpired: async () => ({ sessionId, sessionToken }),
              });
              await c.initialize({ sessionId, sessionToken });
              setClient(c);
              append('initialized');
            } catch (e: any) {
              append(`init error: ${e.code} ${e.message}`);
            }
          }}
        />
        <View style={{ height: 16 }} />
        <Text style={styles.subtitle}>Log</Text>
        {log.map((l, i) => (
          <Text key={i} style={styles.log}>{l}</Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  title: { fontSize: 22, fontWeight: '600', marginBottom: 12 },
  subtitle: { fontSize: 16, fontWeight: '500', marginTop: 16 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8, marginBottom: 8 },
  log: { fontFamily: 'Menlo', fontSize: 12, marginVertical: 2 },
});
