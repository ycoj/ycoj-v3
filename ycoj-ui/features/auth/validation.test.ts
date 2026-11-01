import {
  isValidEmail,
  isValidUsername,
  PASSWORD_MIN_LENGTH,
} from './validation';
import { describe, expect, it } from 'vitest';

describe('isValidEmail', () => {
  it.each([
    ['alice@example.com', true],
    ['alice+tag@example.co.uk', true],
    ['alice@localhost', false],
    ['alice.example.com', false],
    ['alice@example', false],
    ['', false],
  ])('%s -> %s', (value, expected) => {
    expect(isValidEmail(value)).toBe(expected);
  });
});

describe('isValidUsername', () => {
  it.each([
    ['alice', true],
    ['a_b-c', true],
    ['张三', true],
    ['ab', false],
    ['a'.repeat(31), true],
    ['a'.repeat(32), false],
    ['   ', false],
  ])('%s -> %s', (value, expected) => {
    expect(isValidUsername(value)).toBe(expected);
  });
});

describe('PASSWORD_MIN_LENGTH', () => {
  it('matches the backend minimum password length', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(6);
  });
});
