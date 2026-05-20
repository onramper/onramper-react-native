import { registerWebModule, NativeModule } from 'expo';

import { OnramperReactNativeModuleEvents } from './OnramperReactNative.types';

class OnramperReactNativeModule extends NativeModule<OnramperReactNativeModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
}

export default registerWebModule(OnramperReactNativeModule, 'OnramperReactNativeModule');
