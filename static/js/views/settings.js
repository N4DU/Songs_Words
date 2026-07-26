// Settings, grouped by category: practice direction, what happens with
// mistakes, and how answers are compared. All rows share one ↑↓ flow.

import * as api from '../api.js';
import { navigate } from '../main.js';
import { el, hints, applyFocus } from '../ui.js';

// type 'radio' rows set `key` to `value`; type 'toggle' rows flip `key`.
const SECTIONS = [
  {
    title: 'Practice direction',
    rows: [
      {
        type: 'radio', key: 'direction', value: 'es_to_en',
        label: 'Spanish → English',
        desc: 'You see the word in Spanish and type it in English.',
      },
      {
        type: 'radio', key: 'direction', value: 'en_to_es',
        label: 'English → Spanish',
        desc: 'You see the word in English and type it in Spanish.',
      },
    ],
  },
  {
    title: 'Mistakes',
    rows: [
      {
        type: 'toggle', key: 'retry_missed',
        label: 'Ask missed words again',
        desc: 'A word you miss comes back at the end of its song until you get it.',
      },
    ],
  },
  {
    title: 'Answer checking',
    rows: [
      {
        type: 'toggle', key: 'ignore_accents',
        label: 'Ignore accents',
        desc: 'é counts as e: “cancion” is accepted for “canción”.',
      },
    ],
  },
];

const ROWS = SECTIONS.flatMap((s) => s.rows);

let idx = 0;
let settings = {};
let nodes = [];

export const settingsView = {
  async mount(root) {
    settings = await api.getSettings();
    idx = 0;
    render(root);
  },

  unmount() {},

  onKey(e) {
    switch (e.key) {
      case 'ArrowDown':
        if (idx < ROWS.length - 1) { idx++; applyFocus(nodes, idx); }
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

function render(root) {
  root.appendChild(el('h1', '', '⚙ Settings'));
  root.appendChild(el('p', 'subtitle', 'How you want to practice.'));

  nodes = [];
  let flat = 0;
  for (const section of SECTIONS) {
    root.appendChild(el('div', 'set-cat', section.title));
    for (const row of section.rows) {
      const item = el('div', 'option-item');
      item.appendChild(el('div', 'mark', markFor(row)));
      const body = el('div');
      body.appendChild(el('div', '', row.label));
      body.appendChild(el('div', 'desc', row.desc));
      item.appendChild(body);
      const i = flat++;
      item.onclick = () => { idx = i; activate(i); applyFocus(nodes, idx); };
      root.appendChild(item);
      nodes.push(item);
    }
  }

  root.appendChild(hints([
    ['↑ ↓', 'navigate'],
    ['Enter / Space', 'change'],
    ['Esc', 'back'],
  ]));

  applyFocus(nodes, idx);
}

function markFor(row) {
  if (row.type === 'radio') return settings[row.key] === row.value ? '✓' : '';
  return settings[row.key] ? 'ON' : 'OFF';
}

async function activate(i) {
  const row = ROWS[i];
  if (row.type === 'radio') settings[row.key] = row.value;
  else settings[row.key] = !settings[row.key];
  nodes.forEach((n, j) => {
    const mark = n.querySelector('.mark');
    mark.textContent = markFor(ROWS[j]);
    mark.classList.toggle('off', ROWS[j].type === 'toggle' && !settings[ROWS[j].key]);
  });
  await api.saveSettings({ [row.key]: settings[row.key] });
}
