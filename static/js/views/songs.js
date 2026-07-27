// Main view: song list, practice selection and per-song actions.
// The action buttons live above the list so they never scroll out of reach,
// and "Practice selected" is focused when the app opens.

import * as api from '../api.js';
import { navigate, quitApp } from '../main.js';
import { el, thumb, hints, applyFocus, confirmDialog, toast } from '../ui.js';
import { t } from '../i18n.js';
import { applyAmbientFromSongs } from '../color.js';

let songs = [];
let zone = 'buttons';     // 'buttons' | 'list' | 'actions'
let listIdx = 0;
let btnIdx = 0;
let actionIdx = 0;
let dialog = null;        // active confirmation dialog

let listNodes = [];
let buttonNodes = [];
let actionNodes = [];
let actionsMenu = null;
let busy = false;         // a selection change is in flight

export const songsView = {
  async mount(root) {
    // Reset before the await: keys pressed while loading must not reach
    // the nodes of the previous render, which are already detached.
    zone = 'buttons';
    btnIdx = 0;
    actionIdx = 0;
    listNodes = [];
    buttonNodes = [];
    actionNodes = [];
    actionsMenu = null;
    closeDialog();
    busy = false;
    songs = await api.getSongs();
    listIdx = Math.min(listIdx, Math.max(0, songs.length - 1));
    render(root);
    applyAmbientFromSongs(songs);
  },

  unmount() {
    closeDialog();
  },

  onKey(e) {
    if (dialog) { dialog.onKey(e); return; }
    if (zone === 'actions') return onActionsKey(e);
    if (zone === 'list') return onListKey(e);
    return onButtonsKey(e);
  },
};

function closeDialog() {
  if (dialog) dialog.close();
  dialog = null;
}

function render(root) {
  root.innerHTML = '';
  root.appendChild(el('h1', '', '🎵 Songs & Words'));
  root.appendChild(el('p', 'subtitle', t('subtitle')));

  const row = el('div', 'btn-row top-actions');
  buttonNodes = [
    button(row, t('practiceSelected'), 'primary', startSelected),
    button(row, t('newSong'), '', () => navigate('editor')),
    button(row, t('settings'), '', () => navigate('settings')),
    button(row, t('exit'), 'danger', quitApp),
  ];
  root.appendChild(row);

  listNodes = [];
  if (songs.length) {
    const list = el('div', 'song-list');
    songs.forEach((song, i) => {
      const item = el('div', 'song-item' + (song.selected ? ' is-selected' : ''));
      item.appendChild(thumb(song, 'song-thumb'));
      const info = el('div', 'song-info');
      info.appendChild(el('div', 'song-title', song.title));
      info.appendChild(el('div', 'song-meta',
        song.word_count === 1 ? t('wordCountOne') : t('wordCount', { n: song.word_count })));
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
    empty.appendChild(el('p', '', t('noSongs')));
    root.appendChild(empty);
  }

  root.appendChild(hints([
    ['↑ ↓', t('hintNavigate')],
    ['Space', t('hintSelect')],
    ['→', t('hintSongActions')],
    ['Enter', t('hintConfirm')],
    ['Esc', t('hintExit')],
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
  // The buttons sit at the top: scroll the header back into view instead of
  // letting applyFocus center them (two competing smooth scrolls).
  if (zone === 'buttons') {
    buttonNodes.forEach((n, i) => n.classList.toggle('kfocus', i === btnIdx));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    applyFocus(buttonNodes, -1);
  }
}

// ---------- Zone: top buttons ----------

function onButtonsKey(e) {
  switch (e.key) {
    case 'ArrowLeft':
      if (btnIdx > 0) { btnIdx--; refreshFocus(); }
      break;
    case 'ArrowRight':
      if (btnIdx < buttonNodes.length - 1) { btnIdx++; refreshFocus(); }
      break;
    case 'ArrowDown':
      if (songs.length) setZone('list');
      break;
    case 'Enter':
      buttonNodes[btnIdx].click();
      break;
    case 'Escape':
      btnIdx = buttonNodes.length - 1; // "Exit"
      refreshFocus();
      break;
    default:
      return;
  }
  e.preventDefault();
}

function startSelected() {
  if (songs.some((s) => s.selected)) navigate('practice', {});
  else if (songs.length) toast(t('toastSelectFirst'));
  else toast(t('toastCreateFirst'));
}

// ---------- Zone: list ----------

function onListKey(e) {
  switch (e.key) {
    case 'ArrowDown':
      if (listIdx < songs.length - 1) { listIdx++; refreshFocus(); }
      break;
    case 'ArrowUp':
      if (listIdx > 0) { listIdx--; refreshFocus(); }
      else setZone('buttons');
      break;
    case ' ':
    case 'Enter':
      toggleSelected();
      break;
    case 'ArrowRight':
      openActions();
      break;
    case 'Escape':
      btnIdx = buttonNodes.length - 1; // "Exit"
      setZone('buttons');
      break;
    default:
      return;
  }
  e.preventDefault();
}

// Toggles and re-sorts right away (selected first, newest added on top),
// keeping the focus on the same song wherever it lands.
// A held key repeats: one change at a time, and the optimistic mark goes
// back if the server refuses it.
async function toggleSelected() {
  if (busy) return;
  busy = true;
  const song = songs[listIdx];
  const before = song.selected;
  try {
    song.selected = song.selected ? 0 : 1;
    await api.setSelected(song.id, !!song.selected);
    songs = await api.getSongs();
    listIdx = Math.max(0, songs.findIndex((s) => s.id === song.id));
  } catch (err) {
    song.selected = before;
    toast(err.message);
  } finally {
    busy = false;
  }
  render(document.getElementById('app'));
}

// ---------- Zone: per-song actions menu ----------

function openActions() {
  const item = listNodes[listIdx];
  actionsMenu = el('div', 'song-actions');
  const acts = [
    [t('actPractice'), () => navigate('practice', { ids: [songs[listIdx].id] })],
    [t('actEdit'), () => navigate('editor', { id: songs[listIdx].id })],
    [t('actDelete'), removeSong],
  ];
  actionNodes = acts.map(([label, action]) => {
    const b = el('button', 'btn', label);
    // Without stopPropagation the click bubbles to the song row's own
    // onclick, which toggles the selection and re-renders over the new view.
    b.onclick = (e) => { e.stopPropagation(); action(); };
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
      // The menu is open: swallow the keys that would scroll the page.
      if (e.key === ' ' || e.key.startsWith('Arrow')) break;
      return;
  }
  e.preventDefault();
}

function removeSong() {
  const song = songs[listIdx];
  dialog = confirmDialog(t('confirmDelete', { title: song.title }), async (yes) => {
    dialog = null;
    closeActions();
    if (yes) {
      await api.deleteSong(song.id);
      songsView.mount(document.getElementById('app'));
    }
  });
}
