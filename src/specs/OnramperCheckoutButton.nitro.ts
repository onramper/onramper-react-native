import type { HybridView, HybridViewMethods, HybridViewProps } from 'react-native-nitro-modules';

// The native checkout button. Renders the SwiftUI OnramperCheckoutButton that
// getCheckoutRequirements() stashed under `intentHandle`, hosted via
// UIHostingController. iOS-only (Android is a platformUnsupported stub).
export interface OnramperCheckoutButtonProps extends HybridViewProps {
  intentHandle: string;
  /**
   * Called with the hosted SwiftUI content's height (points) whenever it changes —
   * e.g. when ToS text appears under the Buy button. React Native can't measure
   * the SwiftUI content itself, so the JS wrapper applies this as `height`.
   */
  onContentHeightChange?: (height: number) => void;
}

export interface OnramperCheckoutButtonMethods extends HybridViewMethods {}

export type OnramperCheckoutButton = HybridView<
  OnramperCheckoutButtonProps,
  OnramperCheckoutButtonMethods,
  { ios: 'swift' }
>;
