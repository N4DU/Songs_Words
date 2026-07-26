// Practice view: shows the word in one language, you answer in the other.
// Missed words are re-queued at the end of their song until you get them.
// The whole screen takes on a theme based on the song's cover art.

import * as api from '../api.js';
import { navigate } from '../main.js';
import { el, thumb, hints, applyFocus } from '../ui.js';
import { t } from '../i18n.js';
import { applySongTheme, clearTheme } from '../color.js';

let queue = [];          // [{song, word, translation, retry}]
let pos = 0;
let total = 0;
let firstTryHits = 0;
let direction = 'to_word';
let retryMissed = true;
let ignoreAccents = true;

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
    retryMissed = settings.retry_missed;
    ignoreAccents = settings.ignore_accents;

    queue = [];
    for (const song of songs) {
      const words = shuffle([...song.words]);
      for (const w of words) queue.push({ song, ...w, retry: false });
    }
    pos = 0;
    total = queue.length;
    firstTryHits = 0;
    finished = false;

    if (!queue.length) { navigate('songs'); return; }
    renderCurrent();
  },

  unmount() {
    clearTheme();
  },

  onKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      navigate('songs');
      return;
    }
    if (finished) return onSummaryKey(e);
    if (e.key === 'Enter') {
      e.preventDefault();
      check();
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
  const asked = direction === 'to_word' ? item.translation : item.word;

  applySongTheme(item.song);
  root_.innerHTML = '';
  const wrap = el('div', 'practice-wrap');
  // Only the card is centered; cover and progress bar live in .practice-top,
  // absolutely anchored right above it (see styles.css: --practice-lift).
  const group = el('div', 'practice-group');
  const top = el('div', 'practice-top');

  const header = el('div', 'practice-header');
  header.appendChild(thumb(item.song, 'practice-cover'));
  const info = el('div');
  info.appendChild(el('div', 'practice-song-title', item.song.title));
  progressText = el('div', 'practice-progress');
  info.appendChild(progressText);
  header.appendChild(info);
  top.appendChild(header);

  const bar = el('div', 'progress-bar');
  progressFill = el('div');
  bar.appendChild(progressFill);
  top.appendChild(bar);
  group.appendChild(top);

  promptCard = el('div', 'card prompt-card');
  promptCard.appendChild(el('div', 'prompt-label',
    direction === 'to_word' ? t('writeWord') : t('writeTranslation')));
  promptCard.appendChild(el('div', 'prompt-word', asked));

  input = el('input', 'answer-input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  promptCard.appendChild(input);

  feedback = el('div', 'feedback');
  promptCard.appendChild(feedback);
  group.appendChild(promptCard);

  wrap.appendChild(el('div')); // top spacer
  wrap.appendChild(group);
  wrap.appendChild(el('div')); // bottom spacer
  root_.appendChild(wrap);

  root_.appendChild(hints([
    ['Enter', t('hintCheck')],
    ['Esc', t('hintEndPractice')],
  ]));

  updateProgress();
  input.focus();
}

function updateProgress() {
  const done = pos;
  progressText.textContent = t('progress', { n: Math.min(done + 1, total), total });
  progressFill.style.width = `${(done / total) * 100}%`;
}

function normalize(s) {
  s = s.trim().toLowerCase();
  if (ignoreAccents) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return s;
}

function check() {
  if (input.disabled) return; // a result is already showing
  const item = current();
  const expected = direction === 'to_word' ? item.word : item.translation;

  if (!normalize(input.value)) return;

  if (normalize(input.value) === normalize(expected)) {
    if (!item.retry) firstTryHits++;
    feedback.className = 'feedback ok';
    feedback.textContent = t('correct');
    promptCard.classList.add('flash-ok');
    input.disabled = true;
    setTimeout(next, 600);
  } else {
    feedback.className = 'feedback bad';
    feedback.textContent = t('wrongWas', { answer: expected });
    promptCard.classList.add('flash-bad');
    input.disabled = true;
    if (retryMissed) {
      // Re-queue at the end of the same song to retry it.
      const song = item.song;
      let insertAt = queue.length;
      for (let i = pos + 1; i < queue.length; i++) {
        if (queue[i].song !== song) { insertAt = i; break; }
      }
      queue.splice(insertAt, 0, { ...item, retry: true });
      total++;
    }
    // No extra Enter: a pause long enough to read the answer, then on.
    setTimeout(next, 1800);
  }
}

function next() {
  pos++;
  if (pos >= queue.length) renderSummary();
  else renderCurrent();
}

function renderSummary() {
  finished = true;
  const uniqueWords = new Set(queue.map((q) => q.word + '¦' + q.translation)).size;
  const accuracy = uniqueWords ? Math.round((firstTryHits / uniqueWords) * 100) : 0;

  root_.innerHTML = '';
  const card = el('div', 'card summary');
  card.appendChild(el('div', 'big', accuracy === 100 ? '🏆' : accuracy >= 60 ? '🎉' : '💪'));
  card.appendChild(el('h2', '', t('complete')));
  card.appendChild(el('p', '',
    t('result', { hits: firstTryHits, total: uniqueWords, pct: accuracy })));

  const row = el('div', 'btn-row');
  const again = el('button', 'btn primary', t('again'));
  again.onclick = () => practiceView.mount(root_, lastParams);
  const back = el('button', 'btn', t('backToList'));
  back.onclick = () => navigate('songs');
  row.append(again, back);
  card.appendChild(row);
  const wrap = el('div', 'practice-wrap');
  wrap.appendChild(el('div'));
  wrap.appendChild(card);
  wrap.appendChild(el('div'));
  root_.appendChild(wrap);

  root_.appendChild(hints([
    ['← →', t('hintChoose')],
    ['Enter', t('hintConfirm')],
    ['Esc', t('hintBack')],
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
