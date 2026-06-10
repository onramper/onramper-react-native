// Minimal `react-native` mock for the node/ts-jest environment. The real module
// can't load outside a RN runtime; tests only need `Platform`. Defaults to 'ios'
// so the iOS-only native-creation guard in OnramperNative passes.
export const Platform = {
  OS: 'ios' as 'ios' | 'android' | 'web',
  select: <T,>(specifics: { ios?: T; android?: T; default?: T }): T | undefined =>
    specifics.ios ?? specifics.default,
};
