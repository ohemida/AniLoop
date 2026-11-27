// AniLoop only uses strictly necessary browser storage (game saves, settings,
// sign-in). Under §165(3) TKG 2021 / Art. 5(3) ePrivacy Directive that storage
// needs no consent, so this is an informational, non-blocking notice instead of
// a cookie wall. If optional tracking is ever added, it must get a real opt-in.
export const PRIVACY_KEY = 'aniloop-privacy-v1';
export const CHOICE_VERSION = 'notice-v3-necessary-only';
export const CHOICE_LIFETIME = 365 * 24 * 60 * 60 * 1000;
export function validChoice(value, now = Date.now()) {
  return (
    !!value &&
    value.version === CHOICE_VERSION &&
    value.acknowledged === true &&
    Array.isArray(value.optionalPurposes) &&
    value.optionalPurposes.length === 0 &&
    Number.isFinite(value.savedAt) &&
    value.savedAt <= now + 300000 &&
    value.savedAt > now - CHOICE_LIFETIME
  );
}
export function readPrivacyChoice() {
  try {
    const value = JSON.parse(localStorage.getItem(PRIVACY_KEY));
    return validChoice(value) ? value : null;
  } catch {
    return null;
  }
}
function dismiss(root) {
  try {
    localStorage.setItem(
      PRIVACY_KEY,
      JSON.stringify({version: CHOICE_VERSION, acknowledged: true, optionalPurposes: [], savedAt: Date.now()}),
    );
  } catch {
    /* storage blocked: show again next visit */
  }
  root.remove();
}
/** Shows the storage notice once. Never blocks the app; resolves immediately. */
export function privacyGate({force = false} = {}) {
  document.querySelector('.privacy-notice')?.remove();
  if (!force && readPrivacyChoice()) return Promise.resolve();
  const root = document.createElement('aside');
  root.className = 'privacy-notice';
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Privacy notice');
  root.innerHTML = `<p><strong>No tracking, no ads.</strong> Only essential storage (saves, settings, sign-in). Media hosts see your IP address. Some anime content is mature.</p><div class="privacy-notice-actions"><a href="#privacy" data-notice-link>Privacy</a><a href="#cookies" data-notice-link>Storage</a><button type="button" class="btn small" data-notice-ok>Got it</button></div>`;
  root.addEventListener('click', (event) => {
    if (event.target.closest('[data-notice-ok]')) dismiss(root);
  });
  document.body.append(root);
  return Promise.resolve();
}
