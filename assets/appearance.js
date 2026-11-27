import {runtimeConfig} from './runtime-config.js';
import {COSMETIC_TYPES, cosmeticItem, COSMETIC_ITEMS, nameMarkup, bannerClass, celebrate} from './cosmetics.js';
export const THEMES = [
  {
    id: 'mauve',
    name: 'Midnight mauve',
    description: 'The original AniLoop palette.',
    colors: ['#080808', '#151515', '#9b83a5'],
  },
  {
    id: 'moonstone',
    name: 'Moonstone',
    description: 'Charcoal, silver, and soft violet.',
    colors: ['#101114', '#1b1d23', '#a9a8bd'],
  },
  {
    id: 'forest',
    name: 'Forest night',
    description: 'Deep black with quiet sage accents.',
    colors: ['#090d0c', '#151c19', '#91afa0'],
  },
  {
    id: 'ink',
    name: 'Ink blue',
    description: 'Midnight surfaces and muted blue.',
    colors: ['#090c12', '#161c27', '#95a8c6'],
  },
  {
    id: 'sakura',
    name: 'Sakura night',
    description: 'Warm blossom pink on deep plum.',
    colors: ['#0f0a0d', '#1c1218', '#f0a6c4'],
  },
  {
    id: 'neon',
    name: 'Neon arcade',
    description: 'Electric cyan with a magenta edge.',
    colors: ['#07090f', '#0f1520', '#4fe3ff'],
  },
  {
    id: 'ocean',
    name: 'Deep ocean',
    description: 'Teal light far below the surface.',
    colors: ['#06100f', '#0d1c1b', '#4fd1b8'],
  },
  {
    id: 'ember',
    name: 'Ember glow',
    description: 'Charcoal with warm amber sparks.',
    colors: ['#0f0a07', '#1d140e', '#ffb066'],
  },
  {
    id: 'crimson',
    name: 'Crimson moon',
    description: 'Shōnen red against the night.',
    colors: ['#0e0708', '#1c0f11', '#ff6b6b'],
  },
];
export const BACKGROUNDS = [
  {id: 'none', name: 'Pure black', description: 'A clean, quiet canvas.'},
  {id: 'dusk', name: 'Mauve dusk', description: 'A soft horizon after the credits.'},
  {id: 'grove', name: 'Night garden', description: 'Subtle layers of midnight green.'},
  {id: 'grid', name: 'Midnight grid', description: 'Fine lines for a focused setup.'},
  {id: 'blossom', name: 'Blossom haze', description: 'Pink light drifting through the dark.'},
  {id: 'skyline', name: 'City skyline', description: 'A neon horizon after the last train.'},
  {id: 'nebula', name: 'Nebula', description: 'Soft violet and blue deep space.'},
];
export const FRAMES = [
  {id: 'classic', name: 'Classic', description: 'The original AniLoop profile.', price: 0},
  {id: 'silver', name: 'Silver lining', description: 'A polished silver outline.', price: 250},
  {id: 'orbit', name: 'Mauve orbit', description: 'Two rings, one endless loop.', price: 650},
  {id: 'starlit', name: 'Starlit loop', description: 'A constellation around your alias.', price: 1600},
  {id: 'fern', name: 'Night bloom', description: 'Sage corners for a quieter profile.', price: 400},
  {id: 'ink', name: 'Ink panel', description: 'A sharp frame inspired by manga panels.', price: 900},
  {id: 'lunar', name: 'Lunar arc', description: 'A crescent that follows your next loop.', price: 2200},
  {id: 'sakura', name: 'Sakura drift', description: 'Petals that drift around your picture.', price: 1200},
  {id: 'neon', name: 'Neon pulse', description: 'A city-night glow that shifts from pink to cyan.', price: 3000},
  {id: 'ember', name: 'Ember crown', description: 'A smouldering ring with a tiny crown.', price: 4000},
  {id: 'aurora', name: 'Aurora veil', description: 'Northern lights that slowly change colour.', price: 5500},
  {id: 'holo', name: 'Holo foil', description: 'An iridescent trading-card shine.', price: 7500},
  {id: 'galaxy', name: 'Galaxy loop', description: 'A deep-space ring with orbiting stars.', price: 10000},
];
export const DEFAULT_APPEARANCE = {
  theme: 'mauve',
  background: 'none',
  dim: 70,
  inGame: false,
  position: 'center',
  profileX: 50,
  profileY: 50,
  profileZoom: 1,
  bgZoom: 1,
  bgX: 50,
  bgY: 50,
  bgImageAt: 0,
};
export function normalizeAppearance(value = {}) {
  return {
    theme: THEMES.some((t) => t.id === value?.theme) ? value.theme : 'mauve',
    background: [...BACKGROUNDS.map((b) => b.id), 'custom'].includes(value?.background) ? value.background : 'none',
    dim: Number.isFinite(value?.dim) ? Math.max(35, Math.min(90, value.dim)) : 70,
    inGame: value?.inGame === true,
    position: ['center', 'top', 'bottom'].includes(value?.position) ? value.position : 'center',
    profileX: Number.isFinite(value?.profileX) ? Math.max(0, Math.min(100, value.profileX)) : 50,
    profileY: Number.isFinite(value?.profileY) ? Math.max(0, Math.min(100, value.profileY)) : 50,
    profileZoom: Number.isFinite(value?.profileZoom) ? Math.max(1, Math.min(3, value.profileZoom)) : 1,
    // Page background fit: zoom 1–3, focus point in percent. Older saves map their top/center/bottom choice.
    bgZoom: Number.isFinite(value?.bgZoom) ? Math.max(1, Math.min(3, value.bgZoom)) : 1,
    bgX: Number.isFinite(value?.bgX) ? Math.max(0, Math.min(100, value.bgX)) : 50,
    // When the uploaded image was last saved to the account (0 = never); other devices fetch it when newer.
    bgImageAt: Number.isSafeInteger(value?.bgImageAt) && value.bgImageAt > 0 ? value.bgImageAt : 0,
    bgY: Number.isFinite(value?.bgY)
      ? Math.max(0, Math.min(100, value.bgY))
      : value?.position === 'top'
        ? 0
        : value?.position === 'bottom'
          ? 100
          : 50,
  };
}
const PREF_KEY = 'aniloop-appearance-v1';
function readSavedAt() {
  try {
    return Number(JSON.parse(localStorage.getItem(PREF_KEY))?.savedAt) || 0;
  } catch {
    return 0;
  }
}
export function readAppearance() {
  try {
    return normalizeAppearance(JSON.parse(localStorage.getItem(PREF_KEY)));
  } catch {
    return {...DEFAULT_APPEARANCE};
  }
}
let database;
function db() {
  return (database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('aniloop-appearance', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('backgrounds');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      database = null;
      reject(request.error);
    };
  }));
}
async function backgroundStore(operation, value) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('backgrounds', operation === 'get' ? 'readonly' : 'readwrite'),
      store = tx.objectStore('backgrounds');
    const request =
      operation === 'put'
        ? store.put(value, 'custom')
        : operation === 'delete'
          ? store.delete('custom')
          : store.get('custom');
    let result;
    request.onsuccess = () => {
      result = request.result;
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Background storage was interrupted.'));
  });
}
export async function prepareBackground(file) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be opened. Try another PNG, JPEG, or WebP file.');
  }
  try {
    if (bitmap.width * bitmap.height > 24000000) throw new Error('Choose an image with fewer than 24 million pixels.');
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (!blob) throw new Error('The image could not be prepared. Try another file.');
    return {
      blob,
      name: String(file.name || 'Custom background').slice(0, 160),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    bitmap.close();
  }
}
const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
/** Encodes an uploaded background for the account, shrinking it if it would exceed the server limit. */
export async function backgroundForAccount(upload) {
  let url = await blobToDataUrl(upload.blob),
    {width, height} = upload;
  if (url.length > 990_000) {
    const bitmap = await createImageBitmap(upload.blob),
      scale = Math.min(1, 1280 / Math.max(width, height)),
      canvas = document.createElement('canvas');
    canvas.width = width = Math.max(1, Math.round(width * scale));
    canvas.height = height = Math.max(1, Math.round(height * scale));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    url = canvas.toDataURL('image/webp', 0.72);
    if (url.length > 990_000) throw new Error('This image is too detailed to sync. It stays on this device.');
  }
  return {image: url, width, height, name: upload.name};
}
export function profileCrop(width, height, {x = 50, y = 50, zoom = 1} = {}) {
  const clamp = (n, min, max, fallback) =>
    Number.isFinite(Number(n)) ? Math.max(min, Math.min(max, Number(n))) : fallback;
  const side = Math.min(width, height) / clamp(zoom, 1, 3, 1);
  return {x: ((width - side) * clamp(x, 0, 100, 50)) / 100, y: ((height - side) * clamp(y, 0, 100, 50)) / 100, side};
}
export function moveProfileCrop(width, height, crop, dx, dy, previewSize) {
  const {side} = profileCrop(width, height, crop);
  const position = (value, delta, range) =>
    range > 0 ? Math.max(0, Math.min(100, value - ((delta * side) / previewSize / range) * 100)) : 50;
  return {...crop, x: position(crop.x, dx, width - side), y: position(crop.y, dy, height - side)};
}
function drawProfileCrop(canvas, bitmap, crop, fill = false) {
  const {x, y, side} = profileCrop(bitmap.width, bitmap.height, crop),
    context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (fill) {
    context.fillStyle = '#151515';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(bitmap, x, y, side, side, 0, 0, canvas.width, canvas.height);
}
export async function prepareProfilePicture(file, {shared = false, crop = {}} = {}) {
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.');
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be opened.');
  }
  try {
    if (bitmap.width * bitmap.height > 24000000) throw new Error('Choose an image with fewer than 24 million pixels.');
    const size = shared ? 160 : 256,
      canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    drawProfileCrop(canvas, bitmap, crop, shared);
    return shared ? canvas.toDataURL('image/jpeg', 0.85) : canvas.toDataURL('image/png');
  } finally {
    bitmap.close();
  }
}
const shared = runtimeConfig.mode === 'supabase';
const TYPE_BY_TAB = Object.fromEntries(COSMETIC_TYPES.map((t) => [t.tab, t]));
// Eight item kinds grouped into four tabs; each tab stacks its sections so there are no sub-tabs.
const TAB_GROUPS = [
  {id: 'frames', label: 'Frames', views: ['frames']},
  {id: 'names', label: 'Names & titles', views: ['names', 'titles']},
  {id: 'banners', label: 'Banners & effects', views: ['banners', 'effects']},
  {id: 'themes', label: 'Themes', views: ['themes']},
];
const tabGroup = (id) => TAB_GROUPS.find((g) => g.id === id || g.views.includes(id)) || TAB_GROUPS[0];
const EFFECT_ICONS = {'effect-sparkle': '✦', 'effect-sakura': '✿', 'effect-confetti': '❖', 'effect-fireworks': '✺'};
const PICTURE_CHECK = {
  'not-configured': 'The automatic safety check is not set up on the server yet.',
  'openai-401': 'The safety check service rejected the server’s API key.',
  'openai-429': 'The safety check service is rate-limited or has no quota left.',
  'openai-invalid': 'The safety check returned an unexpected answer.',
  unreachable: 'The safety check could not be reached.',
};
const PICTURE_STATUS = {
  approved: '✓ Passed the safety check · visible to your friends and on the leaderboard.',
  pending: 'Waiting for review · only you can see this picture for now.',
  private: 'Only you can see this picture. Upload it again to share it with your friends.',
};
// Shared crop box: a fixed-ratio window over an image, stored as {x, y, zoom} (focus in %, zoom 1–3).
// The same mapping matches CSS `cover` + `transform: scale(zoom)` with origin at the focus point.
const CROP_HANDLES = ['nw', 'ne', 'sw', 'se']
  .map((c) => `<span class="crop-handle ${c}" data-corner="${c}" aria-hidden="true"></span>`)
  .join('');
