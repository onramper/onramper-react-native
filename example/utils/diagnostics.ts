import { NativeModules } from 'react-native';
import type { OnramperLogRecord } from '@onramper/onramper-react-native';

type DiagnosticStore = {
  appendRecord: (json: string) => void;
  getEnabled: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<void>;
  clearLogs: () => Promise<void>;
  shareLogs: () => Promise<void>;
};

export const diagnosticStore = NativeModules.DemoDiagnostics as
  | DiagnosticStore
  | undefined;

/** Only SDK diagnostic records are persisted; the event panel stays separate. */
export function recordDiagnostic(record: OnramperLogRecord): void {
  diagnosticStore?.appendRecord(JSON.stringify(record));
}
