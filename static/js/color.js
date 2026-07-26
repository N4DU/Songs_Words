// Color engine: reads each cover and turns it into the app's atmosphere.
// During practice the backdrop is woven from the whole image — a blurred,
// darkened rendition of the cover itself, with its main hues drifting as
// aurora blobs on top. The home screen tints its aurora from your covers.

const paletteCache = new Map(); // song.id -> { colors: [hex], tiny: dataURL } | null

async function songPalette(song) {
  if (!song.image) return null;
  if (paletteCache.has(song.id)) return paletteCache.get(song.id);
  const pal = await analyzeImage(`/images/${song.image}`).catch(() => null);
  paletteCache.set(song.id, pal);
  return pal;
}

let themedSongId = null; // avoids re-theming on every word of the same song

// Practice: the whole screen dresses itself with the current song's cover.
// A manual color on the song replaces the image-based look entirely.
export async function applySongTheme(song) {
  if (song.id === themedSongId) return;
  themedSongId = song.id;

  if (!song.color) {
    const pal = await songPalette(song);
    if (pal && pal.colors.length) {
      themeFromPalette(pal.colors);
      showBackdrop(pal.tiny);
      return;
    }
  }
  hideBackdrop();
  setThemeVars(song.color || null);
}

// Home: tint the aurora blobs with up to three covers, selected songs first.
export async function applyAmbientFromSongs(songs) {
  const pool = [...songs].sort((a, b) => (b.selected || 0) - (a.selected || 0));
  const colors = [];
  for (const song of pool) {
    if (colors.length >= 3) break;
    if (song.color) { colors.push(song.color); continue; }
    const pal = await songPalette(song);
    if (pal && pal.colors.length) colors.push(pal.colors[0]);
  }
  const style = document.body.style;
  ['--amb-1', '--amb-2', '--amb-3'].forEach((prop, i) => {
    if (colors.length) {
      const [h, s] = rgbToHsl(...hexToRgb(colors[i % colors.length]));
      style.setProperty(prop, hslCss(h, clampSat(s), 0.38));
    } else {
      style.removeProperty(prop);
    }
  });
  hideBackdrop();
}

export function clearTheme() {
  const style = document.body.style;
  for (const prop of ['--theme-a', '--theme-b', '--theme-accent',
                      '--amb-1', '--amb-2', '--amb-3']) {
    style.removeProperty(prop);
  }
  hideBackdrop();
  themedSongId = null;
}

// The strongest hue drives the base gradient and the accent; up to three
// of the cover's hues float as soft blobs above the blurred image.
function themeFromPalette(colors) {
  const style = document.body.style;
  const [h, s] = rgbToHsl(...hexToRgb(colors[0]));
  const st = clampSat(s);
  style.setProperty('--theme-a', hslCss(h, st, 0.26));
  style.setProperty('--theme-b', hslCss(h, st * 0.8, 0.09));
  style.setProperty('--theme-accent', hslCss(h, st, 0.62));
  ['--amb-1', '--amb-2', '--amb-3'].forEach((prop, i) => {
    const [hh, ss] = rgbToHsl(...hexToRgb(colors[i % colors.length]));
    style.setProperty(prop, hslCss(hh, clampSat(ss), 0.42));
  });
}

// Deep gradient + blob tones derived from one base color: a saturated dark
// shade on top fading into an almost-black version of the same hue.
function setThemeVars(hex) {
  const [h, s] = hex ? rgbToHsl(...hexToRgb(hex)) : rgbToHsl(77, 208, 225);
  const st = clampSat(s);
  const style = document.body.style;
  style.setProperty('--theme-a', hslCss(h, st, 0.30));
  style.setProperty('--theme-b', hslCss(h, st * 0.8, 0.10));
  style.setProperty('--theme-accent', hslCss(h, st, 0.62));
  style.setProperty('--amb-1', hslCss(h, st, 0.40));
  style.setProperty('--amb-2', hslCss((h + 0.08) % 1, st, 0.35));
  style.setProperty('--amb-3', hslCss((h + 0.92) % 1, st, 0.30));
}

function clampSat(s) {
  return Math.min(Math.max(s, 0.35), 0.7);
}

// ---------- Blurred image backdrop ----------

function backdropNode() {
  const aurora = document.querySelector('.aurora');
  let img = aurora.querySelector('.backdrop');
  if (!img) {
    img = document.createElement('img');
    img.className = 'backdrop';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    aurora.insertBefore(img, aurora.firstChild); // painted below the blobs
  }
  return img;
}

function showBackdrop(src) {
  const img = backdropNode();
  img.src = src;
  img.classList.add('on');
}

function hideBackdrop() {
  const img = document.querySelector('.aurora .backdrop');
  if (img) img.classList.remove('on');
}

// Reads the cover once: keeps a tiny copy of it for the blurred backdrop
// and ranks its hues to build a small palette of its most present colors.
function analyzeImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 32;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, size, size);
      const { data } = ctx.getImageData(0, 0, size, size);

      const buckets = new Map(); // hue bucket -> {count, r, g, b}
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const [h, s, l] = rgbToHsl(r, g, b);
        if (s < 0.2 || l < 0.12 || l > 0.88) continue; // skip greys/extremes
        const key = Math.round((h * 360) / 24); // 24°-wide buckets
        const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
        bucket.count++;
        bucket.r += r; bucket.g += g; bucket.b += b;
        buckets.set(key, bucket);
      }

      const colors = [...buckets.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 4)
        .map((k) => rgbToHex(
          Math.round(k.r / k.count),
          Math.round(k.g / k.count),
          Math.round(k.b / k.count),
        ));
      resolve({ colors, tiny: canvas.toDataURL() });
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ---------- Color conversions ----------

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h, s, l];
}

function hslCss(h, s, l) {
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}
