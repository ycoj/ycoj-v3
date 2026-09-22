import type {
  ContestAssetProviderOptions,
  CreatePrintAssetProvider,
} from './assets';

/**
 * Asset provider for contest print documents. `resolveFile` mirrors the URL
 * rules used elsewhere in the app (`resolveFileUrls` in
 * `shared/components/Editor/utils.ts`): contest-scope names come from
 * `tdoc.files` and resolve to `/api/contest/{tid}/file/public/{name}`, while
 * problem-scope names come from `pdoc.additional_file` and resolve to
 * `/api/p/{docId}/file/{name}?tid={tid}`. `fetchAsset` performs a plain
 * same-origin fetch, so cookies apply.
 */
export const createContestAssetProvider: CreatePrintAssetProvider = (
  options: ContestAssetProviderOptions
) => {
  const contestNames = new Set(options.contestFiles.map((file) => file.name));
  const problemNames = new Map<number, Set<string>>();
  for (const [docId, files] of Object.entries(options.problemFiles)) {
    problemNames.set(Number(docId), new Set(files.map((file) => file.name)));
  }
  const tid = encodeURIComponent(options.tid);
  return {
    resolveFile(scope, filename) {
      if (scope.kind === 'contest') {
        return contestNames.has(filename)
          ? `/api/contest/${tid}/file/public/${encodeURIComponent(filename)}`
          : null;
      }
      const names = problemNames.get(scope.problemId);
      if (!names?.has(filename)) return null;
      return `/api/p/${scope.problemId}/file/${encodeURIComponent(filename)}?tid=${tid}`;
    },
    async fetchAsset(url) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch asset ${url}: ${response.status}`);
      }
      return new Uint8Array(await response.arrayBuffer());
    },
  };
};
