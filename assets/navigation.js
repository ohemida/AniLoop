const VIEWS = new Set([
  'home',
  'library',
  'stats',
  'leaderboard',
  'friends',
  'rooms',
  'room',
  'rewards',
  'appearance',
  'account',
  'bug-report',
  'privacy',
  'cookies',
  'terms',
  'legal',
  'help',
]);
// Shop sub-pages: #shop/frames, #shop/names, #shop/banners, #shop/themes (internal view id: 'appearance').
export const SHOP_TABS = ['frames', 'names', 'banners', 'themes'];
const CATEGORIES = new Set(['screenshot', 'character', 'opening', 'ending', 'anidle']);
export function readRoute(hash, defaultMode = 'infinity') {
  const [path, query = ''] = String(hash || '')
    .replace(/^#/, '')
    .split('?');
  const [page, category] = path.split('/');
  const requested = new URLSearchParams(query).get('mode');
  const MODES = ['daily', 'infinity', 'loop'];
  const mode = MODES.includes(requested) ? requested : MODES.includes(defaultMode) ? defaultMode : 'infinity';
  if (page === 'game' && CATEGORIES.has(category)) return {view: 'game', selected: category, mode};
  if (page === 'shop' || page === 'appearance')
    return {view: 'appearance', selected: null, mode, tab: SHOP_TABS.includes(category) ? category : 'frames'};
  return {view: VIEWS.has(page) ? page : 'home', selected: null, mode};
}
const pathOf = ({view, selected, tab}) =>
  view === 'game' ? 'game/' + selected : view === 'appearance' ? 'shop/' + (tab || 'frames') : view;
export function routeHash({view, selected, mode, tab}) {
  const route = readRoute('#' + pathOf({view, selected, tab}) + '?mode=' + mode, mode);
  return '#' + pathOf(route) + '?mode=' + route.mode;
}
