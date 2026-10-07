import libraryPackage from '@onramper/onramper-react-native/package.json';

export const LIBRARY_VERSION: string = libraryPackage.version;
// `X.Y.Z` always bundles OnramperSDK X.Y.Z; wrapper-only releases are `X.Y.Z-N`.
export const BUNDLED_SDK_VERSION = LIBRARY_VERSION.split('-')[0];
