import { AVATAR_MAX_BYTES, isAvatarImportUrl } from './avatar-url-import';
import { z } from 'zod';

export { AVATAR_MAX_BYTES } from './avatar-url-import';
export const AVATAR_ACCEPT = '.jpg,.jpeg,.png';
export const avatarProviders = [
  'gravatar',
  'github',
  'qq',
  'url',
  'upload',
] as const;

export type AvatarFormValues = {
  provider: (typeof avatarProviders)[number];
  identifier: string;
  file?: File;
};

export function getAvatarFormValues(
  avatar: string,
  mail: string
): AvatarFormValues {
  const separator = avatar.indexOf(':');
  const provider = avatar.slice(0, separator);
  if (provider === 'gravatar' || provider === 'github' || provider === 'qq') {
    return { provider, identifier: avatar.slice(separator + 1) };
  }
  if (provider === 'url' && isAvatarImportUrl(avatar.slice(separator + 1))) {
    return { provider: 'url', identifier: avatar.slice(separator + 1) };
  }
  return {
    provider: avatar.startsWith('url:/file/') ? 'upload' : 'gravatar',
    identifier: mail,
  };
}

export const createAvatarSchema = (messages: {
  required: string;
  invalidEmail: string;
  invalidQq: string;
  invalidUrl: string;
  fileRequired: string;
  fileTooLarge: string;
  invalidFileType: string;
}) =>
  z
    .object({
      provider: z.enum(avatarProviders),
      identifier: z.string().trim(),
      file: z.custom<File>((value) => value instanceof File).optional(),
    })
    .superRefine((values, ctx) => {
      const report = (path: string, message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
      if (values.provider === 'upload') {
        if (!values.file) report('file', messages.fileRequired);
        else if (!/\.(jpe?g|png)$/i.test(values.file.name))
          report('file', messages.invalidFileType);
        else if (values.file.size > AVATAR_MAX_BYTES)
          report('file', messages.fileTooLarge);
      } else if (!values.identifier) report('identifier', messages.required);
      else if (
        values.provider === 'gravatar' &&
        !z.string().email().safeParse(values.identifier).success
      )
        report('identifier', messages.invalidEmail);
      else if (
        values.provider === 'url' &&
        !isAvatarImportUrl(values.identifier)
      )
        report('identifier', messages.invalidUrl);
      else if (values.provider === 'qq' && !/^\d+$/.test(values.identifier))
        report('identifier', messages.invalidQq);
    });
