import { initState } from './state.js';
import { mount } from './ui.js';

// BUILD MARKER (2026-08-13): shows which commit this specific folder was
// built from, right in the header. See build.mjs's own comment for why —
// this app is a downloaded ZIP snapshot, not a live-synced folder, and a
// browser refresh can't detect a stale local copy on its own.
function renderBuildMarker() {
  const sub = document.querySelector('.topbar .sub');
  if (!sub) return;
  const b = window.__ATMOS_BUILD__;
  if (!b) return;
  sub.textContent = `multi-engine shell · build ${b.commit} · ${b.date}`;
  sub.title = 'This marker is generated when the bundle is built, one step before the commit that ships it — so it will almost always show the PREVIOUS commit on GitHub, not this exact one. Treat it as "at least this recent," not exact. If it looks like it\'s from more than a few commits back, download a fresh ZIP — refreshing the page only reloads the files already on disk.';
}

function boot() {
  const root = document.getElementById('app');
  renderBuildMarker();
  if (!root) return;
  mount(initState(), root);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
