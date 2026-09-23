import type { FileInfo } from '@/shared/types/file';

/**
 * Where a `file://` name or external URL is looked up. Mirrors the scope rules
 * of `resolveFileUrls`: contest markdown resolves against `tdoc.files` via
 * `/api/contest/{tid}/file/public/{name}`; problem markdown resolves against
 * `pdoc.additional_file` via `/api/p/{docId}/file/{name}?tid={tid}`.
 */
export type PrintAssetScope =
  | { kind: 'contest'; tid: string }
  | { kind: 'problem'; tid: string; problemId: number };

/**
 * An asset reference collected while converting a markdown section to Typst.
 * `uri` is the literal markdown target (`file://…`, `https://…`, `data:…`);
 * `url` is the fetchable URL after scope resolution, or `null` when the
 * reference cannot be resolved (surfaced as an `asset-unresolved` diagnostic).
 */
export type PrintAssetRef = {
  uri: string;
  url: string | null;
  scope: PrintAssetScope;
  /**
   * Deterministic shadow-FS filename (`asset-<hash>.<ext>`) emitted into the
   * generated Typst sources; the worker maps `path → bytes` via `fetchAsset`.
   */
  path: string;
};

/**
 * Asset provider living on the main thread. `resolveFile` maps a scoped file
 * name to a fetchable URL (or `null`); `fetchAsset` downloads resolved bytes
 * on behalf of the compile worker, which cannot reach credentialed endpoints
 * reliably and must stay free of URL policy.
 */
export type PrintAssetProvider = {
  resolveFile(scope: PrintAssetScope, filename: string): string | null;
  fetchAsset(url: string): Promise<Uint8Array>;
};

/**
 * Inputs needed to build the provider for one contest:
 * `tdoc.files` for the contest scope plus each `pdoc.additional_file` list
 * for problem scopes, keyed by `pdoc.docId`.
 */
export type ContestAssetProviderOptions = {
  tid: string;
  contestFiles: readonly FileInfo[];
  problemFiles: Readonly<Record<number, readonly FileInfo[]>>;
};

export type CreatePrintAssetProvider = (
  options: ContestAssetProviderOptions
) => PrintAssetProvider;
