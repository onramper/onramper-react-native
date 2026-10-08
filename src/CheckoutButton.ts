import { createElement, useMemo, useState } from 'react';
import { callback } from 'react-native-nitro-modules';

import { OnramperCheckoutButtonView } from './OnramperCheckoutButtonView';

// Height of the bare Buy button. Used until native reports the measured content
// height so the first frame isn't collapsed.
export const CHECKOUT_BUTTON_FALLBACK_HEIGHT = 56;

export interface CheckoutButtonProps {
  intentHandle: string;
}

/**
 * Sizes the native checkout button to its SwiftUI content. The content grows when
 * the SDK shows ToS text under the Buy button (which can change after mount), and
 * Yoga can't measure a SwiftUI view — so native reports the height and it is
 * applied here as an explicit `height`.
 */
export function CheckoutButton({ intentHandle }: CheckoutButtonProps) {
  const [height, setHeight] = useState<number | null>(null);
  const onContentHeightChange = useMemo(() => callback((h: number) => setHeight(Math.ceil(h))), []);
  return createElement(OnramperCheckoutButtonView, {
    intentHandle,
    onContentHeightChange,
    style: { width: '100%', height: height ?? CHECKOUT_BUTTON_FALLBACK_HEIGHT },
  });
}
