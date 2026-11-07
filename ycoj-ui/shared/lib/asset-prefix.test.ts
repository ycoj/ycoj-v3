import { normalizeAssetPrefix } from './asset-prefix';
import { describe, expect, it } from 'vitest';

describe('normalizeAssetPrefix', () => {
  it('keeps an empty value on the site origin', () => {
    expect(normalizeAssetPrefix(undefined)).toBeUndefined();
    expect(normalizeAssetPrefix('')).toBeUndefined();
    expect(normalizeAssetPrefix('   ')).toBeUndefined();
  });

  it('strips a trailing slash so Next can join /_next/static', () => {
    expect(normalizeAssetPrefix('https://next-cdn.ycoj.cc')).toBe(
      'https://next-cdn.ycoj.cc'
    );
    expect(normalizeAssetPrefix('https://next-cdn.ycoj.cc/')).toBe(
      'https://next-cdn.ycoj.cc'
    );
    expect(normalizeAssetPrefix(' https://cdn.example.com/assets/ ')).toBe(
      'https://cdn.example.com/assets'
    );
    const prefix = normalizeAssetPrefix('https://next-cdn.ycoj.cc/');
    expect(`${prefix}/_next/static/chunks/app.js`).toBe(
      'https://next-cdn.ycoj.cc/_next/static/chunks/app.js'
    );
  });

  it('rejects values Next cannot use as an asset host', () => {
    const rejected = [
      'next-cdn.ycoj.cc',
      '/cdn',
      'ftp://cdn.example.com',
      'https://user:pass@cdn.example.com',
      'https://cdn.example.com/assets?v=1',
      'https://cdn.example.com/assets#files',
    ];
    for (const value of rejected) {
      expect(() => normalizeAssetPrefix(value)).toThrow(/ASSET_PREFIX/);
    }
  });
});
