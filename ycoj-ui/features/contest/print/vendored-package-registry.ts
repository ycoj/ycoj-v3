import type { TypstPackageInput } from './typst-protocol';

/**
 * Minimal structural mirrors of the typst.ts `WritableAccessModel` /
 * `PackageRegistry` contracts. Declared locally so this module stays free of
 * `@myriaddreamin` imports and can be unit-tested in plain Node.
 */
export type PackageSpec = {
  namespace: string;
  name: string;
  version: string;
};

export type PackageResolveContext = {
  untar(
    data: Uint8Array,
    callback: (path: string, data: Uint8Array, mtime: number) => void
  ): void;
};

export interface WritableAccessModelLike {
  insertFile(path: string, data: Uint8Array, mtime: Date): void;
  removeFile(path: string): void;
}

type PackageKey = `${string}/${string}/${string}`;

const keyOf = (spec: PackageSpec): PackageKey =>
  `${spec.namespace}/${spec.name}/${spec.version}`;

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;
/** POSIX ustar archives carry the literal `ustar` at byte offset 257. */
const TAR_MAGIC_OFFSET = 257;
const TAR_MAGIC = 'ustar';

function looksLikeRawTar(bytes: Uint8Array): boolean {
  if (bytes.length < TAR_MAGIC_OFFSET + TAR_MAGIC.length) return false;
  for (let i = 0; i < TAR_MAGIC.length; i += 1) {
    if (bytes[TAR_MAGIC_OFFSET + i] !== TAR_MAGIC.charCodeAt(i)) return false;
  }
  return true;
}

/**
 * Normalize vendored package bytes for `ctx.untar`, which expects gzipped
 * tar. Servers/CDN may attach `Content-Encoding: gzip` to `*.tar.gz`
 * responses so `fetch` transparently decompresses and the staged bytes are
 * raw tar — detect that (`ustar` magic at offset 257) and re-gzip via
 * `CompressionStream`. Gzipped input and unrecognized payloads pass through
 * untouched so downstream reports the original error.
 */
export async function ensureGzippedTarball(
  bytes: Uint8Array
): Promise<Uint8Array> {
  if (
    bytes.length >= 2 &&
    bytes[0] === GZIP_MAGIC_0 &&
    bytes[1] === GZIP_MAGIC_1
  ) {
    return bytes;
  }
  if (!looksLikeRawTar(bytes)) return bytes;
  const stream = new Blob([bytes as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Offline `PackageRegistry`: serves `@preview/<name>:<version>` imports from
 * tarballs transferred at init instead of hitting packages.typst.org. Each
 * requested spec is untarred once into the access model under
 * `/@memory/vendored/<ns>/<name>/<version>` and that directory is returned;
 * unsupported specs resolve to `undefined` so Typst reports a package error
 * rather than fetching anything.
 */
export class VendoredPackageRegistry {
  private readonly accessModel: WritableAccessModelLike;
  private readonly tarballs = new Map<PackageKey, Uint8Array>();
  private readonly resolved = new Map<PackageKey, string>();

  constructor(
    accessModel: WritableAccessModelLike,
    packages: readonly TypstPackageInput[]
  ) {
    this.accessModel = accessModel;
    for (const pkg of packages) {
      this.tarballs.set(
        keyOf({
          namespace: pkg.namespace,
          name: pkg.name,
          version: pkg.version,
        }),
        new Uint8Array(pkg.tarball)
      );
    }
  }

  resolve(
    spec: PackageSpec,
    context: PackageResolveContext
  ): string | undefined {
    const key = keyOf(spec);
    const cached = this.resolved.get(key);
    if (cached !== undefined) return cached;

    const tarball = this.tarballs.get(key);
    if (tarball === undefined || spec.namespace !== 'preview') {
      return undefined;
    }
    const root = `/@memory/vendored/${spec.namespace}/${spec.name}/${spec.version}`;
    const entries: Array<[string, Uint8Array, Date]> = [];
    context.untar(tarball, (path, data, mtime) => {
      // Tar members are rooted at the package dir already in some archives;
      // strip a leading "./" so insertion paths stay absolute and canonical.
      const member = path.replace(/^\.?\//, '');
      if (member.length === 0) return;
      entries.push([`${root}/${member}`, data, new Date(mtime)]);
    });
    if (entries.length === 0) return undefined;
    for (const [path, data, mtime] of entries) {
      this.accessModel.insertFile(path, data, mtime);
    }
    this.resolved.set(key, root);
    return root;
  }
}
