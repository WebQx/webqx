// WebQX Mobile Navigation Controller
// Provides accessible hamburger toggle and focus trapping (lightweight)

(function() {
  const toggle = document.querySelector('.webqx-nav-toggle');
  const nav = document.querySelector('.webqx-nav-links');
  if (!toggle || !nav) return;

  const focusableSelectors = 'a[href], button:not([disabled])';
  let lastFocused;

  function openNav() {
    lastFocused = document.activeElement;
    nav.classList.add('is-open');
    document.body.classList.add('nav-open');
    toggle.setAttribute('aria-expanded', 'true');
    // Focus first link for accessibility
    const firstLink = nav.querySelector(focusableSelectors);
    firstLink && firstLink.focus();
    document.addEventListener('keydown', handleKey);
  }

  function closeNav() {
    nav.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
    if (lastFocused) lastFocused.focus();
    document.removeEventListener('keydown', handleKey);
  }

  function handleKey(e) {
    if (e.key === 'Escape') {
      closeNav();
    } else if (e.key === 'Tab') {
      // simple focus trap
      const focusable = Array.from(nav.querySelectorAll(focusableSelectors));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') === 'true';
    expanded ? closeNav() : openNav();
  });

  // Close if clicking outside panel on small screens
  document.addEventListener('click', (e) => {
    if (!nav.classList.contains('is-open')) return;
    if (nav.contains(e.target) || toggle.contains(e.target)) return;
    closeNav();
  });
})();
