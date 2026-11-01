import { resolveCodeState } from './code-state';
import { describe, expect, it } from 'vitest';

describe('resolveCodeState', () => {
  it('returns the token payload when the backend serves the form', () => {
    const data = { mail: 'alice@example.test', lockUsername: false };
    expect(resolveCodeState(data)).toEqual({ kind: 'ready', data });
  });

  it('marks an expired or forged token as invalid', () => {
    expect(
      resolveCodeState({
        error: { name: 'InvalidTokenError', message: 'The token is invalid.' },
      })
    ).toEqual({ kind: 'invalid' });
  });

  it('keeps other backend errors for a generic failure state', () => {
    const error = { name: 'SystemError', message: 'Provider not found' };
    expect(resolveCodeState({ error })).toEqual({ kind: 'error', error });
  });

  it('reports a refused feature when the backend redirects instead', () => {
    expect(resolveCodeState({ url: '/login' })).toEqual({ kind: 'blocked' });
  });
});
