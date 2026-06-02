import type { HybridView, HybridViewMethods, HybridViewProps } from 'react-native-nitro-modules';

// The native checkout button. Renders the SwiftUI OnramperCheckoutButton that
// getCheckoutRequirements() stashed under `intentHandle`, hosted via
// UIHostingController. iOS-only (Android is a platformUnsupported stub).
export interface OnramperCheckoutButtonProps extends HybridViewProps {
  intentHandle: string;
}

export interface OnramperCheckoutButtonMethods extends HybridViewMethods {}

export type OnramperCheckoutButton = HybridView<
  OnramperCheckoutButtonProps,
  OnramperCheckoutButtonMethods,
  { ios: 'swift' }
>;
