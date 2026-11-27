// Client catalogue for cosmetics besides frames. Ids and prices must match
// cloud/engine.js (checked by tests/cosmetics.test.js); the server is authoritative.
export const COSMETIC_TYPES = [
  {type: 'title', tab: 'titles', label: 'Titles', heading: 'Say who you are.', text: 'A short title under your name, shown to friends and on the leaderboard.'},
  {type: 'name', tab: 'names', label: 'Name colours', heading: 'Make your name stand out.', text: 'Colours and shimmers for your username wherever other players see it.'},
  {type: 'banner', tab: 'banners', label: 'Banners', heading: 'Your card, your scene.', text: 'A backdrop behind your card in the friends list and on the leaderboard podium.'},
  {type: 'effect', tab: 'effects', label: 'Effects', heading: 'Celebrate every good guess.', text: 'A short animation that plays on your screen when you answer correctly.'},
];

export const COSMETIC_ITEMS = [
  {id: 'title-rookie', type: 'title', name: 'Rookie Looper', price: 0, description: 'Everyone starts somewhere.'},
  {id: 'title-sleuth', type: 'title', name: 'Scene Sleuth', price: 350, description: 'For players who know a show from one frame.'},
  {id: 'title-oracle', type: 'title', name: 'Opening Oracle', price: 500, description: 'Two notes are enough.'},
  {id: 'title-otaku', type: 'title', name: 'Certified Otaku', price: 1200, description: 'The watch list speaks for itself.'},
  {id: 'title-sensei', type: 'title', name: 'Anime Sensei', price: 2800, description: 'Teaches the rest of the party.'},
  {id: 'title-legend', type: 'title', name: 'Loop Legend', price: 6500, description: 'Reserved for the truly dedicated.'},
  {id: 'name-sakura', type: 'name', name: 'Sakura pink', price: 300, description: 'Soft blossom pink.'},
  {id: 'name-ice', type: 'name', name: 'Glacier blue', price: 500, description: 'Cool, crisp and calm.'},
  {id: 'name-gold', type: 'name', name: 'Gold leaf', price: 1200, description: 'A warm metallic gradient.'},
  {id: 'name-sunset', type: 'name', name: 'Sunset gradient', price: 2500, description: 'Orange fading into violet.'},
  {id: 'name-aurora', type: 'name', name: 'Aurora shimmer', price: 6000, description: 'An animated northern-lights gradient.'},
  {id: 'banner-dusk', type: 'banner', name: 'Mauve dusk', price: 350, description: 'The original AniLoop evening sky.'},
  {id: 'banner-sakura', type: 'banner', name: 'Sakura night', price: 900, description: 'Blossoms under a dark sky.'},
  {id: 'banner-manga', type: 'banner', name: 'Manga panel', price: 1600, description: 'Halftone dots and speed lines.'},
  {id: 'banner-city', type: 'banner', name: 'Neon city', price: 2800, description: 'A rain-soaked skyline glow.'},
  {id: 'banner-stars', type: 'banner', name: 'Starfield', price: 5000, description: 'Deep space with drifting stars.'},
  {id: 'effect-sparkle', type: 'effect', name: 'Sparkle burst', price: 500, description: 'A quick burst of sparkles.'},
  {id: 'effect-sakura', type: 'effect', name: 'Petal storm', price: 1200, description: 'Cherry blossoms drift across the screen.'},
  {id: 'effect-confetti', type: 'effect', name: 'Confetti', price: 2500, description: 'Colourful confetti rains down.'},
  {id: 'effect-fireworks', type: 'effect', name: 'Fireworks', price: 5500, description: 'Bursts of light for big moments.'},
];

const byId = new Map(COSMETIC_ITEMS.map((item) => [item.id, item]));
const valid = (id, type) => byId.get(id)?.type === type;
export const cosmeticItem = (id) => byId.get(id) || null;
export const titleText = (id) => (valid(id, 'title') ? byId.get(id).name : '');

/** Username (with name colour) and optional title, HTML-escaped. */
export function nameMarkup(username, look = {}, esc) {
  const style = valid(look?.nameStyle, 'name') ? ` ${look.nameStyle}` : '';
  const title = titleText(look?.title);
  return `<span class="player-name${style}">${esc(username)}</span>${title ? `<small class="player-title">${esc(title)}</small>` : ''}`;
}

/** Class for a card banner, or an empty string. */
export const bannerClass = (look) => (valid(look?.banner, 'banner') ? ` has-banner ${look.banner}` : '');

const PARTICLES = {
  'effect-sparkle': {count: 22, glyphs: ['✦', '✧', '⋆'], colors: ['#fff6c9', '#ffe08a', '#ffffff']},
  'effect-sakura': {count: 26, glyphs: ['✿', '❀'], colors: ['#ffc6dc', '#ff9fc4', '#ffe3ee']},
  'effect-confetti': {count: 40, glyphs: ['▮', '▬', '●'], colors: ['#ff6b8b', '#ffd166', '#6be3ff', '#9b8cff', '#7dffb0']},
  'effect-fireworks': {count: 36, glyphs: ['✺', '✹', '·'], colors: ['#ffb347', '#ff6bd6', '#6bc8ff', '#fff27a']},
};

/** Plays a celebration effect once. Does nothing for reduced-motion users. */
export function celebrate(effect) {
  const spec = PARTICLES[effect];
  if (!spec || typeof document === 'undefined') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelector('.celebration')?.remove();
  const layer = document.createElement('div');
  layer.className = `celebration ${effect}`;
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < spec.count; i++) {
    const p = document.createElement('span');
    p.textContent = spec.glyphs[i % spec.glyphs.length];
    p.style.setProperty('--x', `${Math.round(Math.random() * 100)}vw`);
    p.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 30)}vw`);
    p.style.setProperty('--delay', `${Math.round(Math.random() * 350)}ms`);
    p.style.setProperty('--size', `${(0.8 + Math.random() * 1.1).toFixed(2)}rem`);
    p.style.setProperty('--spin', `${Math.round((Math.random() - 0.5) * 720)}deg`);
    p.style.color = spec.colors[i % spec.colors.length];
    layer.append(p);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), 2400);
}
