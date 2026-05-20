import { NativeModule, requireNativeModule } from 'expo';

import { OnramperReactNativeModuleEvents } from './OnramperReactNative.types';

declare class OnramperReactNativeModule extends NativeModule<OnramperReactNativeModuleEvents> {
  PI: number;
  hello(): string;
  setValueAsync(value: string): Promise<void>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<OnramperReactNativeModule>('OnramperReactNative');
