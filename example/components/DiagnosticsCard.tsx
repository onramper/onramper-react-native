import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { diagnosticStore, type DiagnosticLogFile } from '../utils/diagnostics';
import { MONO, useTheme } from '../theme';
import { Card } from './Card';
import { SheetHeader } from './SheetHeader';
import { SwitchRow } from './SwitchRow';

function fileSize(bytes: number): string {
  return bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Preview = { file: DiagnosticLogFile; text: string };

export function DiagnosticsCard() {
  const t = useTheme();
  const store = diagnosticStore;
  const [enabled, setEnabled] = useState(false);
  const [files, setFiles] = useState<DiagnosticLogFile[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!store) {
      setError('Diagnostic logging requires the native demo build.');
      setBusy(false);
      return;
    }
    Promise.all([store.getEnabled(), store.listFiles()])
      .then(([value, entries]) => {
        if (active) {
          setEnabled(value);
          setFiles(entries);
        }
      })
      .catch(() => {
        if (active) {
          setError('Could not load diagnostic logs.');
        }
      })
      .finally(() => {
        if (active) {
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, [store]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Could not update diagnostic logs.',
      );
    } finally {
      setBusy(false);
    }
  };

  const openFile = (file: DiagnosticLogFile) => {
    if (!store) {
      return;
    }
    setPreview({ file, text: '' });
    run(async () => {
      const text = await store.readFile(file.name);
      setPreview(current =>
        current?.file.name === file.name ? { file, text } : current,
      );
    });
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete all logs?',
      'This permanently deletes all saved diagnostic logs on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete all',
          style: 'destructive',
          onPress: () => {
            if (store) {
              run(async () => {
                await store.clearLogs();
                setFiles(await store.listFiles());
              });
            }
          },
        },
      ],
    );
  };

  return (
    <Card
      title="Diagnostic logs"
      footer="Logging is on by default. Daily files use UTC dates and stay on this device until shared. Logs are kept for up to 7 days and 5 MB; older entries are removed first. Provider messages may contain personal information."
    >
      <SwitchRow
        label="Save SDK logs"
        value={enabled}
        disabled={busy || !store}
        onValueChange={value => {
          if (store) {
            run(async () => {
              await store.setEnabled(value);
              setEnabled(value);
            });
          }
        }}
      />
      <View style={styles.actions}>
        <Text style={{ color: t.textSecondary }}>
          {files.length} files ·{' '}
          {fileSize(files.reduce((sum, file) => sum + file.sizeBytes, 0))}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh log files"
          disabled={busy || !store}
          onPress={() => {
            if (store) {
              run(async () => setFiles(await store.listFiles()));
            }
          }}
        >
          <Text style={{ color: t.accent }}>Refresh</Text>
        </Pressable>
      </View>
      {files.length === 0 && !busy ? (
        <Text style={{ color: t.textSecondary }}>No log files yet.</Text>
      ) : null}
      {files.map(file => (
        <View
          key={file.name}
          style={[styles.fileRow, { borderColor: t.border }]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${file.name}`}
            disabled={busy}
            onPress={() => openFile(file)}
            style={styles.fileName}
          >
            <Text style={{ color: t.text }}>{file.name}</Text>
            <Text style={[styles.detail, { color: t.textSecondary }]}>
              {fileSize(file.sizeBytes)} · UTC
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Share ${file.name}`}
            disabled={busy}
            onPress={() => {
              if (store) {
                run(() => store.shareFile(file.name));
              }
            }}
            hitSlop={8}
          >
            <Text style={{ color: t.accent }}>Share</Text>
          </Pressable>
        </View>
      ))}
      {busy && !preview ? (
        <ActivityIndicator accessibilityLabel="Loading logs" color={t.accent} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Delete all logs"
        disabled={busy || files.length === 0}
        onPress={confirmDelete}
      >
        <Text
          style={{ color: files.length === 0 ? t.textSecondary : t.danger }}
        >
          Delete all logs
        </Text>
      </Pressable>
      {error && !preview ? (
        <Text style={{ color: t.danger }}>{error}</Text>
      ) : null}
      <Modal
        visible={preview !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPreview(null)}
      >
        <View style={[styles.sheet, { backgroundColor: t.contentBg }]}>
          <SheetHeader title="Log preview" onClose={() => setPreview(null)} />
          <View style={styles.previewHeader}>
            <Text style={[styles.fileName, { color: t.text }]}>
              {preview?.file.name}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share open log file"
              disabled={busy}
              onPress={() => {
                if (store && preview) {
                  run(() => store.shareFile(preview.file.name));
                }
              }}
            >
              <Text style={{ color: t.accent }}>Share</Text>
            </Pressable>
          </View>
          {busy ? (
            <ActivityIndicator
              accessibilityLabel="Loading log preview"
              color={t.accent}
            />
          ) : null}
          {error ? (
            <Text style={[styles.previewHeader, { color: t.danger }]}>
              {error}
            </Text>
          ) : null}
          <ScrollView contentContainerStyle={styles.previewContent}>
            <Text selectable style={[styles.logText, { color: t.text }]}>
              {preview?.text || (busy ? '' : '(empty)')}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </Card>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  fileName: { flex: 1 },
  detail: { fontSize: 12, marginTop: 4 },
  sheet: { flex: 1 },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
  },
  previewContent: { padding: 16, paddingBottom: 48 },
  logText: { fontFamily: MONO, fontSize: 12, lineHeight: 18 },
});
