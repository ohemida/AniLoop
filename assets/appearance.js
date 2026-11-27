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
const TABS = ['frames', ...COSMETIC_TYPES.map((t) => t.tab), 'picture', 'themes', 'backgrounds'];
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
    const rect = profileCrop(cropBitmap.width, cropBitmap.height, crop);
    Object.assign(selection.style, {
      left: (rect.x / cropBitmap.width) * 100 + '%',
      top: (rect.y / cropBitmap.height) * 100 + '%',
      width: (rect.side / cropBitmap.width) * 100 + '%',
      height: (rect.side / cropBitmap.height) * 100 + '%',
    });
    const zoomLabel = ctx.app.querySelector('#profile-crop-zoom-label');
    if (zoomLabel) zoomLabel.textContent = Math.round(crop.zoom * 100) + '%';
    const zoomOut = ctx.app.querySelector('[data-action="appearance:crop-zoom-out"]'),
      zoomIn = ctx.app.querySelector('[data-action="appearance:crop-zoom-in"]');
    if (zoomOut) zoomOut.disabled = crop.zoom <= 1.00001;
    if (zoomIn) zoomIn.disabled = crop.zoom >= 2.99999;
    if (source.dataset.cropReady) return;
    source.dataset.cropReady = '1';
    const scale = Math.min(1, 1200 / Math.max(cropBitmap.width, cropBitmap.height));
    source.width = Math.max(1, Math.round(cropBitmap.width * scale));
    source.height = Math.max(1, Math.round(cropBitmap.height * scale));
    source.getContext('2d').drawImage(cropBitmap, 0, 0, source.width, source.height);
    let drag = null;
    const fromRect = (x, y, side) => {
      const w = cropBitmap.width,
        h = cropBitmap.height;
      side = Math.max(Math.min(w, h) / 3, Math.min(Math.min(w, h), side));
      x = Math.max(0, Math.min(w - side, x));
      y = Math.max(0, Math.min(h - side, y));
      return {
        zoom: Math.min(w, h) / side,
        x: w === side ? 50 : (x / (w - side)) * 100,
        y: h === side ? 50 : (y / (h - side)) * 100,
      };
    };
    selection.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      selection.focus();
      selection.setPointerCapture(event.pointerId);
      drag = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        start: profileCrop(cropBitmap.width, cropBitmap.height, crop),
        resize: !!event.target.closest('.profile-crop-handle'),
      };
      selection.classList.add('dragging');
    });
    selection.addEventListener('pointermove', (event) => {
      if (!drag || drag.id !== event.pointerId || !cropBitmap) return;
      const bounds = source.getBoundingClientRect(),
        dx = ((event.clientX - drag.x) * cropBitmap.width) / bounds.width,
        dy = ((event.clientY - drag.y) * cropBitmap.height) / bounds.height,
        {x, y, side} = drag.start;
      if (drag.resize) {
        const limit = Math.min(cropBitmap.width - x, cropBitmap.height - y);
        crop = fromRect(x, y, Math.min(limit, side + (dx + dy) / 2));
      } else crop = fromRect(x + dx, y + dy, side);
      renderCrop();
    });
    const finish = (event) => {
      if (drag?.id === event.pointerId) drag = null;
      selection.classList.remove('dragging');
    };
    selection.addEventListener('pointerup', finish);
    selection.addEventListener('pointercancel', finish);
    selection.addEventListener('lostpointercapture', finish);
    selection.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        crop.zoom = Math.max(1, Math.min(3, crop.zoom * Math.exp(-event.deltaY * 0.002)));
        renderCrop();
      },
      {passive: false},
    );
    selection.addEventListener('keydown', (event) => {
      const keys = {ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10]};
      if (keys[event.key]) {
        event.preventDefault();
        const [dx, dy] = keys[event.key],
          bounds = source.getBoundingClientRect(),
          r = profileCrop(cropBitmap.width, cropBitmap.height, crop);
        crop = fromRect(
          r.x + (dx * cropBitmap.width) / bounds.width,
          r.y + (dy * cropBitmap.height) / bounds.height,
          r.side,
        );
        renderCrop();
      }
    });
  }

  function renderBackdropCrop() {
    const image = ctx.app.querySelector('#backdrop-crop-source'),
      selection = ctx.app.querySelector('#backdrop-crop-selection');
    if (!image || !selection || !upload) return;
    const width = upload.width,
      height = upload.height,
      card = ctx.app.querySelector('.profile-showcase'),
      box = card?.getBoundingClientRect(),
      ratio = box?.width && box?.height ? box.width / box.height : 0.72;
    const bounds = () => {
      const baseW = Math.min(width, height * ratio),
        baseH = baseW / ratio,
        w = baseW / prefs.profileZoom,
        h = baseH / prefs.profileZoom;
      return {w, h, x: ((width - w) * prefs.profileX) / 100, y: ((height - h) * prefs.profileY) / 100, baseW};
    };
    const paint = () => {
      const r = bounds();
      Object.assign(selection.style, {
        left: (r.x / width) * 100 + '%',
        top: (r.y / height) * 100 + '%',
        width: (r.w / width) * 100 + '%',
        height: (r.h / height) * 100 + '%',
      });
      apply();
    };
    paint();
    if (selection.dataset.cropReady) return;
    selection.dataset.cropReady = '1';
    let drag = null;
    selection.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      selection.focus();
      selection.setPointerCapture(e.pointerId);
      drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        start: bounds(),
        resize: !!e.target.closest('.profile-crop-handle'),
      };
      selection.classList.add('dragging');
    });
    selection.addEventListener('pointermove', (e) => {
      if (!drag || drag.id !== e.pointerId) return;
      const rect = image.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dx = ((e.clientX - drag.x) * width) / rect.width,
        dy = ((e.clientY - drag.y) * height) / rect.height,
        r = drag.start;
      let w = r.w,
        h = r.h,
        x = r.x,
        y = r.y;
      if (drag.resize) {
        w = Math.max(r.baseW / 3, Math.min(r.baseW, width - x, (height - y) * ratio, r.w + (dx + dy * ratio) / 2));
        h = w / ratio;
      } else {
        x = Math.max(0, Math.min(width - w, x + dx));
        y = Math.max(0, Math.min(height - h, y + dy));
      }
      prefs = {
        ...prefs,
        profileZoom: r.baseW / w,
        profileX: width === w ? 50 : (x / (width - w)) * 100,
        profileY: height === h ? 50 : (y / (height - h)) * 100,
      };
      paint();
    });
    const finish = (e) => {
      if (drag?.id !== e.pointerId) return;
      drag = null;
      selection.classList.remove('dragging');
      setPreferences({profileX: prefs.profileX, profileY: prefs.profileY, profileZoom: prefs.profileZoom});
    };
    selection.addEventListener('pointerup', finish);
    selection.addEventListener('pointercancel', finish);
    selection.addEventListener('lostpointercapture', finish);
    selection.addEventListener('keydown', (e) => {
      const keys = {ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2]};
      if (keys[e.key]) {
        e.preventDefault();
        const [dx, dy] = keys[e.key];
        setPreferences({
          profileX: Math.max(0, Math.min(100, prefs.profileX + dx)),
          profileY: Math.max(0, Math.min(100, prefs.profileY + dy)),
        });
        paint();
      } else if (['+', '=', '-'].includes(e.key)) {
        e.preventDefault();
        setPreferences({profileZoom: Math.max(1, Math.min(3, prefs.profileZoom * (e.key === '-' ? 1 / 1.15 : 1.15)))});
        paint();
      }
    });
    image.addEventListener('load', paint, {once: true});
  }
  function apply() {
    const root = document.documentElement;
    root.dataset.theme = prefs.theme;
    root.dataset.background = prefs.background === 'custom' && !uploadUrl ? 'none' : prefs.background;
    root.dataset.backgroundInGame = String(prefs.inGame);
    root.style.setProperty('--background-dim', String(prefs.dim / 100));
    root.style.setProperty('--background-position', prefs.position);
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
    if (next.background === 'custom' && !uploadUrl && !upload)
      next.background = prefs.background === 'custom' ? 'none' : prefs.background;
    store(next, Number(remote.savedAt));
    if (!silent) refreshPage();
  }
  function refreshPage() {
    if (ctx.getView() === 'appearance') ctx.render();
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
    if (!ctx.user()) return btn('login', 'Sign in', 'btn secondary small');
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
  function itemsView(type) {
    const items = COSMETIC_ITEMS.filter((i) => i.type === type.type && (filter === 'all' || owns(i.id)));
    return `<section class="appearance-section"><div class="appearance-section-head"><div><h2>${esc(type.heading)}</h2><p>${esc(type.text)}</p></div><div class="segmented" role="group" aria-label="Collection filter">${btn('appearance:filter:all', 'All', filter === 'all' ? 'selected' : '')}${btn('appearance:filter:owned', 'My collection', filter === 'owned' ? 'selected' : '')}</div></div>${items.length ? `<div class="frame-collection cosmetic-collection">${items.map((i) => `<article class="frame-item ${preview === i.id ? 'is-previewed' : ''}"><button type="button" class="frame-visual" data-action="appearance:preview:${i.id}" aria-label="${type.type === 'effect' ? 'Play' : 'Preview'} ${esc(i.name)}" aria-pressed="${preview === i.id}">${sample(i)}<span class="frame-state">${isEquipped(i) ? 'Equipped' : owns(i.id) ? 'Owned' : '◇ ' + fmt(i.price)}</span></button><div class="frame-item-copy"><h3>${esc(i.name)}</h3><p>${esc(i.description)}</p><div class="frame-item-actions">${btn('appearance:preview:' + i.id, type.type === 'effect' ? 'Play' : 'Preview', 'btn ghost small')}${itemAction(i)}</div></div></article>`).join('')}</div>` : '<p class="subtle">Nothing here yet. Switch to “All” to browse the collection.</p>'}<p class="appearance-help">${ctx.user() ? 'Shards are earned in-game. Cosmetics never change scores, hints, or quiz difficulty.' : 'Sign in to collect and equip cosmetics.'}</p></section>`;
  }
  const equipped = () => wallet()?.equipped || 'classic';
  const avatar = (frame, classes = '') =>
    `<span class="profile-avatar appearance-avatar frame-${esc(frame)} ${classes}">${ctx.avatarImage?.() || esc(ctx.user()?.username.slice(0, 2).toUpperCase() || 'AL')}</span>`;
  function pictureView() {
    if (cropBitmap) queueMicrotask(renderCrop);
    return `<section class="appearance-section"><h2>Your profile picture.</h2><p>${shared ? 'Choose a picture for your account. After an automatic safety check it is shown next to your username to your friends and on the leaderboard.' : 'Choose a personal image for your account. It is visible only to you, never on leaderboards or other players’ screens.'}</p><div class="profile-picture-editor">${avatar(equipped())}<div><label for="appearance-profile-file">Upload profile picture</label><input id="appearance-profile-file" type="file" accept="image/png,image/jpeg,image/webp" ${busy || !ctx.user() ? 'disabled' : ''}><p class="subtle">PNG, JPEG or WebP · Up to 8 MB. Cropped to a square and saved with your account.</p>${ctx.user()?.hasPicture ? btn('appearance:remove-picture', 'Remove picture', 'btn ghost small', busy ? 'disabled' : '') : ''}${!ctx.user() ? btn('login', 'Sign in to add a picture', 'btn secondary') : ''}</div></div>${cropFile ? `<div class="profile-crop-editor"><h3>Position your picture</h3><p class="subtle">Drag the box to move it and drag its corner to resize. Your current picture stays unchanged until you save.</p><div class="profile-crop-stage"><div class="profile-crop-source-wrap"><canvas id="profile-crop-source" aria-label="Original image"></canvas><div id="profile-crop-selection" tabindex="0" role="group" aria-label="Crop area. Drag to move or use arrow keys."><span class="profile-crop-handle" aria-hidden="true"></span></div></div><small>Drag to move · drag the corner to resize</small></div><div class="profile-crop-controls"><span class="profile-crop-caption">Final preview</span><canvas id="profile-crop-preview" width="256" height="256" aria-label="Profile picture preview"></canvas><div class="profile-crop-zoom">${btn('appearance:crop-zoom-out', '−', 'btn ghost small', 'aria-label="Zoom out"')}<span id="profile-crop-zoom-label">${Math.round(crop.zoom * 100)}%</span>${btn('appearance:crop-zoom-in', '+', 'btn ghost small', 'aria-label="Zoom in"')}</div><p class="subtle">Drag the box or use + to zoom in. At 100%, the box is as large as the image allows.</p><div class="profile-crop-actions">${btn('appearance:save-crop', 'Save picture', 'btn', busy ? 'disabled' : '')}${cropBlocked ? btn('appearance:review-crop', 'Request manual review', 'btn secondary', busy ? 'disabled' : '') : ''}${btn('appearance:cancel-crop', 'Cancel', 'btn ghost', busy ? 'disabled' : '')}</div></div></div>` : ''}${shared && ctx.user()?.hasPicture ? `<div class="picture-status ${ctx.user().pictureStatus === 'approved' ? 'ok' : ''}" role="status"><p>${PICTURE_STATUS[ctx.user().pictureStatus] || PICTURE_STATUS.private}${ctx.user().pictureStatus !== 'approved' && PICTURE_CHECK[ctx.user().pictureCheck] ? ' ' + PICTURE_CHECK[ctx.user().pictureCheck] : ''}</p>${ctx.user().pictureStatus === 'approved' ? '' : btn('appearance:share-picture', ctx.user().pictureStatus === 'pending' ? 'Check again' : 'Share with friends', 'btn secondary small', busy ? 'disabled' : '')}</div>` : ''}<p class="subtle">${shared ? 'Images are resized and metadata is removed. Every upload is checked for nudity, sexual content, graphic violence and self-harm; flagged pictures can be submitted privately for manual review. If the automatic check is unavailable, the picture stays visible only to you until it has been reviewed.' : 'Images are resized and metadata is removed. Their content is not automatically moderated; keeping them private prevents unwanted images appearing to other players.'}</p></section>`;
  }
  function framesView() {
    const items = FRAMES.filter((f) => filter === 'all' || owns(f.id));
    return `<section class="appearance-section"><div class="appearance-section-head"><div><h2>Find your signature frame.</h2><p>Earn Loop Shards through daily play. Preview a frame before you choose it.</p></div><div class="segmented" role="group" aria-label="Frame collection filter">${btn('appearance:filter:all', 'All frames', filter === 'all' ? 'selected' : '')}${btn('appearance:filter:owned', 'My collection', filter === 'owned' ? 'selected' : '')}</div></div><div class="frame-collection">${items.map((f) => `<article class="frame-item ${preview === f.id ? 'is-previewed' : ''}" data-frame-id="${f.id}"><button type="button" class="frame-visual" data-action="appearance:preview:${f.id}" aria-label="Preview ${esc(f.name)}" aria-pressed="${preview === f.id}">${avatar(f.id)}<span class="frame-state">${equipped() === f.id ? 'Equipped' : owns(f.id) ? 'Owned' : '◇ ' + fmt(f.price)}</span></button><div class="frame-item-copy"><h3>${esc(f.name)}</h3><p>${esc(f.description)}</p><div class="frame-item-actions">${btn('appearance:preview:' + f.id, 'Preview', 'btn ghost small')}${!ctx.user() ? btn('login', 'Sign in', 'btn secondary small') : equipped() === f.id ? '<span class="equipped-label">✓ Equipped</span>' : owns(f.id) ? btn('appearance:equip:' + f.id, 'Equip', 'btn secondary small', busy ? 'disabled' : '') : btn('appearance:buy:' + f.id, '◇ ' + fmt(f.price) + ' · Unlock', 'btn secondary small', busy || loading || !wallet() || wallet().balance < f.price ? 'disabled' : '')}</div></div></article>`).join('')}</div><p class="appearance-help">${ctx.user() ? 'Shards are earned in-game. Cosmetics never change scores, hints, or quiz difficulty.' : 'Themes and backgrounds work without an account. Sign in to collect and equip profile frames.'}</p></section>`;
  }
  function themesView() {
    return `<section class="appearance-section"><div class="appearance-section-head"><div><h2>A different mood. The same loop.</h2><p>Choose an accent palette. Every theme keeps the dark, quiet canvas.</p></div><span class="appearance-free">Free for everyone</span></div><div class="theme-collection">${THEMES.map((t) => `<button type="button" class="theme-option ${prefs.theme === t.id ? 'is-selected' : ''}" data-action="appearance:theme:${t.id}" aria-pressed="${prefs.theme === t.id}" style="--swatch-canvas:${t.colors[0]};--swatch-panel:${t.colors[1]};--swatch-accent:${t.colors[2]}"><span class="theme-mini"><i></i><span><b></b><b></b><b></b></span><em></em></span><span class="theme-option-copy"><strong>${t.name}</strong><small>${t.description}</small><span>${prefs.theme === t.id ? '✓ Active theme' : 'Apply theme'}</span></span></button>`).join('')}</div><p class="appearance-help">${shared ? 'Your theme is saved with your account and follows you to every device.' : 'Your theme is saved in this browser.'} It does not change your friends’ screens.</p></section>`;
  }
  function backgroundsView() {
    if (upload && uploadUrl && prefs.background === 'custom') queueMicrotask(renderBackdropCrop);
    return `<section class="appearance-section"><div class="appearance-section-head"><div><h2>Set the scene.</h2><p>Start with an original backdrop or bring an image of your own.</p></div><span class="appearance-free">${shared ? 'Saved with your account' : 'Saved on this device'}</span></div><div class="background-collection">${BACKGROUNDS.map((b) => `<button type="button" class="background-option ${prefs.background === b.id ? 'is-selected' : ''}" data-action="appearance:background:${b.id}" aria-pressed="${prefs.background === b.id}"><span class="background-sample backdrop-${b.id}"></span><strong>${b.name}</strong><small>${prefs.background === b.id ? '✓ Selected' : b.description}</small></button>`).join('')}${upload ? `<button type="button" class="background-option ${prefs.background === 'custom' ? 'is-selected' : ''}" data-action="appearance:background:custom" aria-pressed="${prefs.background === 'custom'}"><span class="background-sample backdrop-custom"></span><strong>Your image</strong><small>${esc(upload.name)}</small></button>` : ''}</div><div class="background-upload"><div><h3>Your image, your space.</h3><p>PNG, JPEG, or WebP, up to 8 MB. Images are resized for faster loading and stay in this browser.</p></div><label class="btn secondary ${busy ? 'is-disabled' : ''}" for="appearance-background-file">${busy ? 'Preparing image…' : upload ? 'Replace image' : 'Upload image'}</label><input type="file" id="appearance-background-file" accept="image/png,image/jpeg,image/webp" ${busy ? 'disabled' : ''}>${upload ? btn('appearance:remove-upload', 'Remove upload', 'btn ghost small', busy ? 'disabled' : '') : ''}</div><div class="background-settings"><div class="background-dim-field"><label for="appearance-dim">Dim background <output id="appearance-dim-value">${prefs.dim}%</output></label><input id="appearance-dim" type="range" min="35" max="90" step="5" value="${prefs.dim}"><p>Keep the page readable while letting your background show through.</p></div><div class="field"><label for="appearance-position">Image position</label><select id="appearance-position">${['top', 'center', 'bottom'].map((v) => `<option value="${v}" ${prefs.position === v ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></div><label class="appearance-check"><input type="checkbox" id="appearance-in-game" ${prefs.inGame ? 'checked' : ''}><span>Show backgrounds during quiz questions<small>Off by default, so the question stays in focus.</small></span></label></div>${upload && uploadUrl && prefs.background === 'custom' ? `<section class="profile-backdrop-editor"><h2>Position your profile background</h2><p class="subtle">Drag the box to move the image on your profile card; drag its corner to zoom. Your page background stays separate.</p><div class="profile-crop-stage"><div class="profile-crop-source-wrap"><img id="backdrop-crop-source" src="${esc(uploadUrl)}" alt="Your uploaded background"><div id="backdrop-crop-selection" tabindex="0" role="group" aria-label="Profile background crop. Drag or use arrow keys to move; drag the corner or use plus and minus to resize."><span class="profile-crop-handle" aria-hidden="true"></span></div></div><small>Drag to move · drag the corner to resize</small></div>${btn('appearance:reset-profile-background', 'Reset profile position', 'btn ghost small')}</section>` : ''}</section>`;
  }
  function view() {
    const selected = itemDef(preview) || {...FRAMES[0], type: 'frame'},
      look = previewLook(selected);
    return `<section class="appearance-heading"><div><h1>Make the loop yours.</h1><p>Frames, titles, name colours, banners and effects. Your friends see them next to your name.</p></div>${btn('rewards', 'Daily rewards', 'btn ghost small')}</section><div class="appearance-layout"><aside class="appearance-showcase"><div class="profile-showcase${bannerClass(look)}"><span class="showcase-caption">Your profile preview</span><div class="profile-showcase-avatar">${avatar(selected.type === 'frame' ? selected.id : equipped(), 'large')}</div><h2 class="showcase-name">${nameMarkup(ctx.user()?.username || 'Your anime alias', look, esc)}</h2><p>Your next great guess starts here.</p><span class="showcase-frame-name">${esc(selected.name)}</span><div class="showcase-action">${itemAction(selected, false)}</div></div><div class="appearance-wallet"><span>Loop Shards</span><strong>${ctx.user() ? (loading && !wallet() ? '…' : '◇ ' + fmt(wallet()?.balance || 0)) : '◇ 0'}</strong><p>${ctx.user() ? 'Finish daily quizzes and claim your rewards to collect new frames.' : 'Create an account to earn shards through daily play.'}</p>${btn(ctx.user() ? 'rewards' : 'register', ctx.user() ? 'Earn more shards' : 'Create account', 'btn ghost small')}</div><p class="appearance-local-note">${shared ? 'Themes, backdrops and cosmetics are saved with your account. Uploaded images stay on this device.' : 'Themes and uploaded backgrounds are personal to this browser. Owned frames stay with your account.'}</p></aside><div class="appearance-workspace"><div class="appearance-tabs" role="group" aria-label="Appearance section">${[['frames', 'Frames'], ...COSMETIC_TYPES.map((t) => [t.tab, t.label]), ['picture', 'Picture'], ['themes', 'Themes'], ['backgrounds', 'Backgrounds']].map(([id, name]) => btn('appearance:tab:' + id, name, tab === id ? 'selected' : '', 'aria-pressed="' + (tab === id) + '"')).join('')}</div>${error ? `<p class="media-error" role="alert">${esc(error)}</p>` : ''}${status ? `<p class="appearance-status" role="status">${esc(status)}</p>` : ''}${tab === 'frames' ? framesView() : TYPE_BY_TAB[tab] ? itemsView(TYPE_BY_TAB[tab]) : tab === 'picture' ? pictureView() : tab === 'themes' ? themesView() : backgroundsView()}<div class="appearance-reset">${btn('appearance:reset', 'Reset theme & background', 'btn ghost small')}<span>Returns to Midnight mauve and Pure black. Your frame collection and uploaded image stay saved.</span></div></div></div>`;
  }
  async function action(name) {
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
      if (operation === 'reset-profile-background') {
        setPreferences({profileX: 50, profileY: 50, profileZoom: 1});
        refreshPage();
        return true;
      }
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
          ctx.setUserPatch({
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
        tab = TABS.includes(id) ? id : 'frames';
        refreshPage();
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
          ctx.setUserPatch({
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
            ctx.setUserPatch({
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
          ctx.setUserPatch({hasPicture: false, pictureUrl: null, pictureStatus: null, pictureVersion: Date.now()});
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
        setPreferences({background: prefs.background === 'custom' ? 'none' : prefs.background});
        status = 'Uploaded background removed from this browser.';
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
          ctx.setRewards(result.rewards);
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
      } else if (target.id === 'appearance-dim') setPreferences({dim: Number(target.value)});
      else if (target.id === 'appearance-position') setPreferences({position: target.value});
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
    const output = document.querySelector('#appearance-dim-value');
    if (output) output.value = dim + '%';
  }
  function rewardsTeaser() {
    return `<section class="appearance-teaser"><div class="teaser-frames">${['neon', 'aurora', 'galaxy'].map((id) => avatar(id)).join('')}</div><div><h2>Give your profile a signature.</h2><p>Explore frames, dark themes, and personal backgrounds in Appearance.</p></div>${btn('appearance', 'Open Appearance', 'btn secondary')}</section>`;
  }
  return {view, action, change, input, restore, updateContext, rewardsTeaser, adoptRemote, pushLocal};
}
