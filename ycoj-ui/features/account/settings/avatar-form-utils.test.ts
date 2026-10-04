import {
  AVATAR_MAX_BYTES,
  createAvatarSchema,
  getAvatarFormValues,
} from './avatar-form-utils';
import { describe, expect, it } from 'vitest';

const schema = createAvatarSchema({
  required: 'required',
  invalidEmail: 'email',
  invalidQq: 'qq',
  invalidUrl: 'url',
  fileRequired: 'file',
  fileTooLarge: 'size',
  invalidFileType: 'type',
});

describe('avatar form validation', () => {
  it.each(['photo.jpg', 'photo.jpeg', 'photo.PNG'])(
    'accepts %s at exactly 8 MiB',
    (name) => {
      const file = new File(['image'], name);
      Object.defineProperty(file, 'size', { value: AVATAR_MAX_BYTES });
      expect(
        schema.safeParse({ provider: 'upload', identifier: '', file }).success
      ).toBe(true);
    }
  );

  it('rejects an oversized image or unsupported extension', () => {
    const file = new File(['image'], 'avatar.png');
    Object.defineProperty(file, 'size', { value: AVATAR_MAX_BYTES + 1 });
    expect(
      schema.safeParse({ provider: 'upload', identifier: '', file }).success
    ).toBe(false);
    expect(
      schema.safeParse({
        provider: 'upload',
        identifier: '',
        file: new File(['image'], 'avatar.svg'),
      }).success
    ).toBe(false);
  });

  it('requires a file, validates provider inputs, and trims account identifiers', () => {
    expect(
      schema.safeParse({ provider: 'upload', identifier: '' }).success
    ).toBe(false);
    expect(
      schema.safeParse({ provider: 'gravatar', identifier: 'bad email' })
        .success
    ).toBe(false);
    expect(
      schema.safeParse({ provider: 'qq', identifier: 'abc' }).success
    ).toBe(false);
    expect(
      schema.parse({ provider: 'github', identifier: ' alice ' }).identifier
    ).toBe('alice');
  });

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,abc',
    'http://example.com/a.png',
    'https://user:pass@example.com/a.png',
    '//example.com/a.png',
  ])('rejects unsafe URL %s', (identifier) => {
    expect(schema.safeParse({ provider: 'url', identifier }).success).toBe(
      false
    );
  });

  it('accepts HTTPS URLs with queries and no file extension for content validation', () => {
    expect(
      schema.parse({
        provider: 'url',
        identifier: ' https://example.com/image?id=2 ',
      }).identifier
    ).toBe('https://example.com/image?id=2');
  });

  it('initializes provider, uploaded and external URL avatars', () => {
    expect(getAvatarFormValues('github:alice', 'mail@example.com')).toEqual({
      provider: 'github',
      identifier: 'alice',
    });
    expect(getAvatarFormValues('url:/file/2/.avatar.png', '')).toEqual({
      provider: 'upload',
      identifier: '',
    });
    expect(
      getAvatarFormValues('url:https://example.com/avatar.png', '')
    ).toEqual({
      provider: 'url',
      identifier: 'https://example.com/avatar.png',
    });
    expect(getAvatarFormValues('', 'mail@example.com')).toEqual({
      provider: 'gravatar',
      identifier: 'mail@example.com',
    });
  });
});
