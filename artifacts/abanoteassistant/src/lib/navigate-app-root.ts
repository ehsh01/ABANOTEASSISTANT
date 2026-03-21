/**
 * Full page navigation to the SPA base URL. Use after auth so the address bar,
 * loaded scripts, and wouter state all match the dashboard — avoids ending up stuck
 * on /admin when an old bundle or client router state disagrees with the current route.
 */
export function navigateToAppRoot(): void {
  const base = import.meta.env.BASE_URL || "/";
  window.location.assign(base);
}
