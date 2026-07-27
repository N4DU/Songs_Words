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
// One leniency rule per interface language (see normalize()).
let perLang = {};

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
    perLang = {
      en_apostrophes: settings.en_apostrophes,
      es_inverted_marks: settings.es_inverted_marks,
      fr_ligatures: settings.fr_ligatures,
      de_eszett: settings.de_eszett,
      it_double_consonants: settings.it_double_consonants,
      pt_cedilla: settings.pt_cedilla,
      ru_yo: settings.ru_yo,
      ja_kana: settings.ja_kana,
      zh_width: settings.zh_width,
      ko_jamo: settings.ko_jamo,
    };

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

// Comparison is done on normalized strings. Beyond the generic "ignore
// accents" rule, each interface language gets one leniency rule designed for
// its script; the order below matters (the German expansion, for instance,
// must run before accents are stripped so u-umlaut becomes ue and not just u).
// Regexes use \u escapes on purpose: raw non-ASCII in a regex literal has
// bitten this file before.
function shiftCodes(s, re, delta) {
  return s.replace(re, (c) => String.fromCharCode(c.charCodeAt(0) + delta));
}

function normalize(s) {
  // Korean: compose decomposed jamo into full syllables.
  if (perLang.ko_jamo) s = s.normalize('NFC');

  s = s.trim().toLowerCase();

  // Chinese: full-width forms and the ideographic space become ASCII.
  if (perLang.zh_width) {
    s = shiftCodes(s, /[\uff01-\uff5e]/g, -0xfee0).replace(/\u3000/g, ' ');
  }
  // Japanese: katakana reads as hiragana (the prolonged sound mark stays).
  if (perLang.ja_kana) s = shiftCodes(s, /[\u30a1-\u30f6]/g, -0x60);
  // Russian: yo counts as ye.
  if (perLang.ru_yo) s = s.replace(/\u0451/g, '\u0435');
  // German: eszett and the umlauts expand the way German spelling does.
  if (perLang.de_eszett) {
    s = s.replace(/\u00df/g, 'ss')
      .replace(/\u00e4/g, 'ae')
      .replace(/\u00f6/g, 'oe')
      .replace(/\u00fc/g, 'ue');
  }
  // French: the oe and ae ligatures split into two letters.
  if (perLang.fr_ligatures) {
    s = s.replace(/\u0153/g, 'oe').replace(/\u00e6/g, 'ae');
  }
  // Portuguese: c-cedilla counts as c on its own.
  if (perLang.pt_cedilla) s = s.replace(/\u00e7/g, 'c');
  // Spanish: the opening inverted question and exclamation marks are dropped.
  if (perLang.es_inverted_marks) s = s.replace(/[\u00bf\u00a1]/g, '');
  // English: apostrophes in every shape are dropped.
  if (perLang.en_apostrophes) s = s.replace(/['\u2018\u2019`]/g, '');
  // Italian: a doubled letter counts as a single one.
  if (perLang.it_double_consonants) s = s.replace(/(\p{L})\1+/gu, '$1');

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
