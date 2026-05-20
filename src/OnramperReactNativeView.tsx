import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

import { OnramperReactNativeViewProps } from './OnramperReactNative.types';

const NativeView: React.ComponentType<OnramperReactNativeViewProps> =
  requireNativeViewManager('OnramperReactNative');

export default function OnramperReactNativeView(props: OnramperReactNativeViewProps) {
  return <NativeView {...props} />;
}
