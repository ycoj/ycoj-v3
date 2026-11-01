/** Performs a full document navigation, keeping auth redirects in one place. */
export function hardNavigate(url: string) {
  window.location.assign(url);
}
