import {
  DOMAIN_ID_PATTERN,
  buildCreateDomainPayload,
  validateCreateDomain,
} from './create-domain';
import { describe, expect, it } from 'vitest';

const messages = {
  invalidId: 'bad id',
  invalidName: 'bad name',
  invalidBulletin: 'bad bulletin',
};

describe('create domain validation', () => {
  it.each([
    ['school', true],
    ['School_2024', true],
    ['abc', false],
    ['1school', false],
    ['school-name', false],
    ['school name', false],
    ['x'.repeat(33), false],
  ])('validates the domain id %j', (id, valid) => {
    expect(DOMAIN_ID_PATTERN.test(id)).toBe(valid);
  });

  it('reports every missing field', () => {
    expect(
      validateCreateDomain(
        { id: '1x', name: ' ', bulletin: '', avatar: '' },
        messages
      )
    ).toEqual({
      id: 'bad id',
      name: 'bad name',
      bulletin: 'bad bulletin',
    });
  });

  it('accepts a complete form', () => {
    expect(
      validateCreateDomain(
        { id: 'school', name: 'School', bulletin: 'Welcome', avatar: '' },
        messages
      )
    ).toEqual({});
  });

  it('trims values and omits a blank avatar', () => {
    expect(
      buildCreateDomainPayload({
        id: ' school ',
        name: ' School ',
        bulletin: ' Welcome ',
        avatar: '  ',
      })
    ).toEqual({ id: 'school', name: 'School', bulletin: 'Welcome' });
  });

  it('keeps a provided avatar', () => {
    expect(
      buildCreateDomainPayload({
        id: 'school',
        name: 'School',
        bulletin: 'Welcome',
        avatar: 'url:https://example.test/logo.png',
      })
    ).toMatchObject({ avatar: 'url:https://example.test/logo.png' });
  });
});
