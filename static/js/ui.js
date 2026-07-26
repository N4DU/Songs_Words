// Shared UI helpers: node creation, keyboard focus and hint bar.

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Song thumbnail: real image, or its initial over a gradient.
export function thumb(song, className) {
  if (song.image) {
    const img = el('img', className);
    img.src = `/images/${song.image}`;
    img.alt = song.title;
    return img;
  }
  return el('div', className, (song.title[0] || '♪').toUpperCase());
}

// Bottom bar listing the keys available in the current view.
export function hints(pairs) {
  const bar = el('div', 'hints');
  for (const [key, label] of pairs) {
    const span = el('span');
    const kbd = el('kbd', '', key);
    span.append(kbd, ' ' + label);
    bar.appendChild(span);
  }
  return bar;
}

// Highlights the keyboard-focused element and keeps it centered on screen,
// so there is always context visible above and below the selection.
export function applyFocus(nodes, index) {
  nodes.forEach((n, i) => n.classList.toggle('kfocus', i === index));
  const active = nodes[index];
  if (active) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// Modal confirmation dialog driven by ←/→, Enter and Escape.
// Returns an object with onKey; calls done(true/false) once decided.
export function confirmDialog(message, done) {
  const overlay = el('div', 'overlay');
  const box = el('div', 'dialog');
  box.appendChild(el('p', '', message));
  const row = el('div', 'btn-row');
  const yes = el('button', 'btn danger', 'Yes');
  const no = el('button', 'btn', 'No');
  row.append(yes, no);
  box.appendChild(row);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  const buttons = [yes, no];
  let idx = 1; // "No" by default
  applyFocus(buttons, idx);

  const finish = (result) => { overlay.remove(); done(result); };
  yes.onclick = () => finish(true);
  no.onclick = () => finish(false);

  return {
    onKey(e) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        idx = idx === 0 ? 1 : 0;
        applyFocus(buttons, idx);
      } else if (e.key === 'Enter') {
        finish(idx === 0);
      } else if (e.key === 'Escape') {
        finish(false);
      }
      e.preventDefault();
    },
  };
}
