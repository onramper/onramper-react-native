import { getHostComponent } from 'react-native-nitro-modules';
import OnramperCheckoutButtonConfig from '../nitrogen/generated/shared/json/OnramperCheckoutButtonConfig.json';
import type { OnramperCheckoutButtonMethods, OnramperCheckoutButtonProps } from './specs/OnramperCheckoutButton.nitro';

export type { OnramperCheckoutButtonProps as OnramperCheckoutButtonViewProps };

/**
 * Native checkout button. Renders the SwiftUI `OnramperCheckoutButton` that
 * `OnramperClient.getCheckoutRequirements()` prepared, addressed by `intentHandle`.
 * Standard view props (e.g. `style`) are supported via `HybridViewProps`.
 */
export const OnramperCheckoutButtonView = getHostComponent<OnramperCheckoutButtonProps, OnramperCheckoutButtonMethods>(
  'OnramperCheckoutButton',
  () => OnramperCheckoutButtonConfig,
);
