// Song editor: title, cover image, theme color and word list.

import * as api from '../api.js';
import { navigate } from '../main.js';
import { el, hints, confirmDialog } from '../ui.js';
import { t } from '../i18n.js';

let editingId = null;

let titleInput, imageInput, preview, wordsBox, errorBox, saveBtn, cancelBtn;
let colorAuto, colorInput;
let dialog = null;       // active "discard changes?" dialog
let savedSnapshot = '';  // form state at open, to detect unsaved work

export const editorView = {
  async mount(root, params) {
    editingId = params.id || null;
    const song = editingId ? await api.getSong(editingId) : null;
    dialog = null;
    render(root, song);
    savedSnapshot = snapshot();
    titleInput.focus();
  },

  unmount() {
    dialog = null;
  },

  onKey(e) {
    if (dialog) { dialog.onKey(e); return; }
    if (e.key === 'Escape') {
      e.preventDefault();
      attemptClose();
      return;
    }
    const isText = e.target.tagName === 'INPUT' && e.target.type === 'text';
    // Enter moves to the next field (and adds new rows at the end).
    if (e.key === 'Enter' && isText) {
      e.preventDefault();
      advanceFrom(e.target);
      return;
    }
    // Backspace on a completely empty row removes it: the only way to
    // delete a row without a mouse (the ✕ button is not in the tab order).
    if (e.key === 'Backspace' && isText) {
      maybeRemoveRow(e);
      return;
    }
    // ←/→ hop between Save and Cancel once you reach them.
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight')
        && (e.target === saveBtn || e.target === cancelBtn)) {
      e.preventDefault();
      (e.target === saveBtn ? cancelBtn : saveBtn).focus();
    }
  },
};

function snapshot() {
  return JSON.stringify({
    title: titleInput.value.trim(),
    words: collectWords(),
    color: colorAuto.checked ? '' : colorInput.value,
    image: imageInput.files.length,
  });
}

// Leaving with unsaved changes deserves a question, not silent data loss.
function attemptClose() {
  if (snapshot() === savedSnapshot) { navigate('songs'); return; }
  const refocus = document.activeElement;
  if (refocus && refocus.blur) refocus.blur();
  dialog = confirmDialog(t('leaveNoSave'), (yes) => {
    dialog = null;
    if (yes) navigate('songs');
    else if (refocus && refocus.focus) refocus.focus();
  });
}

function maybeRemoveRow(e) {
  const row = e.target.closest('.word-row');
  if (!row || e.target.value) return;
  const filled = [...row.querySelectorAll('input')].some((inp) => inp.value);
  if (filled || wordsBox.children.length <= 1) return;
  e.preventDefault();
  const neighbor = row.previousElementSibling || row.nextElementSibling;
  row.remove();
  neighbor.querySelector('[data-field="word"]').focus();
}

function render(root, song) {
  root.appendChild(el('h1', '', song ? t('editTitle') : t('newTitle')));
  root.appendChild(el('p', 'subtitle', t('editorSubtitle')));

  const card = el('div', 'card');

  card.appendChild(el('label', '', t('songTitle')));
  titleInput = el('input');
  titleInput.type = 'text';
  titleInput.placeholder = t('titleExample');
  titleInput.value = song ? song.title : '';
  card.appendChild(titleInput);

  card.appendChild(el('label', '', t('coverImage')));
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

  card.appendChild(el('label', '', t('bgColor')));
  const colorRow = el('div', 'color-row');
  colorAuto = el('input');
  colorAuto.type = 'checkbox';
  colorAuto.id = 'color-auto';
  colorAuto.checked = !(song && song.color);
  const colorLabel = el('label', 'inline-label', t('colorAuto'));
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

  card.appendChild(el('label', '', t('wordsLabel')));
  wordsBox = el('div');
  card.appendChild(wordsBox);
  const words = song && song.words.length ? song.words : [{ word: '', translation: '' }];
  words.forEach((w) => addRow(w.word, w.translation));

  errorBox = el('div', 'form-error');
  card.appendChild(errorBox);

  const row = el('div', 'btn-row');
  row.style.marginTop = '20px';
  saveBtn = el('button', 'btn primary', t('save'));
  saveBtn.onclick = save;
  cancelBtn = el('button', 'btn', t('cancel'));
  cancelBtn.onclick = attemptClose;
  row.append(saveBtn, cancelBtn);
  card.appendChild(row);

  root.appendChild(card);
  root.appendChild(hints([
    ['Tab', t('hintNextField')],
    ['Enter', t('hintAdvance')],
    ['Backspace', t('hintRemoveRow')],
    ['Esc', t('hintBackNoSave')],
  ]));
}

function addRow(word = '', translation = '') {
  const row = el('div', 'word-row');

  const wordInput = el('input');
  wordInput.type = 'text';
  wordInput.placeholder = t('wordPh');
  wordInput.value = word;
  wordInput.dataset.field = 'word';

  const transInput = el('input');
  transInput.type = 'text';
  transInput.placeholder = t('translationPh');
  transInput.value = translation;
  transInput.dataset.field = 'translation';

  const del = el('button', 'row-del', '✕');
  del.title = t('removeWord');
  del.tabIndex = -1;
  del.onclick = () => {
    if (wordsBox.children.length > 1) row.remove();
    else { wordInput.value = ''; transInput.value = ''; }
  };

  row.append(wordInput, transInput, del);
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

  if (input.dataset.field === 'word') {
    const translation = row.querySelector('[data-field="translation"]');
    const lastAndEmpty = row === wordsBox.lastElementChild
      && !input.value.trim() && !translation.value.trim();
    if (lastAndEmpty) saveBtn.focus();
    else translation.focus();
    return;
  }

  const isLast = row === wordsBox.lastElementChild;
  if (isLast) {
    const word = row.querySelector('[data-field="word"]').value.trim();
    if (word || input.value.trim()) addRow().querySelector('input').focus();
    else saveBtn.focus();
  } else {
    row.nextElementSibling.querySelector('input').focus();
  }
}

function collectWords() {
  return [...wordsBox.querySelectorAll('.word-row')].map((row) => ({
    word: row.querySelector('[data-field="word"]').value.trim(),
    translation: row.querySelector('[data-field="translation"]').value.trim(),
  })).filter((w) => w.word || w.translation);
}

async function save() {
  errorBox.classList.remove('visible');

  if (!titleInput.value.trim()) {
    showError(t('errNoTitle'));
    return;
  }
  const words = collectWords();
  const incomplete = words.find((w) => !w.word || !w.translation);
  if (incomplete) {
    showError(t('errIncomplete'));
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
