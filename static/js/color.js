// Color engine: extracts dominant colors from cover art and drives the
// ambient "aurora" background. On the home screen the palette is built
// from your own songs' covers; during practice it comes from the current
// song, YT-Music style. A custom color stored on a song overrides it.

const cache = new Map(); // song.id -> extracted hex (or null)

async function songColor(song) {
  if (song.color) return song.color;
  if (!song.image) return null;
  if (cache.has(song.id)) return cache.get(song.id);
  const hex = await dominantColor(`/images/${song.image}`).catch(() => null);
  cache.set(song.id, hex);
  return hex;
}

// Practice: the whole screen takes the song's hue.
export async function applySongTheme(song) {
  setThemeVars(await songColor(song));
}

// Home: tint the aurora blobs with up to three covers, selected songs first.
export async function applyAmbientFromSongs(songs) {
  const pool = [...songs].sort((a, b) => (b.selected || 0) - (a.selected || 0));
  const colors = [];
  for (const song of pool) {
    if (colors.length >= 3) break;
    const hex = await songColor(song);
    if (hex) colors.push(hex);
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
}

export function clearTheme() {
  const style = document.body.style;
  for (const prop of ['--theme-a', '--theme-b', '--theme-accent',
                      '--amb-1', '--amb-2', '--amb-3']) {
    style.removeProperty(prop);
  }
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

// Downscales the image and picks the most frequent hue among reasonably
// colorful pixels, then averages that bucket.
function dominantColor(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 40;
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

      let best = null;
      for (const bucket of buckets.values()) {
        if (!best || bucket.count > best.count) best = bucket;
      }
      if (!best) { resolve(null); return; }
      resolve(rgbToHex(
        Math.round(best.r / best.count),
        Math.round(best.g / best.count),
        Math.round(best.b / best.count),
      ));
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
