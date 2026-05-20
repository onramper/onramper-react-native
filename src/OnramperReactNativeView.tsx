import { requireNativeView } from 'expo';
import * as React from 'react';

import { OnramperReactNativeViewProps } from './OnramperReactNative.types';

const NativeView: React.ComponentType<OnramperReactNativeViewProps> =
  requireNativeView('OnramperReactNative');

export default function OnramperReactNativeView(props: OnramperReactNativeViewProps) {
  return <NativeView {...props} />;
}
