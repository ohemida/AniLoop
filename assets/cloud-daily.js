// Account-only daily quiz for the hosted (Supabase) build.
// The server picks today's questions from a secret seed, keeps the only copy of
// the attempt and grades every answer, so a private tab or a second device can
// neither preview the daily nor restart it after seeing the answers.
import {CATEGORIES} from '../core.js';

function emptySession() {
  return {
    version: 2,
    mode: 'daily',
    number: '',
    seed: '',
    packKey: '',
    games: Object.fromEntries(
      CATEGORIES.map((c) => [
        c.id,
        {
          questions: [],
          index: 0,
          scores: [],
          answers: [],
          hints: [],
          guesses: [],
          attempt: 1,
          done: false,
          levels: [],
          frames: [],
          characterRefs: [],
        },
      ]),
    ),
  };
}

export function createCloudDaily(ctx) {
  let data = null,
    loading = null,
    error = '',
    busy = false;
  const placeholder = emptySession();
  // Keep purely visual choices (selected screenshot, audio/video tab) across server refreshes.
  function merge(next) {
    if (data?.session && next?.session && data.day === next.day)
      for (const c of CATEGORIES) {
        const before = data.session.games[c.id],
          after = next.session.games[c.id];
        if (before.index === after.index) {
          after.activeFrame = before.activeFrame;
          after.musicMode = before.musicMode;
        }
      }
    data = next;
  }
  function load() {
    if (!ctx.user()) {
      data = null;
      error = '';
      return Promise.resolve(null);
    }
    if (loading) return loading;
    const owner = ctx.user().id;
    loading = (async () => {
      try {
        const next = await ctx.api('/api/daily');
        if (ctx.user()?.id === owner) {
          merge(next);
          error = '';
        }
      } catch (cause) {
        data = null;
        error = cause.message || 'The daily quiz could not be loaded.';
      } finally {
        loading = null;
      }
      return data;
    })();
    return loading;
  }
  async function act(category, action, extra = {}) {
    if (busy || !data?.session) return null;
    busy = true;
    try {
      const g = data.session.games[category];
      const next = await ctx.api('/api/daily/action', {category, index: g.index, action, ...extra});
      merge(next);
      if (next.rewards) ctx.setRewards?.(next.rewards);
      if (next.earned) ctx.toast(`Daily complete! +${next.earned} Loop Shards.`);
      return next;
    } catch (cause) {
      if (/another tab|new daily/i.test(cause.message || '')) await load();
      throw cause;
    } finally {
      busy = false;
    }
  }
  function clear() {
    data = null;
    error = '';
  }
  return {
    get session() {
      return data?.session || null;
    },
    get placeholder() {
      return placeholder;
    },
    get day() {
      return data?.day || null;
    },
    get finished() {
      return !!data?.finished;
    },
    get error() {
      return error;
    },
    get loading() {
      return !!loading;
    },
    load,
    act,
    clear,
  };
}
