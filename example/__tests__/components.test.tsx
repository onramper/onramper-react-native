import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { QuoteCard } from '../components/QuoteCard';
import { PrefillCard } from '../components/PrefillCard';
import { EventLog } from '../components/EventLog';
import { Segmented } from '../components/Segmented';
import { DEFAULT_PREFILL } from '../checkout/prefill';

function text(renderer: ReactTestRenderer.ReactTestRenderer): string {
  return JSON.stringify(renderer.toJSON());
}

test('QuoteCard formats amounts like the iOS demo', () => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    r = ReactTestRenderer.create(
      <QuoteCard
        quote={{ quoteId: 'q', ramp: 'moonpay', rate: 152.3456, payout: 0.6543219, paymentMethod: 'applepay', networkFee: 0.012, transactionFee: 3.5 }}
        amount={100}
        fiat="usd"
        cryptoSymbol="SOL"
      />,
    );
  });
  const out = text(r);
  expect(out).toContain('100.00 USD');
  expect(out).toContain('0.654322 SOL');
  expect(out).toContain('1 SOL ≈ 152.35 USD');
  expect(out).toContain('0.012000 USD');
  expect(out).toContain('MOONPAY');
});

test('PrefillCard is off by default and can be turned on', () => {
  const onChange = jest.fn();
  let r!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    r = ReactTestRenderer.create(<PrefillCard value={DEFAULT_PREFILL} onChange={onChange} />);
  });
  expect(text(r)).toContain('Sends: nothing');
  const header = r.root.findByProps({ accessibilityLabel: 'Prefill' });
  act(() => header.props.onPress());
  const enable = r.root.findByProps({ accessibilityLabel: 'Send prefill' });
  act(() => enable.props.onValueChange(true));
  expect(onChange).toHaveBeenCalledWith({ ...DEFAULT_PREFILL, enabled: true });
});

test('EventLog lists entries once expanded', () => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    r = ReactTestRenderer.create(
      <EventLog entries={[{ id: 1, time: '12:00:00', level: 'event', line: 'state → ready' }]} />,
    );
  });
  expect(text(r)).not.toContain('state → ready');
  act(() => r.root.findByProps({ accessibilityLabel: 'SDK events' }).props.onPress());
  expect(text(r)).toContain('state → ready');
});

test('Segmented reports the tapped value', () => {
  const onChange = jest.fn();
  let r!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    r = ReactTestRenderer.create(
      <Segmented
        options={[
          { value: 'usd', label: 'USD' },
          { value: 'eur', label: 'EUR' },
        ]}
        value="usd"
        onChange={onChange}
      />,
    );
  });
  act(() => r.root.findByProps({ accessibilityLabel: 'EUR' }).props.onPress());
  expect(onChange).toHaveBeenCalledWith('eur');
});
