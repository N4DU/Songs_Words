// Vista principal: lista de canciones, selección para practicar y acciones.

import * as api from '../api.js';
import { navigate, quitApp } from '../main.js';
import { el, thumb, hints, applyFocus, confirmDialog } from '../ui.js';

let songs = [];
let zone = 'list';        // 'list' | 'buttons' | 'actions'
let listIdx = 0;
let btnIdx = 0;
let actionIdx = 0;
let dialog = null;        // diálogo de confirmación activo

let listNodes = [];
let buttonNodes = [];
let actionNodes = [];
let actionsMenu = null;

export const songsView = {
  async mount(root) {
    songs = await api.getSongs();
    zone = songs.length ? 'list' : 'buttons';
    listIdx = Math.min(listIdx, Math.max(0, songs.length - 1));
    btnIdx = 0;
    dialog = null;
    render(root);
  },

  unmount() {
    dialog = null;
  },

  onKey(e) {
    if (dialog) { dialog.onKey(e); return; }
    if (zone === 'actions') return onActionsKey(e);
    if (zone === 'list') return onListKey(e);
    return onButtonsKey(e);
  },
};

function render(root) {
  root.innerHTML = '';
  root.appendChild(el('h1', '', '🎵 Songs & Words'));
  root.appendChild(el('p', 'subtitle', 'Tu vocabulario en inglés, canción por canción.'));

  listNodes = [];
  if (songs.length) {
    const list = el('div', 'song-list');
    songs.forEach((song, i) => {
      const item = el('div', 'song-item' + (song.selected ? ' is-selected' : ''));
      item.appendChild(thumb(song, 'song-thumb'));
      const info = el('div', 'song-info');
      info.appendChild(el('div', 'song-title', song.title));
      info.appendChild(el('div', 'song-meta',
        `${song.word_count} palabra${song.word_count === 1 ? '' : 's'}`));
      item.appendChild(info);
      item.appendChild(el('div', 'song-check', song.selected ? '✓' : ''));
      item.onclick = () => { listIdx = i; setZone('list'); toggleSelected(); };
      list.appendChild(item);
      listNodes.push(item);
    });
    root.appendChild(list);
  } else {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('div', 'big', '🎧'));
    empty.appendChild(el('p', '', 'Todavía no hay canciones. ¡Crea la primera!'));
    root.appendChild(empty);
  }

  const row = el('div', 'btn-row');
  buttonNodes = [
    button(row, '▶ Practicar seleccionadas', 'primary', startSelected),
    button(row, '＋ Nueva canción', '', () => navigate('editor')),
    button(row, '⚙ Configuración', '', () => navigate('settings')),
    button(row, '✕ Salir', 'danger', quitApp),
  ];
  root.appendChild(row);

  root.appendChild(hints([
    ['↑ ↓', 'moverse'],
    ['Espacio', 'seleccionar'],
    ['→', 'acciones'],
    ['Enter', 'aceptar'],
    ['Esc', 'salir'],
  ]));

  refreshFocus();
}

function button(row, label, extra, action) {
  const b = el('button', 'btn' + (extra ? ' ' + extra : ''), label);
  b.onclick = action;
  row.appendChild(b);
  return b;
}

function setZone(z) {
  zone = z;
  refreshFocus();
}

function refreshFocus() {
  applyFocus(listNodes, zone === 'list' ? listIdx : -1);
  applyFocus(buttonNodes, zone === 'buttons' ? btnIdx : -1);
}

// ---------- Zona: lista ----------

function onListKey(e) {
  switch (e.key) {
    case 'ArrowDown':
      if (listIdx < songs.length - 1) { listIdx++; refreshFocus(); }
      else setZone('buttons');
      break;
    case 'ArrowUp':
      if (listIdx > 0) { listIdx--; refreshFocus(); }
      break;
    case ' ':
    case 'Enter':
      toggleSelected();
      break;
    case 'ArrowRight':
      openActions();
      break;
    case 'Escape':
      setZone('buttons');
      btnIdx = buttonNodes.length - 1; // «Salir»
      refreshFocus();
      break;
    default:
      return;
  }
  e.preventDefault();
}

async function toggleSelected() {
  const song = songs[listIdx];
  song.selected = song.selected ? 0 : 1;
  listNodes[listIdx].classList.toggle('is-selected', !!song.selected);
  listNodes[listIdx].querySelector('.song-check').textContent = song.selected ? '✓' : '';
  await api.setSelected(song.id, !!song.selected);
}

// ---------- Zona: botones inferiores ----------

function onButtonsKey(e) {
  switch (e.key) {
    case 'ArrowLeft':
      if (btnIdx > 0) { btnIdx--; refreshFocus(); }
      break;
    case 'ArrowRight':
      if (btnIdx < buttonNodes.length - 1) { btnIdx++; refreshFocus(); }
      break;
    case 'ArrowUp':
      if (songs.length) setZone('list');
      break;
    case 'Enter':
      buttonNodes[btnIdx].click();
      break;
    case 'Escape':
      btnIdx = buttonNodes.length - 1;
      refreshFocus();
      break;
    default:
      return;
  }
  e.preventDefault();
}

function startSelected() {
  if (songs.some((s) => s.selected)) navigate('practice', {});
}

// ---------- Zona: menú de acciones de una canción ----------

function openActions() {
  const item = listNodes[listIdx];
  actionsMenu = el('div', 'song-actions');
  const acts = [
    ['▶ Practicar', () => navigate('practice', { ids: [songs[listIdx].id] })],
    ['✎ Editar', () => navigate('editor', { id: songs[listIdx].id })],
    ['🗑 Eliminar', removeSong],
  ];
  actionNodes = acts.map(([label, action]) => {
    const b = el('button', 'btn', label);
    b.onclick = action;
    actionsMenu.appendChild(b);
    return b;
  });
  item.appendChild(actionsMenu);
  actionIdx = 0;
  zone = 'actions';
  applyFocus(actionNodes, actionIdx);
}

function closeActions() {
  if (actionsMenu) actionsMenu.remove();
  actionsMenu = null;
  setZone('list');
}

function onActionsKey(e) {
  switch (e.key) {
    case 'ArrowLeft':
      if (actionIdx > 0) { actionIdx--; applyFocus(actionNodes, actionIdx); }
      else closeActions();
      break;
    case 'ArrowRight':
      if (actionIdx < actionNodes.length - 1) { actionIdx++; applyFocus(actionNodes, actionIdx); }
      break;
    case 'Enter':
      actionNodes[actionIdx].click();
      break;
    case 'Escape':
      closeActions();
      break;
    default:
      return;
  }
  e.preventDefault();
}

function removeSong() {
  const song = songs[listIdx];
  dialog = confirmDialog(`¿Eliminar «${song.title}» y todas sus palabras?`, async (yes) => {
    dialog = null;
    closeActions();
    if (yes) {
      await api.deleteSong(song.id);
      songsView.mount(document.getElementById('app'));
    }
  });
}
