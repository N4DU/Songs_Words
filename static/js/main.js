// Entry point: view router, global keyboard handling and server lifecycle.

import * as api from './api.js';
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
  document.getElementById('app').innerHTML = `
    <div class="goodbye">
      <div class="big">👋</div>
      <h2>See you soon!</h2>
      <p>The server has stopped. You can close this tab now.</p>
    </div>`;
  await api.shutdown();
  setTimeout(() => window.close(), 300);
}

document.addEventListener('keydown', (e) => {
  if (current && current.onKey) current.onKey(e);
});

// Lifecycle: say hello on load and goodbye when the page goes away.
// A reload sends a new hello in time, so the server only stops when
// the tab is really closed. No polling involved.
api.hello();
window.addEventListener('pagehide', () => navigator.sendBeacon('/api/goodbye'));

navigate('songs');
