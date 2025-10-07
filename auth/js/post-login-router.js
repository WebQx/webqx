/**
 * WebQX - Post Login Router Utility
 * Decides where to send users after login based on:
 * 1) Explicit `?return=` query parameter (safe, same-origin relative only)
 * 2) Last visited route for the role (from localStorage)
 * 3) Role-based default destinations
 *
 * Exposes two functions on window.WebQXPostLoginRouter:
 * - computeRedirect(role: string, defaults?: { defaultProvider, defaultAdmin, defaultPatient }): string
 * - trackRoute(area: 'provider'|'admin'|'patient'): void
 */
(function () {
  function isSafeRelative(url) {
    if (!url || typeof url !== 'string') return false;
    // Allow paths like /foo/bar?x=1#y or foo/bar
    // Disallow protocol schemes and protocol-relative
    if (/^https?:\/\//i.test(url) || url.startsWith('//')) return false;
    // Basic character allow-list
    if (!/^\/?[\w\-\/\.\?\#\=\&%]*$/.test(url)) return false;
    return true;
  }

  function getLastRouteKeyForRole(role) {
    const r = (role || '').toLowerCase();
    if (r === 'patient') return 'webqx_last_patient_route';
    if (r === 'administrator' || r === 'admin' || r === 'staff') return 'webqx_last_admin_route';
    // All other clinical roles fall under provider
    return 'webqx_last_provider_route';
  }

  function computeRedirect(role, defaults) {
    const d = Object.assign({
      defaultProvider: '/portal',
      defaultAdmin: '/admin-console/',
      defaultPatient: '/patient-portal'
    }, defaults || {});

    try {
      const params = new URLSearchParams(window.location.search || '');
      const ret = params.get('return');
      if (ret && isSafeRelative(ret)) {
        return ret;
      }
    } catch (_) {}

    try {
      const key = getLastRouteKeyForRole(role);
      const last = window.localStorage.getItem(key);
      if (isSafeRelative(last)) return last;
    } catch (_) {}

    const r = (role || '').toLowerCase();
    if (r === 'patient') return d.defaultPatient;
    if (r === 'administrator' || r === 'admin' || r === 'staff') return d.defaultAdmin;
    return d.defaultProvider;
  }

  function trackRoute(area) {
    const areaKey = (area || '').toLowerCase();
    let key = 'webqx_last_provider_route';
    if (areaKey === 'patient') key = 'webqx_last_patient_route';
    else if (areaKey === 'admin') key = 'webqx_last_admin_route';
    try {
      const save = () => {
        const path = window.location.pathname + (window.location.search || '');
        if (isSafeRelative(path)) {
          window.localStorage.setItem(key, path);
        }
      };
      // Save now and on unload
      save();
      window.addEventListener('beforeunload', save, { capture: false, passive: true });
      // Intercept clicks to same-area links to store target ahead of navigation
      document.addEventListener('click', (e) => {
        const a = e.target && (e.target.closest ? e.target.closest('a') : null);
        if (!a || !a.getAttribute) return;
        const href = a.getAttribute('href') || '';
        if (!href || /^https?:\/\//i.test(href)) return;
        // Only track known area prefixes
        const wantPrefix = areaKey === 'patient'
          ? '/patient-portal'
          : (areaKey === 'admin' ? '/admin-console' : '/portal');
        const allowLegacyProvider = areaKey !== 'patient' && areaKey !== 'admin' && href.startsWith('/provider');
        if (href.startsWith(wantPrefix) || allowLegacyProvider) {
          try {
            const url = new URL(href, window.location.origin);
            const val = url.pathname + (url.search || '');
            if (isSafeRelative(val)) window.localStorage.setItem(key, val);
          } catch (_) {}
        }
      }, true);
    } catch (_) {}
  }

  window.WebQXPostLoginRouter = {
    computeRedirect,
    trackRoute
  };
})();
