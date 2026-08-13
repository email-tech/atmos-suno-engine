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
  sub.title = 'If this commit looks old, download a fresh ZIP from the repo — refreshing the page only reloads the files already on disk.';
}

function boot() {
  const root = document.getElementById('app');
  renderBuildMarker();
  if (!root) return;
  mount(initState(), root);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
