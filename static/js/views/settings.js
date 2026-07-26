// Settings, grouped by category: interface language, practice direction,
// what happens with mistakes, and how answers are compared.
// All rows share one ↑↓ flow.

import * as api from '../api.js';
import { navigate } from '../main.js';
import { el, hints, applyFocus } from '../ui.js';
import { LANGS, setLang, t } from '../i18n.js';

// Built on every render so all labels follow the current language.
// type 'radio' rows set `key` to `value`; type 'toggle' rows flip `key`.
function buildSections() {
  return [
    {
      title: t('catLanguage'),
      rows: LANGS.map(([code, name]) => ({
        type: 'radio', key: 'language', value: code, label: name,
      })),
    },
    {
      title: t('catDirection'),
      rows: [
        {
          type: 'radio', key: 'direction', value: 'to_word',
          label: t('dirToWord'), desc: t('dirToWordDesc'),
        },
        {
          type: 'radio', key: 'direction', value: 'to_translation',
          label: t('dirToTranslation'), desc: t('dirToTranslationDesc'),
        },
      ],
    },
    {
      title: t('catMistakes'),
      rows: [
        {
          type: 'toggle', key: 'retry_missed',
          label: t('retryLabel'), desc: t('retryDesc'),
        },
      ],
    },
    {
      title: t('catChecking'),
      rows: [
        {
          type: 'toggle', key: 'ignore_accents',
          label: t('accentsLabel'), desc: t('accentsDesc'),
        },
      ],
    },
  ];
}

let rows = [];
let idx = 0;
let settings = {};
let nodes = [];
let root_ = null;

export const settingsView = {
  async mount(root) {
    root_ = root;
    settings = await api.getSettings();
    idx = 0;
    render();
  },

  unmount() {},

  onKey(e) {
    switch (e.key) {
      case 'ArrowDown':
        if (idx < rows.length - 1) { idx++; applyFocus(nodes, idx); }
        break;
      case 'ArrowUp':
        if (idx > 0) { idx--; applyFocus(nodes, idx); }
        break;
      case 'Enter':
      case ' ':
        activate(idx);
        break;
      case 'Escape':
        navigate('songs');
        break;
      default:
        return;
    }
    e.preventDefault();
  },
};

function render() {
  root_.innerHTML = '';
  root_.appendChild(el('h1', '', t('settingsTitle')));
  root_.appendChild(el('p', 'subtitle', t('settingsSubtitle')));

  const sections = buildSections();
  rows = sections.flatMap((s) => s.rows);
  nodes = [];
  let flat = 0;
  for (const section of sections) {
    root_.appendChild(el('div', 'set-cat', section.title));
    for (const row of section.rows) {
      const item = el('div', 'option-item');
      item.appendChild(el('div', 'mark', markFor(row)));
      const body = el('div');
      body.appendChild(el('div', '', row.label));
      if (row.desc) body.appendChild(el('div', 'desc', row.desc));
      item.appendChild(body);
      const i = flat++;
      item.onclick = () => { idx = i; activate(i); };
      root_.appendChild(item);
      nodes.push(item);
    }
  }

  root_.appendChild(hints([
    ['↑ ↓', t('hintNavigate')],
    ['Enter / Space', t('hintChange')],
    ['Esc', t('hintBack')],
  ]));

  applyFocus(nodes, idx);
}

function markFor(row) {
  if (row.type === 'radio') return settings[row.key] === row.value ? '✓' : '';
  return settings[row.key] ? 'ON' : 'OFF';
}

async function activate(i) {
  const row = rows[i];
  if (row.type === 'radio') settings[row.key] = row.value;
  else settings[row.key] = !settings[row.key];

  if (row.key === 'language') {
    // The whole view re-renders so every label speaks the new language.
    setLang(row.value);
    render();
  } else {
    nodes.forEach((n, j) => {
      const mark = n.querySelector('.mark');
      mark.textContent = markFor(rows[j]);
      mark.classList.toggle('off', rows[j].type === 'toggle' && !settings[rows[j].key]);
    });
  }
  await api.saveSettings({ [row.key]: settings[row.key] });
}
