// Vista de práctica: muestra la palabra en un idioma y se responde en el otro.
// Las falladas se reencolan al final de su canción hasta acertarlas.

import * as api from '../api.js';
import { navigate } from '../main.js';
import { el, thumb, hints, applyFocus } from '../ui.js';

let queue = [];          // [{song, english, spanish, retry}]
let pos = 0;
let total = 0;
let firstTryHits = 0;
let direction = 'es_to_en';
let awaitingNext = false; // tras un fallo, Enter continúa

let lastParams = {};
let root_, input, feedback, promptCard, progressFill, progressText;
let summaryButtons = [];
let summaryIdx = 0;
let finished = false;

export const practiceView = {
  async mount(root, params) {
    root_ = root;
    lastParams = params;
    const [settings, songs] = await Promise.all([
      api.getSettings(),
      api.getPractice(params.ids),
    ]);
    direction = settings.direction;

    queue = [];
    for (const song of songs) {
      const words = shuffle([...song.words]);
      for (const w of words) queue.push({ song, ...w, retry: false });
    }
    pos = 0;
    total = queue.length;
    firstTryHits = 0;
    awaitingNext = false;
    finished = false;

    if (!queue.length) { navigate('songs'); return; }
    renderCurrent();
  },

  unmount() {},

  onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      navigate('songs');
      return;
    }
    if (finished) return onSummaryKey(e);
    if (e.key === 'Enter') {
      e.preventDefault();
      if (awaitingNext) { awaitingNext = false; next(); }
      else check();
    }
  },
};

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function current() { return queue[pos]; }

function renderCurrent() {
  const item = current();
  const asked = direction === 'es_to_en' ? item.spanish : item.english;

  root_.innerHTML = '';

  const header = el('div', 'practice-header');
  header.appendChild(thumb(item.song, 'practice-cover'));
  const info = el('div');
  info.appendChild(el('div', 'practice-song-title', item.song.title));
  progressText = el('div', 'practice-progress');
  info.appendChild(progressText);
  header.appendChild(info);
  root_.appendChild(header);

  const bar = el('div', 'progress-bar');
  progressFill = el('div');
  bar.appendChild(progressFill);
  root_.appendChild(bar);

  promptCard = el('div', 'card prompt-card');
  promptCard.appendChild(el('div', 'prompt-label',
    direction === 'es_to_en' ? 'Escribe en inglés' : 'Escribe en español'));
  promptCard.appendChild(el('div', 'prompt-word', asked));

  input = el('input', 'answer-input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  promptCard.appendChild(input);

  feedback = el('div', 'feedback');
  promptCard.appendChild(feedback);
  root_.appendChild(promptCard);

  root_.appendChild(hints([
    ['Enter', 'comprobar / continuar'],
    ['Esc', 'terminar práctica'],
  ]));

  updateProgress();
  input.focus();
}

function updateProgress() {
  const done = pos;
  progressText.textContent = `Palabra ${Math.min(done + 1, total)} de ${total}`;
  progressFill.style.width = `${(done / total) * 100}%`;
}

function normalize(s) {
  return s.trim().toLowerCase();
}

function check() {
  const item = current();
  const expected = direction === 'es_to_en' ? item.english : item.spanish;

  if (!normalize(input.value)) return;

  if (normalize(input.value) === normalize(expected)) {
    if (!item.retry) firstTryHits++;
    feedback.className = 'feedback ok';
    feedback.textContent = '✓ ¡Correcto!';
    promptCard.classList.add('flash-ok');
    input.disabled = true;
    setTimeout(next, 600);
  } else {
    feedback.className = 'feedback bad';
    feedback.textContent = `✗ Era: ${expected}`;
    promptCard.classList.add('flash-bad');
    input.disabled = true;
    awaitingNext = true;
    // Reencolar al final de la misma canción para reintentarla.
    const song = item.song;
    let insertAt = queue.length;
    for (let i = pos + 1; i < queue.length; i++) {
      if (queue[i].song !== song) { insertAt = i; break; }
    }
    queue.splice(insertAt, 0, { ...item, retry: true });
    total++;
  }
}

function next() {
  pos++;
  if (pos >= queue.length) renderSummary();
  else renderCurrent();
}

function renderSummary() {
  finished = true;
  const uniqueWords = new Set(queue.map((q) => q.english + '¦' + q.spanish)).size;
  const accuracy = uniqueWords ? Math.round((firstTryHits / uniqueWords) * 100) : 0;

  root_.innerHTML = '';
  const card = el('div', 'card summary');
  card.appendChild(el('div', 'big', accuracy === 100 ? '🏆' : accuracy >= 60 ? '🎉' : '💪'));
  card.appendChild(el('h2', '', '¡Práctica terminada!'));
  card.appendChild(el('p', '',
    `Acertaste a la primera ${firstTryHits} de ${uniqueWords} palabras (${accuracy}%).`));

  const row = el('div', 'btn-row');
  const again = el('button', 'btn primary', '↻ Repetir');
  again.onclick = () => practiceView.mount(root_, lastParams);
  const back = el('button', 'btn', '← Volver a la lista');
  back.onclick = () => navigate('songs');
  row.append(again, back);
  card.appendChild(row);
  root_.appendChild(card);

  root_.appendChild(hints([
    ['← →', 'elegir'],
    ['Enter', 'aceptar'],
    ['Esc', 'volver'],
  ]));

  summaryButtons = [again, back];
  summaryIdx = 1;
  applyFocus(summaryButtons, summaryIdx);
}

function onSummaryKey(e) {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    summaryIdx = summaryIdx === 0 ? 1 : 0;
    applyFocus(summaryButtons, summaryIdx);
  } else if (e.key === 'Enter') {
    summaryButtons[summaryIdx].click();
  } else {
    return;
  }
  e.preventDefault();
}
