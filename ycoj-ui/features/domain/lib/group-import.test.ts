import {
  isValidGroupName,
  parseGroupImport,
  serializeGroups,
} from './group-import';
import { describe, expect, it } from 'vitest';

describe('group import parsing', () => {
  it('parses one group per line and deduplicates members', () => {
    const { groups, errors } = parseGroupImport(
      'ClassA,1001,1002,1002\n\nClassB,1004'
    );
    expect(errors).toEqual([]);
    expect(Array.from(groups.entries())).toEqual([
      ['ClassA', [1001, 1002]],
      ['ClassB', [1004]],
    ]);
  });

  it('strips a leading BOM and ignores blank lines', () => {
    const { groups } = parseGroupImport('﻿Team, 7 , 8 \n   \n');
    expect(groups.get('Team')).toEqual([7, 8]);
  });

  it.each([
    ['Team,abc', 'Line 1: invalid UID "abc".'],
    ['Team,0', 'Line 1: invalid UID "0".'],
    ['Team,-3', 'Line 1: invalid UID "-3".'],
    ['Team,1\nOther,x', 'Line 2: invalid UID "x".'],
  ])('reports invalid UIDs in %j', (text, message) => {
    const { errors } = parseGroupImport(text);
    expect(errors).toEqual([message]);
  });

  it('allows an empty member list', () => {
    const { groups, errors } = parseGroupImport('Empty,');
    expect(errors).toEqual([]);
    expect(groups.get('Empty')).toEqual([]);
  });
});

describe('group serialization', () => {
  it('writes group names followed by member UIDs', () => {
    expect(
      serializeGroups([
        { name: 'ClassA', uids: [1, 2] },
        { name: 'ClassB', uids: [] },
      ])
    ).toBe('ClassA,1,2\nClassB');
  });
});

describe('group name validation', () => {
  it.each([
    ['ClassA', true],
    ['  Group 1  ', true],
    ['', false],
    ['   ', false],
    ['bad,name', false],
    ['x'.repeat(256), false],
  ])('validates %j', (name, expected) => {
    expect(isValidGroupName(name)).toBe(expected);
  });
});
