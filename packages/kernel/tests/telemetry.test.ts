import { expect, it } from 'vitest';

import { Telemetry } from '../src/index';

it('does not call sink when telemetry is disabled', () => {
  const events: string[] = [];
  const telemetry = new Telemetry(
    {
      enabled: false
    },
    event => events.push(event)
  );

  telemetry.track('ignored');

  expect(events).toEqual([]);
});

it('calls sink with event when telemetry is enabled', () => {
  const events: string[] = [];
  const telemetry = new Telemetry(
    {
      enabled: true
    },
    event => events.push(event)
  );

  telemetry.track('started');

  expect(events).toEqual(['started']);
});

it('tracks multiple events in order', () => {
  const events: string[] = [];
  const telemetry = new Telemetry(
    {
      enabled: true
    },
    event => events.push(event)
  );

  telemetry.track('one');
  telemetry.track('two');
  telemetry.track('three');

  expect(events).toEqual(['one', 'two', 'three']);
});
