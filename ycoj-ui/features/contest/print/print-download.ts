/**
 * Download helpers for the print preview panel. Kept DOM-light so the
 * filename rule is unit-testable in Node.
 */

/**
 * Download filename rule: `contest-<tid>-<slug>.pdf` where `<slug>` is the
 * contest title reduced to lowercase ASCII words joined by single dashes
 * (`[a-z0-9]+(-[a-z0-9]+)*`). When nothing survives sanitizing (e.g. an
 * all-CJK title) the bare `contest-<tid>.pdf` fallback keeps the name
 * deterministic and filesystem-safe.
 */
export function printPdfFileName(tid: string, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? `contest-${tid}-${slug}.pdf` : `contest-${tid}.pdf`;
}

/** Deterministic name for the Typst source-export zip debug download. */
export function printSourceFileName(tid: string): string {
  return `contest-${tid}-typst-source.zip`;
}

/** Click a temporary download anchor for an already-live URL. */
export function downloadUrl(name: string, url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

/**
 * One-shot blob download: builds an object URL, clicks a temporary anchor,
 * and revokes the URL on the next tick (the anchor only needs it to exist
 * when the navigation is dispatched). Matches the user-import pattern —
 * do NOT use for URLs that stay alive for preview.
 */
export function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  downloadUrl(name, url);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
