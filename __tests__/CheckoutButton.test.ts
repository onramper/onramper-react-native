import { type ElementType, createElement } from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';

import { CHECKOUT_BUTTON_FALLBACK_HEIGHT, CheckoutButton } from '../src/CheckoutButton';
import { OnramperCheckoutButtonView } from '../src/OnramperCheckoutButtonView';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface HostProps {
  intentHandle: string;
  style: { width: string; height: number };
  onContentHeightChange: { f: (height: number) => void };
}

function hostProps(renderer: ReactTestRenderer): HostProps {
  return renderer.root.findByType(OnramperCheckoutButtonView as ElementType).props as HostProps;
}

function render(): ReactTestRenderer {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(CheckoutButton, { intentHandle: 'h1' }));
  });
  return renderer;
}

// react-test-renderer 19 logs a one-time deprecation notice; filter only that message.
const realConsoleError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('react-test-renderer is deprecated')) return;
    realConsoleError(...args);
  });
});
afterAll(() => jest.restoreAllMocks());

describe('CheckoutButton', () => {
  it('uses the fallback height before native reports a measurement', () => {
    const props = hostProps(render());
    expect(props.intentHandle).toBe('h1');
    expect(props.style).toEqual({ width: '100%', height: CHECKOUT_BUTTON_FALLBACK_HEIGHT });
  });

  it('sizes the host view to the reported content height, rounded up', () => {
    const renderer = render();
    act(() => hostProps(renderer).onContentHeightChange.f(91.3));
    expect(hostProps(renderer).style.height).toBe(92);
  });

  it('follows the reported height down as well as up', () => {
    const renderer = render();
    act(() => hostProps(renderer).onContentHeightChange.f(104));
    act(() => hostProps(renderer).onContentHeightChange.f(50));
    expect(hostProps(renderer).style.height).toBe(50);
  });

  it('keeps the same callback across renders', () => {
    const renderer = render();
    const first = hostProps(renderer).onContentHeightChange;
    act(() => first.f(80));
    expect(hostProps(renderer).onContentHeightChange).toBe(first);
  });
});
