import * as React from 'react';

import { OnramperReactNativeViewProps } from './OnramperReactNative.types';

export default function OnramperReactNativeView(props: OnramperReactNativeViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
