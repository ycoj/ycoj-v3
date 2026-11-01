import assets from './browser-assets.json';

export function browserAssetUrl(
  name: keyof typeof assets,
  file: string
): string {
  return `/vendor/${name}@${assets[name].version}/${file}`;
}
