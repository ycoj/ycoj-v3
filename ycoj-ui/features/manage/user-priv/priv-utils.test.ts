import {
  describePrivDelta,
  privBits,
  toUserPrivOptions,
  togglePrivBit,
} from './priv-utils';
import { describe, expect, it } from 'vitest';

const priv = {
  PRIV_EDIT_SYSTEM: 1,
  PRIV_USER_PROFILE: 4,
  PRIV_JUDGE: 512,
  PRIV_SEND_MESSAGE: 16777216,
};

describe('user privilege helpers', () => {
  it('orders options by bit value and drops non-positive entries', () => {
    expect(toUserPrivOptions({ ...priv, PRIV_NONE: 0, PRIV_ALL: -1 })).toEqual([
      { name: 'PRIV_EDIT_SYSTEM', value: 1 },
      { name: 'PRIV_USER_PROFILE', value: 4 },
      { name: 'PRIV_JUDGE', value: 512 },
      { name: 'PRIV_SEND_MESSAGE', value: 16777216 },
    ]);
  });

  it('toggles bits without disturbing the rest of the mask', () => {
    expect(togglePrivBit(4, 512)).toBe(516);
    expect(togglePrivBit(516, 512)).toBe(4);
    expect(togglePrivBit(0, 1)).toBe(1);
  });

  it('lists the enabled privileges for display', () => {
    const options = toUserPrivOptions(priv);
    expect(privBits(5, options).map((option) => option.name)).toEqual([
      'PRIV_EDIT_SYSTEM',
      'PRIV_USER_PROFILE',
    ]);
  });

  it('describes additions and removals relative to the default mask', () => {
    const options = toUserPrivOptions(priv);
    expect(describePrivDelta(513, 4, options)).toEqual([
      { name: 'PRIV_EDIT_SYSTEM', sign: 'plus' },
      { name: 'PRIV_USER_PROFILE', sign: 'minus' },
      { name: 'PRIV_JUDGE', sign: 'plus' },
    ]);
    expect(describePrivDelta(-1, 4, options)).toEqual([
      { name: 'PRIV_ALL', sign: 'none' },
    ]);
    expect(describePrivDelta(0, 4, options)).toEqual([
      { name: 'PRIV_NONE', sign: 'none' },
    ]);
    expect(describePrivDelta(4, 4, options)).toEqual([]);
  });
});