function cropBox(width, height, ratio, {x = 50, y = 50, zoom = 1} = {}) {
  const baseW = Math.min(width, height * ratio),
    w = baseW / zoom,
    h = w / ratio;
  return {baseW, w, h, x: ((width - w) * x) / 100, y: ((height - h) * y) / 100};
}
function attachCropBox({surface, selection, width, height, ratio, get, set}) {
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const box = () => cropBox(width, height, ratio, get());
  const paint = () => {
    const r = box();
    Object.assign(selection.style, {
      left: (r.x / width) * 100 + '%',
      top: (r.y / height) * 100 + '%',
      width: (r.w / width) * 100 + '%',
      height: (r.h / height) * 100 + '%',
    });
  };
  const commit = (x, y, w, final) => {
    const {baseW} = box();
    w = clamp(w, baseW / 3, baseW);
    const h = w / ratio;
    x = clamp(x, 0, width - w);
    y = clamp(y, 0, height - h);
    set(
      {
        zoom: baseW / w,
        x: width - w > 1e-6 ? (x / (width - w)) * 100 : 50,
        y: height - h > 1e-6 ? (y / (height - h)) * 100 : 50,
      },
      final,
    );
    paint();
  };
  const zoomBy = (factor) => {
    const r = box(),
      w = r.w / factor;
    commit(r.x + (r.w - w) / 2, r.y + (r.h - w / ratio) / 2, w, true);
  };
  paint();
  if (selection.dataset.cropReady) return paint;
  selection.dataset.cropReady = '1';
  let drag = null;
  selection.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    selection.focus();
    selection.setPointerCapture(e.pointerId);
    drag = {id: e.pointerId, x: e.clientX, y: e.clientY, start: box(), corner: e.target.dataset?.corner};
    selection.classList.add('dragging');
  });
  selection.addEventListener('pointermove', (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const rect = surface.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dx = ((e.clientX - drag.x) * width) / rect.width,
      dy = ((e.clientY - drag.y) * height) / rect.height,
      r = drag.start;
    if (!drag.corner) return commit(r.x + dx, r.y + dy, r.w, false);
    // Resize from the grabbed corner while the opposite corner stays put.
    const sx = drag.corner.includes('e') ? 1 : -1,
      sy = drag.corner.includes('s') ? 1 : -1,
      maxW = Math.min(r.baseW, sx > 0 ? width - r.x : r.x + r.w, (sy > 0 ? height - r.y : r.y + r.h) * ratio),
      w = clamp(r.w + (sx * dx + sy * dy * ratio) / 2, r.baseW / 3, Math.max(r.baseW / 3, maxW));
    commit(sx > 0 ? r.x : r.x + r.w - w, sy > 0 ? r.y : r.y + r.h - w / ratio, w, false);
  });
  const finish = (e) => {
    if (drag?.id !== e.pointerId) return;
    drag = null;
    selection.classList.remove('dragging');
    set(get(), true);
  };
  selection.addEventListener('pointerup', finish);
  selection.addEventListener('pointercancel', finish);
  selection.addEventListener('lostpointercapture', finish);
  selection.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoomBy(Math.exp(-e.deltaY * 0.002));
    },
    {passive: false},
  );
  selection.addEventListener('keydown', (e) => {
    const keys = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};
    if (keys[e.key]) {
      e.preventDefault();
      const r = box(),
        step = e.shiftKey ? 0.1 : 0.02;
      commit(r.x + keys[e.key][0] * width * step, r.y + keys[e.key][1] * height * step, r.w, true);
    } else if (['+', '=', '-'].includes(e.key)) {
      e.preventDefault();
      zoomBy(e.key === '-' ? 1 / 1.15 : 1.15);
    }
  });
  return paint;
}
function cropStage(id, source, label) {
  return `<div class="profile-crop-stage"><div class="profile-crop-source-wrap">${source}<div id="${id}" class="crop-selection" tabindex="0" role="group" aria-label="${label}. Drag to move, drag any corner to resize, or use arrow keys and plus or minus.">${CROP_HANDLES}</div></div><small>Drag to move · drag any corner to resize · scroll to zoom</small></div>`;
}
export {cropBox};
export function createAppearance(ctx) {
  const {esc, fmt, button: btn} = ctx;
  let prefs = readAppearance(),
    upload = null,
    uploadUrl = '',
    tab = 'frames',
    preview = 'classic',
    filter = 'all',
    loading = false,
    busy = false,
    error = '',
    status = '',
    restorePromise,
    cropFile = null,
    cropBitmap = null,
    crop = {x: 50, y: 50, zoom: 1},
    cropBlocked = false;
  function clearCrop() {
    cropBitmap?.close();
    cropBitmap = null;
    cropFile = null;
    crop = {x: 50, y: 50, zoom: 1};
    cropBlocked = false;
  }
  function renderCrop() {
    const preview = ctx.app.querySelector('#profile-crop-preview'),
      source = ctx.app.querySelector('#profile-crop-source'),
      selection = ctx.app.querySelector('#profile-crop-selection');
    if (!preview || !source || !selection || !cropBitmap) return;
    drawProfileCrop(preview, cropBitmap, crop, shared);
    const zoomLabel = ctx.app.querySelector('#profile-crop-zoom-label');
    if (zoomLabel) zoomLabel.textContent = Math.round(crop.zoom * 100) + '%';
    const zoomOut = ctx.app.querySelector('[data-action="appearance:crop-zoom-out"]'),
      zoomIn = ctx.app.querySelector('[data-action="appearance:crop-zoom-in"]');
    if (zoomOut) zoomOut.disabled = crop.zoom <= 1.00001;
    if (zoomIn) zoomIn.disabled = crop.zoom >= 2.99999;
    if (!source.dataset.cropReady) {
      source.dataset.cropReady = '1';
      const scale = Math.min(1, 1200 / Math.max(cropBitmap.width, cropBitmap.height));
      source.width = Math.max(1, Math.round(cropBitmap.width * scale));
      source.height = Math.max(1, Math.round(cropBitmap.height * scale));
      source.getContext('2d').drawImage(cropBitmap, 0, 0, source.width, source.height);
    }
    attachCropBox({
      surface: source,
      selection,
      width: cropBitmap.width,
      height: cropBitmap.height,
      ratio: 1,
      get: () => crop,
      set: (next) => {
        crop = next;
        renderCrop();
      },
    });
  }
  /** Profile card and page background editors share one uploaded image; only the box ratio differs. */
  function renderBackdropCrops() {
    if (!upload) return;
    const editors = [
      {
        id: '#backdrop-crop-selection',
        ratio: () => {
          const box = ctx.app.querySelector('.profile-showcase')?.getBoundingClientRect();
          return box?.width && box?.height ? box.width / box.height : 0.72;
        },
        keys: ['profileX', 'profileY', 'profileZoom'],
      },
      {
        id: '#page-crop-selection',
        ratio: () => (innerWidth && innerHeight ? innerWidth / innerHeight : 16 / 9),
        keys: ['bgX', 'bgY', 'bgZoom'],
      },
    ];
    for (const editor of editors) {
      const selection = ctx.app.querySelector(editor.id),
        surface = selection?.previousElementSibling;
      if (!selection || !surface) continue;
      const [kx, ky, kz] = editor.keys,
        paint = attachCropBox({
          surface,
          selection,
          width: upload.width,
          height: upload.height,
          ratio: editor.ratio(),
          get: () => ({x: prefs[kx], y: prefs[ky], zoom: prefs[kz]}),
          set: (s, final) => {
            const patch = {[kx]: s.x, [ky]: s.y, [kz]: s.zoom};
            if (final) setPreferences(patch);
            else {
              prefs = {...prefs, ...patch};
              apply();
            }
          },
        });
      if (surface.complete === false) surface.addEventListener('load', paint, {once: true});
    }
  }
  function apply() {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.dataset.background = prefs.background === 'custom' && !uploadUrl ? 'none' : prefs.background;
    root.dataset.backgroundInGame = String(prefs.inGame);
    root.style.setProperty('--background-dim', String(prefs.dim / 100));
    // Fit only applies to an uploaded image; the built-in backdrops are full-screen gradients.
    const fitted = prefs.background === 'custom';
    root.style.setProperty('--background-position', fitted ? `${prefs.bgX}% ${prefs.bgY}%` : '50% 50%');
    root.style.setProperty('--background-zoom', String(fitted ? prefs.bgZoom : 1));
    root.style.setProperty('--profile-bg-x', prefs.profileX + '%');
    root.style.setProperty('--profile-bg-y', prefs.profileY + '%');
    root.style.setProperty('--profile-bg-zoom', String(prefs.profileZoom));
    if (uploadUrl) root.style.setProperty('--custom-background', `url("${uploadUrl}")`);
    else root.style.removeProperty('--custom-background');
    const theme = THEMES.find((t) => t.id === prefs.theme);
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', theme.colors[0]);
  }
  let syncTimer;
  function store(next, savedAt) {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({...next, savedAt}));
    } catch {
      throw new Error(
        'This browser could not save your appearance. Check available storage or browser privacy settings.',
      );
    }
    prefs = next;
    apply();
  }
  function setPreferences(patch) {
    const next = normalizeAppearance({...prefs, ...patch});
    store(next, Date.now());
    if (shared && ctx.user()) {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(
        () =>
          ctx
            .api('/api/appearance', next)
            .then((r) => {
              if (r?.appearance?.savedAt) store(prefs, r.appearance.savedAt);
            })
            .catch(() => {}),
        600,
      );
    }
  }
  /** First sign-in after this feature: copy this browser's look to the account. */
  function pushLocal() {
    if (!shared || !ctx.user() || JSON.stringify(prefs) === JSON.stringify(DEFAULT_APPEARANCE)) return;
    ctx
      .api('/api/appearance', prefs)
      .then((r) => {
        if (r?.appearance?.savedAt) store(prefs, r.appearance.savedAt);
      })
      .catch(() => {});
  }
  /** Applies the theme saved with the account when it is newer than this browser's copy. */
  function adoptRemote(remote, silent = false) {
    if (!remote || Number(remote.savedAt) <= readSavedAt()) return;
    const next = normalizeAppearance(remote);
    if (next.background === 'custom' && !uploadUrl && !upload && !(shared && next.bgImageAt))
      next.background = prefs.background === 'custom' ? 'none' : prefs.background;
    store(next, Number(remote.savedAt));
    if (!silent) refreshPage();
  }
  // Local changes (tabs, previews, filters, crops) only redraw the Appearance content; anything that
  // touches the account (picture, wallet, equipped items) also refreshes the header, so it re-renders fully.
  let shellDirty = false;
  const markShell = () => (shellDirty = true);
  const setUserPatch = (patch) => (markShell(), ctx.setUserPatch(patch));
  const setRewards = (value) => (markShell(), ctx.setRewards(value));
  function refreshPage() {
    if (ctx.getView() === 'account') {
      shellDirty = false;
      ctx.render();
      return;
    }
    if (ctx.getView() !== 'appearance') return;
    const main = ctx.app.querySelector('#main');
    if (shellDirty || !main?.querySelector('.appearance-layout')) {
      shellDirty = false;
      ctx.render();
      return;
    }
    main.innerHTML = view();
  }
  // Uploaded backgrounds follow the account: push a local image the account lacks, pull a newer one.
  let bgSync = null,
    bgSyncFailedAt = 0;
  function syncBackground() {
    if (!shared || !ctx.user() || bgSync || Date.now() - bgSyncFailedAt < 60000) return;
    const local = upload?.remoteAt || 0,
      push = upload?.blob && !upload.remoteAt && prefs.background === 'custom',
      pull = prefs.bgImageAt > local;
    if (!push && !pull) return;
    bgSync = (async () => {
      if (pull) {
        const {background: b} = await ctx.api('/api/appearance/background');
        if (!b?.url) return;
        const [head, base64] = b.url.split(','),
          blob = new Blob([Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))], {
            type: head.slice(5, head.indexOf(';')),
          });
        upload = {blob, name: b.name, width: b.width, height: b.height, remoteAt: b.savedAt};
        await backgroundStore('put', upload);
        if (uploadUrl) URL.revokeObjectURL(uploadUrl);
        uploadUrl = URL.createObjectURL(blob);
        apply();
        refreshPage();
      } else await pushBackground();
    })()
      .catch(() => (bgSyncFailedAt = Date.now()))
      .finally(() => (bgSync = null));
  }
  async function pushBackground() {
    const {background: b} = await ctx.api('/api/appearance/background', await backgroundForAccount(upload));
    upload = {...upload, remoteAt: b.savedAt};
    await backgroundStore('put', upload);
    setPreferences({bgImageAt: b.savedAt});
  }
  function restore() {
    apply();
    return (restorePromise ??= (async () => {
      try {
        upload = await backgroundStore('get');
        if (upload?.blob instanceof Blob) {
          uploadUrl = URL.createObjectURL(upload.blob);
          apply();
        } else if (prefs.background === 'custom') {
          status = 'Your saved background is unavailable. Upload the image again.';
        }
      } catch {
        if (prefs.background === 'custom') status = 'Background storage is unavailable in this browser.';
      }
      refreshPage();
    })());
  }
  function updateContext() {
    document.documentElement.dataset.quizActive = String(['game', 'room'].includes(ctx.getView()));
    if (restorePromise) restorePromise.then(syncBackground);
  }
  const wallet = () => (ctx.user() ? ctx.rewards() : null);
  const owns = (id) => id === 'classic' || id === 'title-rookie' || /-none$/.test(id) || !!wallet()?.owned.includes(id);
  const slots = () => ({...wallet()?.slots, title: wallet()?.slots?.title || 'title-rookie'});
  const itemDef = (id) => {
    const frame = FRAMES.find((f) => f.id === id);
    return frame ? {...frame, type: 'frame'} : cosmeticItem(id);
  };
  const isEquipped = (def) =>
    def.type === 'frame' ? (wallet()?.equipped || 'classic') === def.id : slots()[def.type] === def.id;
  const lookFromSlots = (value) => ({
    title: value.title || null,
    nameStyle: value.name || null,
    banner: value.banner || null,
  });
  function previewLook(def) {
    const look = lookFromSlots(slots());
    if (def && def.type !== 'frame' && def.type !== 'effect')
      look[def.type === 'name' ? 'nameStyle' : def.type] = def.id;
    return look;
  }
  function itemAction(def, compact = true) {
    const size = compact ? 'btn secondary small' : 'btn secondary small';
    // Guests get one sign-in banner per section instead of a button on every card.
    if (!ctx.user()) return compact ? '' : btn('login', 'Sign in to collect', 'btn secondary small');
    if (isEquipped(def))
      return def.type === 'frame' || def.id === 'classic' || def.id === 'title-rookie'
        ? '<span class="equipped-label">✓ Equipped</span>'
        : `<span class="equipped-label">✓ Equipped</span>${btn('appearance:equip:' + def.type + '-none', 'Remove', 'btn ghost small', busy ? 'disabled' : '')}`;
    if (owns(def.id)) return btn('appearance:equip:' + def.id, 'Equip', size, busy ? 'disabled' : '');
    return btn(
      'appearance:buy:' + def.id,
      '◇ ' + fmt(def.price) + ' · Unlock',
      size,
      busy || loading || !wallet() || wallet().balance < def.price ? 'disabled' : '',
    );
  }
  const filterControl = () =>
    `<div class="segmented" role="group" aria-label="Collection filter">${btn('appearance:filter:all', 'All', filter === 'all' ? 'selected' : '')}${btn('appearance:filter:owned', 'My collection', filter === 'owned' ? 'selected' : '')}</div>`;
  function sectionView(id, controls) {
    if (id === 'frames') return framesView(controls);
    if (id === 'picture') return pictureView();
    if (id === 'themes') return themesView();
    if (id === 'backgrounds') return backgroundsView();
    return itemsView(TYPE_BY_TAB[id], controls);
  }
  function guestBanner(what) {
    if (ctx.user()) return '';
    return `<div class="appearance-guest-banner" role="note"><div><strong>Sign in to collect ${esc(what)}</strong><span>Preview everything for free. Earn Loop Shards by finishing the daily quiz, then unlock and equip what you like.</span></div><div class="appearance-guest-actions">${btn('login', 'Sign in', 'btn small')}${btn('register', 'Create account', 'btn ghost small')}</div></div>`;
  }
  function sample(def) {
    const name = esc(ctx.user()?.username || 'Your alias');
    if (def.type === 'title')
      return `<span class="cosmetic-sample"><span class="player-name">${name}</span><small class="player-title">${esc(def.name)}</small></span>`;
    if (def.type === 'name')
      return `<span class="cosmetic-sample"><span class="player-name ${def.id}">${name}</span></span>`;
    if (def.type === 'banner')
      return `<span class="banner-sample has-banner ${def.id}"><span class="player-name">${name}</span></span>`;
    return `<span class="effect-sample">${EFFECT_ICONS[def.id] || '✦'}</span>`;
  }
  function itemsView(type, controls = true) {
    const items = COSMETIC_ITEMS.filter((i) => i.type === type.type && (filter === 'all' || owns(i.id)));
    return `<section class="appearance-section"><div class="appearance-section-head"><div><h2>${esc(type.heading)}</h2><p>${esc(type.text)}</p></div>${controls ? filterControl() : ''}</div>${controls ? guestBanner(type.label.toLowerCase()) : ''}${items.length ? `<div class="frame-collection cosmetic-collection">${items.map((i) => `<article class="frame-item ${preview === i.id ? 'is-previewed' : ''}"><button type="button" class="frame-visual" data-action="appearance:preview:${i.id}" aria-label="${type.type === 'effect' ? 'Play' : 'Preview'} ${esc(i.name)}" aria-pressed="${preview === i.id}">${sample(i)}<span class="frame-state">${isEquipped(i) ? 'Equipped' : owns(i.id) ? 'Owned' : '◇ ' + fmt(i.price)}</span></button><div class="frame-item-copy"><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><div class="frame-item-actions">${btn('appearance:preview:' + i.id, type.type === 'effect' ? 'Play' : 'Preview', 'btn ghost small')}${itemAction(i)}</div></div></article>`).join('')}</div>` : '<p class="subtle">Nothing here yet. Switch to “All” to browse the collection.</p>'}<p class="appearance-help">${ctx.user() ? 'Shards are earned in-game. Cosmetics never change scores, hints, or quiz difficulty.' : 'Cosmetics never change scores, hints, or quiz difficulty.'}</p></section>`;
  }
  const equipped = () => wallet()?.equipped || 'classic';
  const avatar = (frame, classes = '') =>
    `<span class="profile-avatar appearance-avatar frame-${esc(frame)} ${classes}">${ctx.avatarImage?.() || esc(ctx.user()?.username.slice(0, 2).toUpperCase() || 'AL')}</span>`;
  function pictureView() {
    if (cropBitmap) queueMicrotask(renderCrop);
    return `<section class="appearance-section"><h2>Your profile picture.</h2><p>${shared ? 'Choose a picture for your account. After an automatic safety check it is shown next to your username to your friends and on the leaderboard.' : 'Choose a personal image for your account. It is visible only to you, never on leaderboards or other players’ screens.'}</p><div class="profile-picture-editor">${avatar(equipped())}<div><label class="btn secondary small ${busy || !ctx.user() ? 'is-disabled' : ''}" for="appearance-profile-file">${ctx.user()?.hasPicture ? 'Change picture' : 'Upload picture'}</label><input id="appearance-profile-file" class="file-hidden" type="file" accept="image/png,image/jpeg,image/webp" ${busy || !ctx.user() ? 'disabled' : ''}><p class="subtle">PNG, JPEG or WebP · Up to 8 MB. Cropped to a square and saved with your account.</p>${ctx.user()?.hasPicture ? btn('appearance:remove-picture', 'Remove picture', 'btn ghost small', busy ? 'disabled' : '') : ''}${!ctx.user() ? btn('login', 'Sign in to add a picture', 'btn secondary') : ''}</div></div>${cropFile ? `<div class="profile-crop-editor"><h3>Position your picture</h3><p class="subtle">Drag the box to move it and drag any corner to resize. Your current picture stays unchanged until you save.</p>${cropStage('profile-crop-selection', '<canvas id="profile-crop-source" aria-label="Original image"></canvas>', 'Profile picture crop')}<div class="profile-crop-controls"><span class="profile-crop-caption">Final preview</span><canvas id="profile-crop-preview" width="256" height="256" aria-label="Profile picture preview"></canvas><div class="profile-crop-zoom">${btn('appearance:crop-zoom-out', '−', 'btn ghost small', 'aria-label="Zoom out"')}<span id="profile-crop-zoom-label">${Math.round(crop.zoom * 100)}%</span>${btn('appearance:crop-zoom-in', '+', 'btn ghost small', 'aria-label="Zoom in"')}</div><p class="subtle">Drag a corner, scroll or use + to zoom in. At 100%, the box is as large as the image allows.</p><div class="profile-crop-actions">${btn('appearance:save-crop', 'Save picture', 'btn', busy ? 'disabled' : '')}${cropBlocked ? btn('appearance:review-crop', 'Request manual review', 'btn secondary', busy ? 'disabled' : '') : ''}${btn('appearance:cancel-crop', 'Cancel', 'btn ghost', busy ? 'disabled' : '')}</div></div></div>` : ''}${shared && ctx.user()?.hasPicture ? `<div class="picture-status ${ctx.user().pictureStatus === 'approved' ? 'ok' : ''}" role="status"><p>${PICTURE_STATUS[ctx.user().pictureStatus] || PICTURE_STATUS.private}${ctx.user().pictureStatus !== 'approved' && PICTURE_CHECK[ctx.user().pictureCheck] ? ' ' + PICTURE_CHECK[ctx.user().pictureCheck] : ''}</p>${ctx.user().pictureStatus === 'approved' ? '' : btn('appearance:share-picture', ctx.user().pictureStatus === 'pending' ? 'Check again' : 'Share with friends', 'btn secondary small', busy ? 'disabled' : '')}</div>` : ''}<p class="subtle">${shared ? 'Images are resized and metadata is removed. Every upload is checked for nudity, sexual content, graphic violence and self-harm; flagged pictures can be submitted privately for manual review. If the automatic check is unavailable, the picture stays visible only to you until it has been reviewed.' : 'Images are resized and metadata is removed. Their content is not automatically moderated; keeping them private prevents unwanted images appearing to other players.'}</p></section>`;
  }
  function framesView(controls = true) {
    const items = FRAMES.filter((f) => filter === 'all' || owns(f.id));
    return `<section class="appearance-section"><div class="appearance-section-head"><div><h2>Find your signature frame.</h2><p>Earn Loop Shards through daily play. Preview a frame before you choose it.</p></div>${controls ? filterControl() : ''}</div>${controls ? guestBanner('profile frames') : ''}<div class="frame-collection">${items.map((f) => `<article class="frame-item ${preview === f.id ? 'is-previewed' : ''}" data-frame-id="${f.id}"><button type="button" class="frame-visual" data-action="appearance:preview:${f.id}" aria-label="Preview ${esc(f.name)}" aria-pressed="${preview === f.id}">${avatar(f.id)}<span class="frame-state">${equipped() === f.id ? 'Equipped' : owns(f.id) ? 'Owned' : '◇ ' + fmt(f.price)}</span></button><div class="frame-item-copy"><h3>${esc(f.name)}</h3><p>${esc(f.description)}</p><div class="frame-item-actions">${btn('appearance:preview:' + f.id, 'Preview', 'btn ghost small')}${!ctx.user() ? '' : equipped() === f.id ? '<span class="equipped-label">✓ Equipped</span>' : owns(f.id) ? btn('appearance:equip:' + f.id, 'Equip', 'btn secondary small', busy ? 'disabled' : '') : btn('appearance:buy:' + f.id, '◇ ' + fmt(f.price) + ' · Unlock', 'btn secondary small', busy || loading || !wallet() || wallet().balance < f.price ? 'disabled' : '')}</div></div></article>`).join('')}</div><p class="appearance-help">${ctx.user() ? 'Shards are earned in-game. Cosmetics never change scores, hints, or quiz difficulty.' : 'Themes and backgrounds work without an account.'}</p></section>`;
  }
  function themesView() {
    return `<section class="appearance-section"><div class="appearance-section-head"><div><h2>A different mood. The same loop.</h2><p>Choose an accent palette. Every theme keeps the dark, quiet canvas.</p></div><span class="appearance-free">Free for everyone</span></div><div class="theme-collection">${THEMES.map((t) => `<button type="button" class="theme-option ${prefs.theme === t.id ? 'is-selected' : ''}" data-action="appearance:theme:${t.id}" aria-pressed="${prefs.theme === t.id}" style="--swatch-canvas:${t.colors[0]};--swatch-panel:${t.colors[1]};--swatch-accent:${t.colors[2]}"><span class="theme-mini"><i></i><span><b></b><b></b><b></b></span><em></em></span><span class="theme-option-copy"><strong>${t.name}</strong><small>${t.description}</small><span>${prefs.theme === t.id ? '✓ Active theme' : 'Apply theme'}</span></span></button>`).join('')}</div><p class="appearance-help">${shared ? 'Your theme is saved with your account and follows you to every device.' : 'Your theme is saved in this browser.'} It does not change your friends’ screens.</p></section>`;
  }
  function backgroundsView() {
    const custom = upload && uploadUrl && prefs.background === 'custom';
    if (custom) queueMicrotask(renderBackdropCrops);
    const dimStyle = `--fill:${((prefs.dim - 35) / 55) * 100}%`;
    const fit = custom
      ? `<div class="background-fit"><div class="background-fit-head"><div><h3>Fit your image</h3><p>Drag a box to choose what shows. Drag any corner to zoom.</p></div>${btn('appearance:fit-reset', 'Reset both', 'btn ghost small')}</div><div class="background-fit-editors"><div><span class="background-fit-label">Page background</span>${cropStage('page-crop-selection', `<img src="${esc(uploadUrl)}" alt="Your uploaded background" draggable="false">`, 'Page background area')}</div><div><span class="background-fit-label">Profile card</span>${cropStage('backdrop-crop-selection', `<img src="${esc(uploadUrl)}" alt="" draggable="false">`, 'Profile card background area')}</div></div></div>`
      : '';
    return `<section class="appearance-section"><div class="appearance-section-head"><div><h2>Set the scene.</h2><p>Start with an original backdrop or bring an image of your own.</p></div><span class="appearance-free">${shared ? 'Saved with your account' : 'Saved on this device'}</span></div><div class="background-collection">${BACKGROUNDS.map((b) => `<button type="button" class="background-option ${prefs.background === b.id ? 'is-selected' : ''}" data-action="appearance:background:${b.id}" aria-pressed="${prefs.background === b.id}"><span class="background-sample backdrop-${b.id}"></span><strong>${b.name}</strong><small>${prefs.background === b.id ? '✓ Selected' : b.description}</small></button>`).join('')}${upload ? `<button type="button" class="background-option ${prefs.background === 'custom' ? 'is-selected' : ''}" data-action="appearance:background:custom" aria-pressed="${prefs.background === 'custom'}"><span class="background-sample backdrop-custom"></span><strong>Your image</strong><small>${esc(upload.name)}</small></button>` : ''}</div><div class="background-upload"><div><h3>Your image, your space.</h3><p>PNG, JPEG, or WebP, up to 8 MB. Images are resized for faster loading${shared ? ' and saved privately with your account, so they follow you to other devices. Only you can see them.' : ' and stay in this browser.'}</p></div><label class="btn secondary ${busy ? 'is-disabled' : ''}" for="appearance-background-file">${busy ? 'Preparing image…' : upload ? 'Replace image' : 'Upload image'}</label><input type="file" id="appearance-background-file" accept="image/png,image/jpeg,image/webp" ${busy ? 'disabled' : ''}>${upload ? btn('appearance:remove-upload', 'Remove upload', 'btn ghost small', busy ? 'disabled' : '') : ''}</div><div class="background-settings"><div class="background-dim-field"><label for="appearance-dim">Dim background <output id="appearance-dim-value">${prefs.dim}%</output></label><input id="appearance-dim" class="range" type="range" min="35" max="90" step="5" value="${prefs.dim}" style="${dimStyle}"><p>Keep the page readable while letting your background show through.</p></div></div>${fit}</section>`;
  }
  function view() {
    const selected = itemDef(preview) || {...FRAMES[0], type: 'frame'},
      look = previewLook(selected);
    return `<section class="appearance-heading"><div><span class="mode-label">Shop</span><h1>Make the loop yours.</h1><p>Spend Loop Shards on frames, titles, name colours, banners and effects. Your friends see them next to your name.</p></div>${btn('rewards', 'Daily rewards', 'btn ghost small')}</section><div class="appearance-layout"><aside class="appearance-showcase"><div class="profile-showcase${bannerClass(look)}"><span class="showcase-caption">Your profile preview</span><div class="profile-showcase-avatar">${avatar(selected.type === 'frame' ? selected.id : equipped(), 'large')}</div><h2 class="showcase-name">${nameMarkup(ctx.user()?.username || 'Your anime alias', look, esc)}</h2><p>Your next great guess starts here.</p><span class="showcase-frame-name">${esc(selected.name)}</span><div class="showcase-action">${itemAction(selected, false)}</div></div><div class="appearance-wallet"><span>Loop Shards</span><strong>${ctx.user() ? (loading && !wallet() ? '…' : '◇ ' + fmt(wallet()?.balance || 0)) : '◇ 0'}</strong><p>${ctx.user() ? 'Finish daily quizzes and claim your rewards to collect new frames.' : 'Create an account to earn shards through daily play.'}</p>${btn(ctx.user() ? 'rewards' : 'register', ctx.user() ? 'Earn more shards' : 'Create account', 'btn ghost small')}</div><p class="appearance-local-note">${shared ? 'Themes, backdrops, cosmetics and your uploaded background are saved with your account.' : 'Themes and uploaded backgrounds are personal to this browser. Owned frames stay with your account.'}</p></aside><div class="appearance-workspace"><div class="appearance-tabs" role="group" aria-label="Shop sections">${TAB_GROUPS.map((g) => btn('appearance:tab:' + g.id, g.label, tab === g.id ? 'selected' : '', 'aria-pressed="' + (tab === g.id) + '"')).join('')}</div>${error ? `<p class="media-error" role="alert">${esc(error)}</p>` : ''}${status ? `<p class="appearance-status" role="status">${esc(status)}</p>` : ''}${tabGroup(
      tab,
    )
      .views.map((id, i) => sectionView(id, i === 0))
      .join(
        '',
      )}${tab === 'themes' ? `<div class="appearance-reset">${btn('appearance:reset', 'Reset theme & background', 'btn ghost small')}<span>Returns to Midnight mauve and Pure black. Your frame collection and uploaded image stay saved.</span></div>` : ''}</div></div>`;
  }
  async function action(name) {
    if (name === 'appearance:fit-reset') {
      setPreferences({bgZoom: 1, bgX: 50, bgY: 50, profileX: 50, profileY: 50, profileZoom: 1});
      refreshPage();
      return true;
    }
    if (name === 'appearance') {
      preview = equipped();
      ctx.go('appearance');
      await restore();
      if (ctx.user()) {
        loading = true;
        refreshPage();
        try {
          await ctx.refreshRewards();
        } catch (cause) {
          error = cause.message;
        } finally {
          loading = false;
          preview = equipped();
          markShell();
          refreshPage();
        }
      }
      return true;
    }
    if (!name.startsWith('appearance:')) return false;
    const [, operation, id] = name.split(':');
    error = '';
    status = '';
    try {
      if (operation === 'review-crop') {
        if (!cropFile || busy) return true;
        busy = true;
        refreshPage();
        try {
          const image = await prepareProfilePicture(cropFile, {shared, crop});
          await ctx.api('/api/account/picture', {image, manualReview: true});
          clearCrop();
          status =
            'Your picture was sent for manual review. Your current profile picture is unchanged until an administrator approves it.';
        } finally {
          busy = false;
        }
        refreshPage();
        return true;
      }
      if (operation === 'crop-zoom-in' || operation === 'crop-zoom-out') {
        crop.zoom = Math.max(1, Math.min(3, crop.zoom * (operation === 'crop-zoom-in' ? 1.15 : 1 / 1.15)));
        renderCrop();
        return true;
      }
      if (operation === 'cancel-crop') {
        clearCrop();
        refreshPage();
        return true;
      }
      if (operation === 'save-crop') {
        if (!cropFile || busy) return true;
        busy = true;
        refreshPage();
        try {
          const image = await prepareProfilePicture(cropFile, {shared, crop}),
            result = await ctx.api('/api/account/picture', {image});
          setUserPatch({
            hasPicture: true,
            pictureUrl: result.pictureUrl,
            pictureStatus: result.pictureStatus || null,
            pictureCheck: result.pictureCheck || null,
            pictureVersion: Date.now(),
          });
          clearCrop();
          status = !shared
            ? 'Profile picture saved to your account. Only you can see it.'
            : result.pictureStatus === 'approved'
              ? 'Profile picture saved. Your friends can see it now.'
              : 'Profile picture saved. Only you can see it until it has been reviewed.';
        } catch (cause) {
          if (shared && /blocked by the safety filter/i.test(cause.message)) cropBlocked = true;
          throw cause;
        } finally {
          busy = false;
        }
        refreshPage();
        return true;
      }
      if (operation === 'tab') {
        // Picture and background editing live on the account page.
        if (['picture', 'backgrounds'].includes(id) && ctx.user()) {
          ctx.go('account');
          return true;
        }
        tab = tabGroup(id).id;
        // Each shop section is its own page (#shop/<tab>), so Back/Forward and links work.
        ctx.go('appearance');
        return true;
      }
      if (operation === 'preview') {
        const def = itemDef(id);
        if (def) {
          preview = id;
          if (def.type === 'effect') celebrate(id);
        }
        refreshPage();
        return true;
      }
      if (operation === 'filter') {
        filter = id === 'owned' ? 'owned' : 'all';
        refreshPage();
        return true;
      }
      if (operation === 'share-picture') {
        if (busy) return true;
        busy = true;
        refreshPage();
        try {
          const result = await ctx.api('/api/account/picture', {share: true});
          setUserPatch({
            hasPicture: result.hasPicture,
            pictureUrl: result.pictureUrl,
            pictureStatus: result.pictureStatus || null,
            pictureCheck: result.pictureCheck || null,
            pictureVersion: Date.now(),
          });
          status =
            result.pictureStatus === 'approved'
              ? 'Your picture passed the safety check. Your friends can see it now.'
              : 'The picture is still waiting for review.';
        } catch (cause) {
          if (/blocked/i.test(cause.message))
            setUserPatch({
              hasPicture: false,
              pictureUrl: null,
              pictureStatus: null,
              pictureCheck: null,
              pictureVersion: Date.now(),
            });
          throw cause;
        } finally {
          busy = false;
        }
      } else if (operation === 'remove-picture') {
        if (busy) return true;
        busy = true;
        refreshPage();
        try {
          await ctx.api('/api/account/picture', {image: null});
          setUserPatch({hasPicture: false, pictureUrl: null, pictureStatus: null, pictureVersion: Date.now()});
          status = 'Profile picture removed.';
        } finally {
          busy = false;
        }
      } else if (operation === 'theme') {
        setPreferences({theme: id});
        status = 'Theme saved.';
      } else if (operation === 'background') {
        if (id === 'custom' && !upload) throw new Error('Upload an image first.');
        setPreferences({background: id});
        status = 'Background saved.';
      } else if (operation === 'reset') {
        setPreferences(DEFAULT_APPEARANCE);
        status = 'Default theme and background restored.';
      } else if (operation === 'remove-upload') {
        if (busy) return true;
        await backgroundStore('delete');
        if (uploadUrl) URL.revokeObjectURL(uploadUrl);
        uploadUrl = '';
        upload = null;
        const synced = shared && ctx.user() && prefs.bgImageAt;
        setPreferences({background: prefs.background === 'custom' ? 'none' : prefs.background, bgImageAt: 0});
        if (synced) await ctx.api('/api/appearance/background', {image: null});
        status = synced
          ? 'Uploaded background removed from your account.'
          : 'Uploaded background removed from this browser.';
      } else if (['buy', 'equip'].includes(operation)) {
        if (!ctx.user()) {
          ctx.login();
          return true;
        }
        if (busy) return true;
        busy = true;
        refreshPage();
        try {
          const result = await ctx.api('/api/rewards/' + operation, {item: id});
          setRewards(result.rewards);
          const def = itemDef(id);
          if (!/-none$/.test(id)) preview = id;
          status = /-none$/.test(id)
            ? 'Removed from your profile.'
            : operation === 'buy'
              ? `${def?.name || 'Item'} unlocked and equipped.`
              : `${def?.name || 'Item'} equipped.`;
        } finally {
          busy = false;
        }
      }
      refreshPage();
    } catch (cause) {
      error = cause.message;
      refreshPage();
    }
    return true;
  }
  async function change(target) {
    if (
      ![
        'appearance-profile-file',
        'appearance-background-file',
        'appearance-dim',
        'appearance-position',
        'appearance-in-game',
      ].includes(target.id)
    )
      return false;
    error = '';
    status = '';
    try {
      if (target.id === 'appearance-background-file') {
        const file = target.files?.[0];
        if (!file) return true;
        if (busy) return true;
        busy = true;
        refreshPage();
        try {
          const prepared = await prepareBackground(file);
          await backgroundStore('put', prepared);
          setPreferences({background: 'custom'});
          if (uploadUrl) URL.revokeObjectURL(uploadUrl);
          upload = prepared;
          uploadUrl = URL.createObjectURL(upload.blob);
          apply();
          status = 'Your background is saved on this device.';
          if (shared && ctx.user()) {
            try {
              await pushBackground();
              status = 'Your background is saved with your account.';
            } catch (cause) {
              status = `Saved on this device. ${cause.message}`;
            }
          }
        } finally {
          busy = false;
        }
      } else if (target.id === 'appearance-profile-file') {
        const file = target.files?.[0];
        if (!file) return true;
        if (!ctx.user()) throw new Error('Sign in to add a profile picture.');
        if (busy) return true;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
          throw new Error('Choose a PNG, JPEG, or WebP image.');
        if (file.size > 8 * 1024 * 1024) throw new Error('Choose an image smaller than 8 MB.');
        busy = true;
        refreshPage();
        try {
          let bitmap;
          try {
            bitmap = await createImageBitmap(file);
          } catch {
            throw new Error('This image could not be opened.');
          }
          if (bitmap.width * bitmap.height > 24000000) {
            bitmap.close();
            throw new Error('Choose an image with fewer than 24 million pixels.');
          }
          clearCrop();
          cropFile = file;
          cropBitmap = bitmap;
        } finally {
          busy = false;
        }
      } else if (target.id === 'appearance-dim') {
        // The slider already shows its value; saving needs no redraw.
        setPreferences({dim: Number(target.value)});
        return true;
      } else if (target.id === 'appearance-position') setPreferences({position: target.value});
      else setPreferences({inGame: target.checked});
      refreshPage();
    } catch (cause) {
      error = cause.message;
      refreshPage();
    }
    return true;
  }
  function input(target) {
    if (target.id !== 'appearance-dim') return;
    const dim = Math.max(35, Math.min(90, Number(target.value)));
    document.documentElement.style.setProperty('--background-dim', String(dim / 100));
    target.style.setProperty('--fill', ((dim - 35) / 55) * 100 + '%');
    const output = document.querySelector('#appearance-dim-value');
    if (output) output.value = dim + '%';
  }
  function rewardsTeaser() {
    return `<section class="appearance-teaser"><div class="teaser-frames">${['neon', 'aurora', 'galaxy'].map((id) => avatar(id)).join('')}</div><div><h2>Give your profile a signature.</h2><p>Frames, titles, name colours and themes are waiting in the shop.</p></div>${btn('appearance', 'Open the shop', 'btn secondary')}</section>`;
  }
  /** Profile picture and background editors, shown first on the account page. */
  function accountSections() {
    return pictureView() + backgroundsView();
  }
  return {
    tab: () => tab,
    setTab: (id) => (tab = tabGroup(id).id),
    view,
    accountSections,
    action,
    change,
    input,
    restore,
    updateContext,
    rewardsTeaser,
    adoptRemote,
    pushLocal,
  };
}
