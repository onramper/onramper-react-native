import type { HybridView, HybridViewMethods, HybridViewProps } from 'react-native-nitro-modules';

// Spike #3: prove a Nitro View can host SwiftUI (via UIHostingController) — the
// mechanism the real OnramperCheckoutButtonView will use in Phase 2.
export interface NitroSpikeViewProps extends HybridViewProps {
  label: string;
}

export interface NitroSpikeViewMethods extends HybridViewMethods {}

// iOS-only (Android is a platformUnsupported stub during the migration), so the
// third Platforms param is scoped to swift — otherwise nitrogen also demands a
// Kotlin ViewManager implementation.
export type NitroSpikeView = HybridView<NitroSpikeViewProps, NitroSpikeViewMethods, { ios: 'swift' }>;
