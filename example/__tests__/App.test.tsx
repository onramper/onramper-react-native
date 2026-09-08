/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('../env.local', () => ({
  ENV: { apiKey: '', clientId: '', demoToken: '' },
}), { virtual: true });

jest.mock('@onramper/onramper-react-native', () => ({
  OnramperClient: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0 }),
}));

import App from '../App';

test('renders an empty Onramper transaction ID before finalization', async () => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<App />);
  });
  expect(JSON.stringify(renderer.toJSON())).toContain('Onramper transaction ID');
  expect(JSON.stringify(renderer.toJSON())).toContain('—');
});
