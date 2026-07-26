// Settings: practice direction (which language you answer in).

import * as api from '../api.js';
import { navigate } from '../main.js';
import { el, hints, applyFocus } from '../ui.js';

const OPTIONS = [
  {
    value: 'es_to_en',
    label: 'Spanish → English',
    desc: 'You see the word in Spanish and type it in English.',
  },
  {
    value: 'en_to_es',
    label: 'English → Spanish',
    desc: 'You see the word in English and type it in Spanish.',
  },
];

let idx = 0;
let currentValue = 'es_to_en';
let nodes = [];

export const settingsView = {
  async mount(root) {
    const settings = await api.getSettings();
    currentValue = settings.direction;
    idx = Math.max(0, OPTIONS.findIndex((o) => o.value === currentValue));
    render(root);
  },

  unmount() {},

  onKey(e) {
    switch (e.key) {
      case 'ArrowDown':
        if (idx < OPTIONS.length - 1) { idx++; applyFocus(nodes, idx); }
        break;
      case 'ArrowUp':
        if (idx > 0) { idx--; applyFocus(nodes, idx); }
        break;
      case 'Enter':
      case ' ':
        choose(OPTIONS[idx].value);
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
  root.appendChild(el('p', 'subtitle', 'Practice direction'));

  nodes = OPTIONS.map((opt, i) => {
    const item = el('div', 'option-item');
    item.appendChild(el('div', 'mark', opt.value === currentValue ? '✓' : ''));
    const body = el('div');
    body.appendChild(el('div', '', opt.label));
    body.appendChild(el('div', 'desc', opt.desc));
    item.appendChild(body);
    item.onclick = () => { idx = i; choose(opt.value); };
    root.appendChild(item);
    return item;
  });

  root.appendChild(hints([
    ['↑ ↓', 'navigate'],
    ['Enter', 'choose'],
    ['Esc', 'back'],
  ]));

  applyFocus(nodes, idx);
}

async function choose(value) {
  currentValue = value;
  nodes.forEach((n, i) =>
    (n.querySelector('.mark').textContent = OPTIONS[i].value === value ? '✓' : ''));
  await api.saveSettings({ direction: value });
}
