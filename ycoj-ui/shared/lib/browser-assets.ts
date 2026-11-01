import assets from './browser-assets.json';

export function staticAssetUrl(path: string): string {
  const prefix = (process.env.NEXT_PUBLIC_STATIC_ASSET_PREFIX ?? '').replace(
    /\/+$/,
    ''
  );
  return `${prefix}${path}`;
}

export function browserAssetUrl(
  name: keyof typeof assets,
  file: string
): string {
  return staticAssetUrl(`/vendor/${name}@${assets[name].version}/${file}`);
}
