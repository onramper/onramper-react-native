import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useDebouncedField } from '../hooks/useDebounce';

let field!: [string, (value: string) => void];

function Harness({ committed, commit }: { committed: string; commit: (v: string) => void }) {
  field = useDebouncedField(committed, commit, 400);
  return null;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('commits only the last value, 400ms after typing stops', () => {
  const commit = jest.fn();
  act(() => {
    ReactTestRenderer.create(<Harness committed="100" commit={commit} />);
  });
  act(() => field[1]('1000'));
  act(() => jest.advanceTimersByTime(300));
  act(() => field[1]('10000'));
  act(() => jest.advanceTimersByTime(399));
  expect(commit).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(1));
  expect(commit).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledWith('10000');
  expect(field[0]).toBe('10000');
});

test('an external change to the committed value replaces the draft immediately without committing', () => {
  const commit = jest.fn();
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<Harness committed="walletA" commit={commit} />);
  });
  act(() => field[1]('walletA-typo'));
  act(() => renderer.update(<Harness committed="walletB" commit={commit} />));
  expect(field[0]).toBe('walletB');
  act(() => jest.advanceTimersByTime(1000));
  expect(commit).not.toHaveBeenCalled();
});
