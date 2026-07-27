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
let themeToken = 0;      // invalidates a theme still waiting for its palette

// Practice: the whole screen dresses itself with the current song's cover.
// A manual color on the song replaces the image-based look entirely.
export async function applySongTheme(song) {
  if (song.id === themedSongId) return;
  themedSongId = song.id;
  const token = ++themeToken;
  scatterBlobs();

  if (!song.color) {
    const pal = await songPalette(song);
    if (token !== themeToken) return; // the view left while reading the cover
    // A grey cover gives no hues but the blurred image is still worth it.
    if (pal && pal.tiny) {
      if (pal.colors.length) themeFromPalette(pal.colors);
      else setThemeVars(null);
      showBackdrop(pal.tiny);
      return;
    }
  }
  hideBackdrop();
  setThemeVars(song.color || null);
}

// Home: a different scene on every visit. The tones come from your covers
// (selected songs first, a random pick of each palette); without covers a
// random hue family is used. Everything stays dark, saturated and serious —
// never washed out, never garish.
export async function applyAmbientFromSongs(songs) {
  scatterBlobs();
  hideBackdrop();
  themedSongId = null;
  themeToken++;

  const pool = shuffleArr([...songs]).sort((a, b) => (b.selected || 0) - (a.selected || 0));
  const found = [];
  for (const song of pool) {
    if (found.length >= 3) break;
    if (song.color) { found.push(song.color); continue; }
    const pal = await songPalette(song);
    if (pal && pal.colors.length) {
      found.push(pal.colors[Math.floor(Math.random() * pal.colors.length)]);
    }
  }

  let hues = found.map((hex) => {
    const [h, s] = rgbToHsl(...hexToRgb(hex));
    return [h, clampSat(s)];
  });
  if (!hues.length) {
    const h = Math.random(); // analogous trio around a random base hue
    hues = [[h, 0.55], [(h + 0.08) % 1, 0.5], [(h + 0.92) % 1, 0.5]];
  }
  while (hues.length < 3) {
    const [h, s] = hues[hues.length - 1];
    hues.push([(h + rand(0.05, 0.1)) % 1, s]);
  }
  hues = shuffleArr(hues);

  const style = document.body.style;
  ['--amb-1', '--amb-2', '--amb-3'].forEach((prop, i) => {
    const [h, s] = hues[i];
    style.setProperty(prop, hslCss(jitter(h, 0.03), s, rand(0.30, 0.42)));
  });
  const [h0, s0] = hues[0];
  style.setProperty('--theme-a', hslCss(h0, s0, rand(0.13, 0.20)));
  style.setProperty('--theme-b', hslCss(jitter(h0, 0.04), s0 * 0.8, 0.07));
  style.setProperty('--theme-accent', hslCss(h0, Math.max(s0, 0.5), 0.62));
}

// Rearranges the aurora blobs: fresh corners, sizes and rhythm, so the
// composition never repeats between visits.
function scatterBlobs() {
  const zones = [
    { top: [-24, -10], left: [-18, -4] },
    { top: [-20, -6], left: [52, 74] },
    { top: [52, 72], left: [-14, 4] },
    { top: [48, 68], left: [52, 76] },
    { top: [16, 38], left: [24, 52] },
  ];
  const picks = shuffleArr([...zones]).slice(0, 3);
  document.querySelectorAll('.aurora .blob').forEach((blob, i) => {
    const z = picks[i];
    const size = rand(36, 58);
    blob.style.top = `${rand(...z.top)}vmax`;
    blob.style.left = `${rand(...z.left)}vmax`;
    blob.style.bottom = 'auto';
    blob.style.right = 'auto';
    blob.style.width = `${size}vmax`;
    blob.style.height = `${size}vmax`;
    blob.style.opacity = rand(0.28, 0.46).toFixed(2);
    blob.style.animationDuration = `${rand(22, 40).toFixed(1)}s`;
    blob.style.animationDelay = `-${rand(0, 20).toFixed(1)}s`;
  });
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function jitter(h, amount) {
  return (h + rand(-amount, amount) + 1) % 1;
}

function shuffleArr(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function clearTheme() {
  const style = document.body.style;
  for (const prop of ['--theme-a', '--theme-b', '--theme-accent',
                      '--amb-1', '--amb-2', '--amb-3']) {
    style.removeProperty(prop);
  }
  hideBackdrop();
  themedSongId = null;
  themeToken++;
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
      // Anything thrown here (no 2d context, tainted canvas) would leave the
      // promise pending forever, so it is turned into a rejection.
      try {
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
      } catch (e) {
        reject(e);
      }
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
