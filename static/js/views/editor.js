// Song editor: title, cover image, theme color and word list.

import * as api from '../api.js';
import { navigate } from '../main.js';
import { el, hints } from '../ui.js';

let editingId = null;

let titleInput, imageInput, preview, wordsBox, errorBox, saveBtn, cancelBtn;
let colorAuto, colorInput;

export const editorView = {
  async mount(root, params) {
    editingId = params.id || null;
    const song = editingId ? await api.getSong(editingId) : null;
    render(root, song);
    titleInput.focus();
  },

  unmount() {},

  onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      navigate('songs');
      return;
    }
    // Enter moves to the next field (and adds new rows at the end).
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'text') {
      e.preventDefault();
      advanceFrom(e.target);
    }
  },
};

function render(root, song) {
  root.appendChild(el('h1', '', song ? '✎ Edit song' : '＋ New song'));
  root.appendChild(el('p', 'subtitle',
    'Write the words in English and their meaning within the song.'));

  const card = el('div', 'card');

  card.appendChild(el('label', '', 'Song title'));
  titleInput = el('input');
  titleInput.type = 'text';
  titleInput.placeholder = 'E.g.: Counting Stars — OneRepublic';
  titleInput.value = song ? song.title : '';
  card.appendChild(titleInput);

  card.appendChild(el('label', '', 'Cover image (optional)'));
  imageInput = el('input');
  imageInput.type = 'file';
  imageInput.accept = 'image/*';
  card.appendChild(imageInput);
  preview = el('img', 'img-preview');
  preview.style.display = 'none';
  if (song && song.image) {
    preview.src = `/images/${song.image}`;
    preview.style.display = 'block';
  }
  imageInput.onchange = () => {
    const file = imageInput.files[0];
    if (file) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = 'block';
    }
  };
  card.appendChild(preview);

  card.appendChild(el('label', '', 'Practice background color'));
  const colorRow = el('div', 'color-row');
  colorAuto = el('input');
  colorAuto.type = 'checkbox';
  colorAuto.id = 'color-auto';
  colorAuto.checked = !(song && song.color);
  const colorLabel = el('label', 'inline-label', 'Auto (taken from the cover)');
  colorLabel.htmlFor = 'color-auto';
  colorInput = el('input');
  colorInput.type = 'color';
  colorInput.value = (song && song.color) || '#00acc1';
  colorInput.style.display = colorAuto.checked ? 'none' : 'block';
  colorAuto.onchange = () => {
    colorInput.style.display = colorAuto.checked ? 'none' : 'block';
  };
  colorRow.append(colorAuto, colorLabel, colorInput);
  card.appendChild(colorRow);

  card.appendChild(el('label', '', 'Words'));
  wordsBox = el('div');
  card.appendChild(wordsBox);
  const words = song && song.words.length ? song.words : [{ english: '', spanish: '' }];
  words.forEach((w) => addRow(w.english, w.spanish));

  errorBox = el('div', 'form-error');
  card.appendChild(errorBox);

  const row = el('div', 'btn-row');
  row.style.marginTop = '20px';
  saveBtn = el('button', 'btn primary', '✓ Save');
  saveBtn.onclick = save;
  cancelBtn = el('button', 'btn', '← Cancel');
  cancelBtn.onclick = () => navigate('songs');
  row.append(saveBtn, cancelBtn);
  card.appendChild(row);

  root.appendChild(card);
  root.appendChild(hints([
    ['Tab', 'next field'],
    ['Enter', 'advance / new word'],
    ['Esc', 'back without saving'],
  ]));
}

function addRow(english = '', spanish = '') {
  const row = el('div', 'word-row');

  const en = el('input');
  en.type = 'text';
  en.placeholder = 'English';
  en.value = english;
  en.dataset.field = 'english';

  const es = el('input');
  es.type = 'text';
  es.placeholder = 'Spanish (as used in the song)';
  es.value = spanish;
  es.dataset.field = 'spanish';

  const del = el('button', 'row-del', '✕');
  del.title = 'Remove this word';
  del.tabIndex = -1;
  del.onclick = () => {
    if (wordsBox.children.length > 1) row.remove();
    else { en.value = ''; es.value = ''; }
  };

  row.append(en, es, del);
  wordsBox.appendChild(row);
  return row;
}

// Enter in a text field: move on; on the last empty row, jump to "Save".
function advanceFrom(input) {
  if (input === titleInput) {
    wordsBox.querySelector('input').focus();
    return;
  }
  const row = input.closest('.word-row');
  if (!row) return;

  if (input.dataset.field === 'english') {
    const spanish = row.querySelector('[data-field="spanish"]');
    const lastAndEmpty = row === wordsBox.lastElementChild
      && !input.value.trim() && !spanish.value.trim();
    if (lastAndEmpty) saveBtn.focus();
    else spanish.focus();
    return;
  }

  const isLast = row === wordsBox.lastElementChild;
  if (isLast) {
    const en = row.querySelector('[data-field="english"]').value.trim();
    if (en || input.value.trim()) addRow().querySelector('input').focus();
    else saveBtn.focus();
  } else {
    row.nextElementSibling.querySelector('input').focus();
  }
}

function collectWords() {
  return [...wordsBox.querySelectorAll('.word-row')].map((row) => ({
    english: row.querySelector('[data-field="english"]').value.trim(),
    spanish: row.querySelector('[data-field="spanish"]').value.trim(),
  })).filter((w) => w.english || w.spanish);
}

async function save() {
  errorBox.classList.remove('visible');

  const words = collectWords();
  const incomplete = words.find((w) => !w.english || !w.spanish);
  if (incomplete) {
    showError('Some words are incomplete: fill both columns or remove them.');
    return;
  }

  const form = new FormData();
  form.append('title', titleInput.value.trim());
  form.append('words', JSON.stringify(words));
  if (!colorAuto.checked) form.append('color', colorInput.value);
  if (imageInput.files[0]) form.append('image', imageInput.files[0]);

  try {
    if (editingId) await api.updateSong(editingId, form);
    else await api.createSong(form);
    navigate('songs');
  } catch (err) {
    showError(err.message);
  }
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.add('visible');
}
