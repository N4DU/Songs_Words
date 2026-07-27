// Entry point: view router, global keyboard handling and server lifecycle.

import * as api from './api.js';
import { setLang, t } from './i18n.js';
import { songsView } from './views/songs.js';
import { editorView } from './views/editor.js';
import { practiceView } from './views/practice.js';
import { settingsView } from './views/settings.js';

const views = {
  songs: songsView,
  editor: editorView,
  practice: practiceView,
  settings: settingsView,
};

let current = null;

export function navigate(name, params = {}) {
  if (current && current.unmount) current.unmount();
  current = views[name];
  const root = document.getElementById('app');
  root.innerHTML = '';
  current.mount(root, params);
}

// Final screen when the user picks "Exit": stops the server
// and tries to close the tab.
export async function quitApp() {
  if (current && current.unmount) current.unmount();
  current = null;
  const goodbye = document.createElement('div');
  goodbye.className = 'goodbye';
  goodbye.innerHTML = '<div class="big">👋</div><h2></h2><p></p>';
  goodbye.querySelector('h2').textContent = t('goodbyeTitle');
  goodbye.querySelector('p').textContent = t('goodbyeBody');
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(goodbye);
  await api.shutdown();
  setTimeout(() => window.close(), 300);
}

document.addEventListener('keydown', (e) => {
  if (current && current.onKey) current.onKey(e);
});

// Lifecycle: say hello on load and goodbye when the page goes away.
// A reload sends a new hello in time, so the server only stops when the
// last tab is really closed. A page restored from the back/forward cache
// says hello again, since its pagehide already said goodbye. No polling.
api.hello();
window.addEventListener('pagehide', () => navigator.sendBeacon('/api/goodbye'));
window.addEventListener('pageshow', (e) => {
  if (e.persisted) api.hello();
});

// The interface language lives in settings: load it before the first view.
api.getSettings()
  .then((s) => setLang(s.language))
  .finally(() => navigate('songs'));
