// Configuración: dirección de la práctica (en qué idioma respondes).

import * as api from '../api.js';
import { navigate } from '../main.js';
import { el, hints, applyFocus } from '../ui.js';

const OPTIONS = [
  {
    value: 'es_to_en',
    label: 'Español → Inglés',
    desc: 'Ves la palabra en español y la escribes en inglés.',
  },
  {
    value: 'en_to_es',
    label: 'Inglés → Español',
    desc: 'Ves la palabra en inglés y la escribes en español.',
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
  root.appendChild(el('h1', '', '⚙ Configuración'));
  root.appendChild(el('p', 'subtitle', 'Dirección de la práctica'));

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
    ['↑ ↓', 'moverse'],
    ['Enter', 'elegir'],
    ['Esc', 'volver'],
  ]));

  applyFocus(nodes, idx);
}

async function choose(value) {
  currentValue = value;
  nodes.forEach((n, i) =>
    (n.querySelector('.mark').textContent = OPTIONS[i].value === value ? '✓' : ''));
  await api.saveSettings({ direction: value });
}
