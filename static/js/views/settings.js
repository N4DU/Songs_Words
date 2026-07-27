// Settings, grouped by category: interface language, practice direction,
// what happens with mistakes, and how answers are compared.
// All rows share one ↑↓ flow; the language row opens a compact picker so
// ten languages don't clutter the list.

import * as api from '../api.js';
import { navigate } from '../main.js';
import { el, hints, applyFocus } from '../ui.js';
import { LANGS, getLang, setLang, t } from '../i18n.js';

// Built on every render so all labels follow the current language.
// type 'radio' rows set `key` to `value`; type 'toggle' rows flip `key`;
// the single type 'lang' row opens the language picker.
function buildSections() {
  const current = LANGS.find(([code]) => code === getLang());
  return [
    {
      title: t('catLanguage'),
      rows: [
        { type: 'lang', label: current ? current[1] : 'English', desc: t('langDesc') },
      ],
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
    {
      // One leniency rule per interface language, in the same order as the
      // language picker, so everyone finds their own near the top.
      title: t('catPerLang'),
      rows: [
        {
          type: 'toggle', key: 'en_apostrophes',
          label: t('en_apostrophesLabel'), desc: t('en_apostrophesDesc'),
        },
        {
          type: 'toggle', key: 'es_inverted_marks',
          label: t('es_inverted_marksLabel'), desc: t('es_inverted_marksDesc'),
        },
        {
          type: 'toggle', key: 'fr_ligatures',
          label: t('fr_ligaturesLabel'), desc: t('fr_ligaturesDesc'),
        },
        {
          type: 'toggle', key: 'de_eszett',
          label: t('de_eszettLabel'), desc: t('de_eszettDesc'),
        },
        {
          type: 'toggle', key: 'it_double_consonants',
          label: t('it_double_consonantsLabel'), desc: t('it_double_consonantsDesc'),
        },
        {
          type: 'toggle', key: 'pt_cedilla',
          label: t('pt_cedillaLabel'), desc: t('pt_cedillaDesc'),
        },
        {
          type: 'toggle', key: 'ru_yo',
          label: t('ru_yoLabel'), desc: t('ru_yoDesc'),
        },
        {
          type: 'toggle', key: 'ja_kana',
          label: t('ja_kanaLabel'), desc: t('ja_kanaDesc'),
        },
        {
          type: 'toggle', key: 'zh_width',
          label: t('zh_widthLabel'), desc: t('zh_widthDesc'),
        },
        {
          type: 'toggle', key: 'ko_jamo',
          label: t('ko_jamoLabel'), desc: t('ko_jamoDesc'),
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
let picker = null;   // active language picker: { onKey }

export const settingsView = {
  async mount(root) {
    root_ = root;
    settings = await api.getSettings();
    idx = 0;
    picker = null;
    render();
  },

  unmount() {
    closePicker();
  },

  onKey(e) {
    if (picker) { picker.onKey(e); return; }
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
  if (row.type === 'lang') return '▾';
  if (row.type === 'radio') return settings[row.key] === row.value ? '✓' : '';
  return settings[row.key] ? 'ON' : 'OFF';
}

async function activate(i) {
  const row = rows[i];
  if (row.type === 'lang') { openPicker(); return; }

  if (row.type === 'radio') settings[row.key] = row.value;
  else settings[row.key] = !settings[row.key];
  nodes.forEach((n, j) => {
    const mark = n.querySelector('.mark');
    mark.textContent = markFor(rows[j]);
    mark.classList.toggle('off', rows[j].type === 'toggle' && !settings[rows[j].key]);
  });
  await api.saveSettings({ [row.key]: settings[row.key] });
}

// ---------- Language picker ----------

function openPicker() {
  const overlay = el('div', 'overlay');
  const box = el('div', 'dialog lang-picker');
  box.appendChild(el('p', '', t('catLanguage')));
  const list = el('div', 'lang-list');

  let pickIdx = Math.max(0, LANGS.findIndex(([code]) => code === getLang()));
  const items = LANGS.map(([code, name], j) => {
    const item = el('div', 'lang-item', name + (code === getLang() ? '  ✓' : ''));
    item.onclick = () => { pickIdx = j; choose(); };
    list.appendChild(item);
    return item;
  });
  box.appendChild(list);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  applyFocus(items, pickIdx);

  async function choose() {
    const code = LANGS[pickIdx][0];
    closePicker();
    if (code !== getLang()) {
      setLang(code);
      settings.language = code;
      render();  // the whole view re-renders in the new language
      await api.saveSettings({ language: code });
    }
  }

  picker = {
    overlay,
    onKey(e) {
      if (e.key === 'ArrowDown') {
        if (pickIdx < items.length - 1) applyFocus(items, ++pickIdx);
      } else if (e.key === 'ArrowUp') {
        if (pickIdx > 0) applyFocus(items, --pickIdx);
      } else if (e.key === 'Enter' || e.key === ' ') {
        choose();
      } else if (e.key === 'Escape') {
        closePicker();
      } else {
        return;
      }
      e.preventDefault();
    },
  };
}

function closePicker() {
  if (picker) picker.overlay.remove();
  picker = null;
}
