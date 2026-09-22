import md5 from '@/shared/lib/md5';

const providers: Record<string, (id: string, size?: number) => string> = {
  gravatar: (email: string, size?: number) =>
    `https://gravatar.loli.net/avatar/${md5((email || '').toString().trim().toLowerCase())}?d=mm&s=${size || 32}`,
  qq: (id: string) =>
    `//q1.qlogo.cn/g?b=qq&nk=${(/(\d+)/g.exec(id) || ['', ''])[1]}&s=160`,
  github: (id: string, size?: number) =>
    `//github.com/${id}.png?size=${Math.min(size || 460, 460)}`,
};

export default function avatarUrl(avatar: string, size = 64): string {
  if (!avatar || avatar.split(':').length < 2) return '';
  const provider = avatar.split(':')[0];
  if (!providers[provider]) return '';
  return providers[provider](avatar.slice(provider.length + 1), size);
}
