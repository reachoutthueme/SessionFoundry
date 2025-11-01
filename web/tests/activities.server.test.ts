// NOTE: This repository does not currently include a test runner.
// These tests are written for Vitest. To run them, install vitest
// and update package.json with a test script.

import { describe, it, expect } from 'vitest';
import { getServerHooks } from '@/lib/activities/server';

describe('Activity server hooks', () => {
  it('exposes brainstorm hooks', () => {
    const hooks = getServerHooks('brainstorm');
    expect(hooks).toBeTruthy();
    expect(hooks?.aggregateResults).toBeTypeOf('function');
    expect(hooks?.saveSubmission).toBeTypeOf('function');
  });

  it('exposes assignment hooks', () => {
    const hooks = getServerHooks('assignment');
    expect(hooks).toBeTruthy();
    expect(hooks?.aggregateResults).toBeTypeOf('function');
    expect(hooks?.saveSubmission).toBeTypeOf('function');
  });

  it('exposes stocktake hooks', () => {
    const hooks = getServerHooks('stocktake');
    expect(hooks).toBeTruthy();
    expect(hooks?.aggregateResults).toBeTypeOf('function');
    // optional response handler
    expect(typeof hooks?.saveResponse === 'function' || hooks?.saveResponse === undefined).toBe(true);
  });
});

