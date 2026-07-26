// Punto de entrada: enrutador de vistas, teclado global y latidos al servidor.

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

// Pantalla final cuando el usuario elige «Salir»: apaga el servidor
// e intenta cerrar la pestaña.
export async function quitApp() {
  if (current && current.unmount) current.unmount();
  current = null;
  document.getElementById('app').innerHTML = `
    <div class="goodbye">
      <div class="big">👋</div>
      <h2>¡Hasta luego!</h2>
      <p>El servidor se apagó. Ya puedes cerrar esta pestaña.</p>
    </div>`;
  await api.shutdown();
  setTimeout(() => window.close(), 300);
}

document.addEventListener('keydown', (e) => {
  if (current && current.onKey) current.onKey(e);
});

// Latidos: si la pestaña se cierra, el servidor deja de recibirlos y se apaga.
api.heartbeat();
setInterval(api.heartbeat, 3000);

navigate('songs');
