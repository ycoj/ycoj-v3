import {
  appendCheckConnEntries,
  parseCheckConnFrame,
  parseCheckConnMessage,
} from './check-conn-log';
import { describe, expect, it } from 'vitest';

describe('check connection frames', () => {
  it('parses level payloads and splits multi-line messages', () => {
    expect(
      parseCheckConnFrame({ type: 'warn', payload: 'line one\nline two' })
    ).toEqual({ level: 'warn', lines: ['line one', 'line two'] });
  });

  it('serializes non-string payloads for display', () => {
    const entry = parseCheckConnFrame({ type: 'error', payload: { code: 1 } });
    expect(entry).toEqual({
      level: 'error',
      lines: ['{', '  "code": 1', '}'],
    });
  });

  it.each([
    ['keepalive ping', 'ping'],
    ['keepalive shorty', 'shorty'],
    ['unknown level', JSON.stringify({ type: 'debug', payload: 'x' })],
    ['malformed JSON', '{not json'],
  ])('ignores %s', (_label, message) => {
    expect(parseCheckConnMessage(message)).toBeNull();
  });

  it('accepts object frames as well as JSON strings', () => {
    expect(parseCheckConnMessage({ type: 'log', payload: 'ok' })).toEqual({
      level: 'log',
      lines: ['ok'],
    });
  });

  it('drops payloads and levels the backend never emits', () => {
    expect(parseCheckConnFrame({ type: 'log' })).toEqual({
      level: 'log',
      lines: [],
    });
    expect(parseCheckConnFrame({ payload: 'orphan' })).toBeNull();
    expect(parseCheckConnFrame(null)).toBeNull();
  });

  it('caps retained entries to the newest ones', () => {
    const entries = Array.from({ length: 4 }, (_, index) => ({
      level: 'log' as const,
      lines: [String(index)],
    }));
    const next = appendCheckConnEntries(
      entries,
      { level: 'error', lines: ['new'] },
      3
    );
    expect(next.map((entry) => entry.lines[0])).toEqual(['2', '3', 'new']);
  });

  it('keeps every entry when under the limit', () => {
    const entries = appendCheckConnEntries([], {
      level: 'log',
      lines: ['first'],
    });
    expect(entries).toHaveLength(1);
  });
});
