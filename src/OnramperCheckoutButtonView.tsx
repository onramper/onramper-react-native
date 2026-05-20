import { requireNativeViewManager } from 'expo-modules-core';
// biome-ignore lint/style/useImportType: React must be a value import for the classic JSX runtime
import React from 'react';
import type { ViewProps } from 'react-native';
import type { OnramperErrorPayload } from './errors';

export interface OnramperCheckoutButtonViewProps extends ViewProps {
  intentHandle: string;
  onCheckoutCompleted?: (event: { nativeEvent: { checkoutId?: string } }) => void;
  onCheckoutFailed?: (event: { nativeEvent: OnramperErrorPayload }) => void;
  onCheckoutCancelled?: (event: { nativeEvent: Record<string, never> }) => void;
}

const NativeView = requireNativeViewManager<OnramperCheckoutButtonViewProps>('OnramperReactNative');

export const OnramperCheckoutButtonView: React.FC<OnramperCheckoutButtonViewProps> = (props) => {
  return <NativeView {...props} />;
};
