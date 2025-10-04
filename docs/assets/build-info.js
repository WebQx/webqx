// Auto-generated lightweight build stamp for demo pages.
export const BUILD_INFO = {
  version: 'v0.1.0',
  commit: '1e73382',
  generatedAt: new Date().toISOString()
};

export function injectBuildFooter(selector='.mini-foot') {
  const el = document.querySelector(selector);
  if(!el) return;
  try {
    const ts = BUILD_INFO.generatedAt.replace('T',' ').replace('Z',' UTC');
    el.innerHTML += ` • commit ${BUILD_INFO.commit} • ${ts}`;
  } catch(e) { /* noop */ }
}
