import { initState } from './state.js';
import { mount } from './ui.js';

function boot() {
  const root = document.getElementById('app');
  if (!root) return;
  mount(initState(), root);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
