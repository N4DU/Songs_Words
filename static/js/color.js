// Per-song theme: extracts the dominant color from the cover art and turns
// the practice screen into a rich, YT-Music-like gradient. A custom color
// stored on the song overrides the automatic one.

const cache = new Map();
const DEFAULT_ACCENT = '#00acc1';

export async function applySongTheme(song) {
  let hex = song.color || null;
  if (!hex && song.image) {
    if (cache.has(song.id)) {
      hex = cache.get(song.id);
    } else {
      hex = await dominantColor(`/images/${song.image}`).catch(() => null);
      cache.set(song.id, hex);
    }
  }
  setTheme(hex || DEFAULT_ACCENT);
}

export function clearTheme() {
  document.body.classList.remove('themed');
  document.body.style.removeProperty('--theme-a');
  document.body.style.removeProperty('--theme-b');
  document.body.style.removeProperty('--theme-accent');
}

// Deep gradient tones derived from the base color: a saturated dark shade
// on top fading into an almost-black version of the same hue.
function setTheme(hex) {
  const [h, s] = rgbToHsl(...hexToRgb(hex));
  const strength = Math.min(Math.max(s, 0.35), 0.7);
  document.body.style.setProperty('--theme-a', hslCss(h, strength, 0.30));
  document.body.style.setProperty('--theme-b', hslCss(h, strength * 0.8, 0.10));
  document.body.style.setProperty('--theme-accent', hslCss(h, strength, 0.62));
  document.body.classList.add('themed');
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
