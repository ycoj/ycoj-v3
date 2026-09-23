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

/** Click a temporary download anchor for an already-live URL. */
export function downloadUrl(name: string, url: string): void {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
