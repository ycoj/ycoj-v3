import { createBrandingSchema } from './branding-form-utils';
import { describe, expect, it } from 'vitest';

const schema = createBrandingSchema({
  origin: 'origin',
  name: 'name',
  logo: 'logo',
  duplicate: 'duplicate',
  secureLogo: 'secureLogo',
});
const brand = {
  origin: 'https://school.edu',
  name: 'School OJ',
  logo: 'https://cdn.school.edu/logo.png',
};

describe('brand form validation', () => {
  it('accepts deleting every brand and distinct ports', () => {
    expect(schema.safeParse({ brands: [] }).success).toBe(true);
    expect(
      schema.safeParse({
        brands: [brand, { ...brand, origin: `${brand.origin}:8443` }],
      }).success
    ).toBe(true);
  });
  it('rejects normalized duplicates and insecure logos', () => {
    expect(
      schema.safeParse({
        brands: [brand, { ...brand, origin: 'https://SCHOOL.edu:443/' }],
      }).success
    ).toBe(false);
    expect(
      schema.safeParse({
        brands: [{ ...brand, logo: 'http://cdn.school.edu/logo.png' }],
      }).success
    ).toBe(false);
  });
});
