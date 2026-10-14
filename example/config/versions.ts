import { Platform } from 'react-native';
import { OnramperClient } from '@onramper/onramper-react-native';
import libraryPackage from '@onramper/onramper-react-native/package.json';

export const LIBRARY_VERSION: string = libraryPackage.version;
// Read the compiled SDK so stale native builds cannot masquerade as the JS version.
export const BUNDLED_SDK_VERSION = Platform.OS === 'ios' ? OnramperClient.sdkVersion : 'iOS only';
