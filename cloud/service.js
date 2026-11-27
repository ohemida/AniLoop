import {
  GameError,
  check,
  clone,
  today,
  timestamp,
  COSMETICS,
  recalculate,
  rewards,
  newAccount,
  normalizeSlots,
  makeRoom,
  roomView,
  roomAction,
  dailyAction,
} from './engine.js';
import {transaction} from './store.js';
import {CATEGORIES, createSession, totalScore} from '../core.js';

const validId = (value) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value);
const cleanText = (value, max) =>
  String(value ?? '')
    .trim()
    .slice(0, max);
const dayDate = (value) => {
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value ? d : null;
};
const pairKey = (a, b) => [a, b].sort().join(':');
// Profile pictures: the owner always sees their own picture; everyone else only
// sees it after the safety filter (or an administrator) approved it.
const PICTURE_TYPES = {png: 'iVBORw0KGgo', jpeg: '/9j/', webp: 'UklGR'};
const pictureUrl = (a) => (a?.picture ? `data:image/${a.pictureType || 'png'};base64,${a.picture}` : null);
const publicPicture = (a) => (a?.pictureStatus === 'approved' ? pictureUrl(a) : null);
const pictureStatus = (a) => (a?.picture ? a.pictureStatus || 'private' : null);
const FRAME_IDS = new Set(['classic', ...COSMETICS.filter((c) => c.type === 'frame').map((c) => c.id)]);
const LOOK_ID = /^[a-z][a-z0-9-]{1,23}$/;
export function normalizeLook(v) {
  if (!v || typeof v !== 'object' || !LOOK_ID.test(v.theme) || !LOOK_ID.test(v.background)) return null;
  const dim = Number(v.dim);
  return {
    theme: v.theme,
    background: v.background,
    dim: Number.isFinite(dim) ? Math.max(35, Math.min(90, Math.round(dim))) : 70,
    inGame: v.inGame === true,
    position: ['center', 'top', 'bottom'].includes(v.position) ? v.position : 'center',
    profileX: Number.isFinite(v.profileX) ? Math.max(0, Math.min(100, v.profileX)) : 50,
    profileY: Number.isFinite(v.profileY) ? Math.max(0, Math.min(100, v.profileY)) : 50,
    profileZoom: Number.isFinite(v.profileZoom) ? Math.max(1, Math.min(3, v.profileZoom)) : 1,
    savedAt: Number.isSafeInteger(v.savedAt) && v.savedAt > 0 ? v.savedAt : 0,
  };
}
const frameOf = (a) => (FRAME_IDS.has(a?.equipped) ? a.equipped : 'classic');
// What other players see: approved picture, frame, title, name colour and banner.
const lookOf = (a) => {
  const slots = normalizeSlots(a?.slots);
  return {
    pictureUrl: publicPicture(a),
    frame: frameOf(a),
    title: slots.title,
    nameStyle: slots.name,
    banner: slots.banner,
  };
};
const DEFAULT_LOOK = {pictureUrl: null, frame: 'classic', title: 'title-rookie', nameStyle: null, banner: null};
const PICTURE_UPLOADS_PER_DAY = 10;
export class CloudService {
  constructor(repository, pack, options = {}) {
    this.repo = repository;
    this.pack = pack;
    this.dailySecret = options.dailySecret || '';
    this.moderateImage = options.moderateImage || null;
    this.moderationConfigured = options.moderationConfigured ?? !!this.moderateImage;
  }
  // The daily seed is an HMAC of the date with a server secret, so nobody can
  // compute today's questions without an account (no private-tab replays).
  async dailySeed(day) {
    check(this.dailySecret, 'The daily quiz is not configured on the server yet.', 503);
    const encoder = new TextEncoder(),
      key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.dailySecret),
        {name: 'HMAC', hash: 'SHA-256'},
        false,
        ['sign'],
      );
    const bytes = new Uint8Array(
      await crypto.subtle.sign('HMAC', key, encoder.encode(`aniloop-daily:${this.pack.key}:${day}`)),
    );
    return [...bytes.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  dailyView(record, account = null, earned = 0) {
    const finished = CATEGORIES.every((c) => record.session.games[c.id].done);
    return {
      day: record.day,
      session: record.session,
      finished,
      score: totalScore(record.session),
      resetAt: new Date(Date.parse(record.day + 'T00:00:00Z') + 86400000).toISOString(),
      ...(account ? {rewards: rewards(account)} : {}),
      earned,
    };
  }
  async daily(actor) {
    const day = today(),
      seed = await this.dailySeed(day);
    return transaction(this.repo, actor, async (tx) => {
      const key = 'daily:' + actor;
      let record = await tx.get(key);
      if (!record || record.day !== day || record.packKey !== this.pack.key) {
        const session = createSession('daily', day, seed, this.pack.anime, this.pack.key);
        session.seed = day;
        record = {day, packKey: this.pack.key, session, scored: false};
        await tx.put(key, record, actor);
      }
      return this.dailyView(record);
    });
  }
  async dailyAct(actor, payload, skipScore = false) {
    const day = today();
    try {
      return await transaction(this.repo, actor, async (tx) => {
        const key = 'daily:' + actor,
          record = await tx.get(key);
        check(
          record && record.day === day && record.packKey === this.pack.key,
          'A new daily quiz has started. Reload to play it.',
          409,
        );
        dailyAction(record.session, payload?.category, payload || {}, this.pack);
        let account = null,
          earned = 0;
        if (!record.scored && CATEGORIES.every((c) => record.session.games[c.id].done)) {
          record.scored = true;
          const score = totalScore(record.session);
          const breakdown = Object.fromEntries(
            CATEGORIES.map((c) => [c.id, record.session.games[c.id].scores.reduce((a, b) => a + b, 0)]),
          );
          if (!skipScore) tx.score = {mode: 'daily', seed: day, score, breakdown};
          account = (await tx.get('account:' + actor)) || newAccount();
          if (!account.claims.some((c) => c.day === day)) {
            const streak = rewards(account).streak;
            earned = 100 + ((streak + 1) % 7 === 0 ? 50 : 0);
            account.shards += earned;
            account.claims.push({day, seed: day, amount: earned, score});
            await tx.put('account:' + actor, account, actor);
          }
        }
        await tx.put(key, record, actor);
        return this.dailyView(record, account, earned);
      });
    } catch (error) {
      // A daily score submitted by an older client today already occupies the
      // leaderboard slot; finish the run without inserting a duplicate score.
      if (!skipScore && error?.status === 409 && /already exists/i.test(error.message))
        return this.dailyAct(actor, payload, true);
      throw error;
    }
  }
  // Public look of other players: equipped frame, and the picture only if approved.
  async looksFor(ids) {
    if (typeof this.repo.looks === 'function') {
      try {
        return new Map((await this.repo.looks(ids)).map((r) => [r.owner_id, lookOf(r)]));
      } catch {
        /* Fall back to individual records if the batch query is unavailable. */
      }
    }
    const rows = await Promise.all(
      [...new Set(ids)].map(async (id) => [id, (await this.repo.getRuntime('account:' + id))?.value]),
    );
    return new Map(rows.filter(([, a]) => a).map(([id, a]) => [id, lookOf(a)]));
  }
  async acceptedFriends(actor) {
    const index = await this.repo.getRuntime('friends:' + actor),
      ids = (index?.value?.ids || []).slice(0, 200);
    const rows = await Promise.all(ids.map((id) => this.repo.getRuntime('friend:' + pairKey(actor, id))));
    return [actor, ...ids.filter((id, i) => rows[i]?.value?.status === 'accepted')];
  }
  // Friends leaderboard: same ranking rules as the global board, limited to you and your accepted friends.
  async friendsLeaderboard(actor, mode, period) {
    check(!!actor, 'Sign in to see your friends leaderboard.', 401);
    const ids = await this.acceptedFriends(actor),
      since =
        period === 'all'
          ? null
          : period === 'week'
            ? new Date(Date.now() - 7 * 86400000).toISOString()
            : today() + 'T00:00:00Z';
    const [rows, profiles, looks] = await Promise.all([
      typeof this.repo.scoreRows === 'function' ? this.repo.scoreRows(ids, mode, since) : [],
      Promise.all(ids.map((id) => this.repo.profile(id))),
      this.looksFor(ids).catch(() => new Map()),
    ]);
    const stats = new Map();
    for (const r of rows) {
      const s = stats.get(r.user_id) || {best: -1, rounds: 0, first: r.created_at};
      s.rounds++;
      if (r.score > s.best) {
        s.best = r.score;
      }
      stats.set(r.user_id, s);
    }
    const names = new Map(profiles.filter(Boolean).map((p) => [p.id, p.username]));
    const entries = ids.map((id) => ({
      userId: id,
      username: names.get(id) || 'Player',
      score: stats.get(id)?.best ?? null,
      rounds: stats.get(id)?.rounds || 0,
      first: stats.get(id)?.first || '',
      isSelf: id === actor,
      ...(looks.get(id) || DEFAULT_LOOK),
    }));
    entries.sort(
      (a, b) =>
        (a.score === null) - (b.score === null) ||
        (b.score || 0) - (a.score || 0) ||
        b.rounds - a.rounds ||
        String(a.first).localeCompare(String(b.first)) ||
        a.username.localeCompare(b.username),
    );
    let rank = 0;
    return {
      scope: 'friends',
      entries: entries.map((e) => {
        const {first, ...rest} = e;
        return {...rest, rank: e.score === null ? null : ++rank};
      }),
    };
  }
  async ensureAccount(actor) {
    return transaction(this.repo, actor, async (tx) => {
      let account = await tx.get('account:' + actor);
      if (!account) {
        account = {shards: 0, equipped: 'classic', owned: [], scores: [], claims: [], picture: null};
        await tx.put('account:' + actor, account, actor);
      }
      return account;
    });
  }
  async ensureProfile(actor, metadata = {}) {
    let profile = await this.repo.profile(actor);
    if (profile) return profile;
    const username = cleanText(metadata.username, 24);
    check(/^[A-Za-z0-9_-]{3,24}$/.test(username), 'Choose a public username before continuing.');
    const result = await this.repo.request(
      '/rest/v1/rpc/aniloop_cloud_create_profile',
      {
        p_actor: actor,
        p_username: username,
        p_adult_confirmed: metadata.adultConfirmed === true,
        p_notice_version: metadata.noticeVersion,
      },
      this.repo.serviceSecret,
    );
    await this.ensureAccount(actor);
    return await this.repo.profile(actor);
  }
  async current(actor, user) {
    if (!actor) return {user: null};
    const profile = await this.ensureProfile(actor, user?.user_metadata || {});
    const account = await this.ensureAccount(actor);
    const admin = await this.repo.isAdmin(actor);
    return {
      user: {
        id: actor,
        username: profile.username,
        email: user.email,
        provider: 'supabase',
        isAdmin: admin,
        hasPicture: !!account.picture,
        pictureUrl: pictureUrl(account),
        pictureStatus: pictureStatus(account),
        pictureCheck: account.picture && account.pictureStatus !== 'approved' ? account.pictureCheck || null : null,
        frame: frameOf(account),
        slots: normalizeSlots(account.slots),
        appearance: normalizeLook(account.appearance),
      },
    };
  }
  // Theme and backdrop follow the account, so they survive new devices, cleared storage and updates.
  async saveAppearance(actor, payload) {
    const look = normalizeLook({...payload, savedAt: Date.now()});
    check(look, 'Invalid appearance.');
    return transaction(this.repo, actor, async (tx) => {
      const a = (await tx.get('account:' + actor)) || newAccount();
      const previous = normalizeLook(a.appearance);
      if (previous && previous.savedAt >= look.savedAt) look.savedAt = previous.savedAt + 1;
      a.appearance = look;
      await tx.put('account:' + actor, a, actor);
      return {appearance: look};
    });
  }
  async leaderboard(q, actor = null) {
    const mode = q.get('mode') || 'infinity',
      period = q.get('period') || 'all',
      scope = q.get('scope') || 'global';
    check(
      ['daily', 'infinity'].includes(mode) &&
        ['all', 'week', 'today'].includes(period) &&
        ['global', 'friends'].includes(scope),
      'Invalid leaderboard filter.',
    );
    if (scope === 'friends') return this.friendsLeaderboard(actor, mode, period);
    const rows = await this.repo.request('/rest/v1/rpc/aniloop_cloud_leaderboard', {p_mode: mode, p_period: period});
    const looks = rows.length
      ? await this.looksFor(rows.map((r) => r.userId).filter(validId)).catch(() => new Map())
      : new Map();
    return {
      scope: 'global',
      entries: rows.map((r, i) => ({
        ...r,
        rank: i + 1,
        ...DEFAULT_LOOK,
        ...(looks.get(r.userId) || {}),
        isSelf: r.userId === actor,
      })),
    };
  }
  async submit(actor, round) {
    const score = recalculate(round, this.pack);
    check(score.mode !== 'daily', 'Daily results are saved automatically when you finish the daily quiz.');
    const result = await transaction(this.repo, actor, async (tx) => {
      tx.score = {mode: score.mode, seed: score.seed, score: score.score, breakdown: score.breakdown};
      return {score: score.score, breakdown: score.breakdown};
    });
    return result;
  }
  async rewards(actor) {
    return {rewards: rewards(await this.ensureAccount(actor))};
  }
  // Rewards are normally granted automatically when the server-side daily is
  // finished; this endpoint only repairs a missed claim from that record.
  async claim(actor) {
    const day = today();
    return transaction(this.repo, actor, async (tx) => {
      const record = await tx.get('daily:' + actor);
      check(
        record?.day === day && CATEGORIES.every((c) => record.session.games[c.id].done),
        'Complete today’s daily quiz to earn a daily reward.',
      );
      const a = (await tx.get('account:' + actor)) || newAccount();
      check(!a.claims.some((c) => c.day === day), 'This daily reward has already been claimed.', 409);
      const score = totalScore(record.session),
        streak = rewards(a).streak,
        amount = 100 + ((streak + 1) % 7 === 0 ? 50 : 0);
      a.shards += amount;
      a.claims.push({day, seed: day, amount, score});
      await tx.put('account:' + actor, a, actor);
      return {earned: amount, rewards: rewards(a)};
    });
  }
  async cosmetic(actor, item, equip) {
    const def = COSMETICS.find((c) => c.id === item),
      clear = typeof item === 'string' ? /^(title|name|banner|effect)-none$/.exec(item) : null;
    check(typeof item === 'string' && (item === 'classic' || def || (equip && clear)), 'Unknown cosmetic.');
    return transaction(this.repo, actor, async (tx) => {
      const a = (await tx.get('account:' + actor)) || newAccount();
      a.slots = normalizeSlots(a.slots);
      const wear = (d) => {
        if (d.type === 'frame') a.equipped = d.id;
        else a.slots[d.type] = d.id;
      };
      if (equip) {
        if (item === 'classic') a.equipped = 'classic';
        else if (clear) a.slots[clear[1]] = clear[1] === 'title' ? 'title-rookie' : null;
        else {
          check(item === 'title-rookie' || a.owned.includes(item), 'Unlock that item before equipping it.');
          wear(def);
        }
      } else {
        check(def && item !== 'title-rookie', 'You already own that item.', 409);
        check(!a.owned.includes(item), 'You already own that item.', 409);
        check(a.shards >= def.price, 'Not enough Loop Shards.');
        a.shards -= def.price;
        a.owned.push(item);
        wear(def);
      }
      await tx.put('account:' + actor, a, actor);
      return {rewards: rewards(a)};
    });
  }
  async friendChange(actor, action, payload) {
    check(['request', 'accept', 'decline', 'cancel', 'remove'].includes(action), 'Unknown friend action.');
    if (action === 'request') {
      const name = cleanText(payload.username, 24);
      check(/^[A-Za-z0-9_-]{3,24}$/.test(name), 'Enter an exact AniLoop username.');
      const target = await this.repo.findProfile(name);
      check(target, 'No player has that username.', 404);
      check(target.id !== actor, 'Choose another player to add as a friend.');
      return transaction(this.repo, actor, async (tx) => {
        const ids = pairKey(actor, target.id),
          key = 'friend:' + ids,
          indexA = 'friends:' + actor,
          indexB = 'friends:' + target.id;
        const [row, a, b] = await Promise.all([tx.get(key), tx.get(indexA), tx.get(indexB)]);
        check(
          !row,
          row?.status === 'accepted'
            ? 'You are already friends.'
            : 'A friend request is already pending. Check your requests.',
          409,
        );
        check(
          (a?.ids?.length || 0) < 200 && (b?.ids?.length || 0) < 200,
          'The friend list or request limit has been reached.',
          409,
        );
        await tx.put(key, {
          members: [actor, target.id].sort(),
          requestedBy: actor,
          status: 'pending',
          created: timestamp(),
        });
        await tx.put(indexA, {ids: [...(a?.ids || []), target.id]}, actor);
        await tx.put(indexB, {ids: [...(b?.ids || []), actor]}, target.id);
        return {ok: true};
      });
    }
    const other = payload.userId;
    check(validId(other) && other !== actor, 'Choose another player.');
    const key = 'friend:' + pairKey(actor, other);
    return transaction(this.repo, actor, async (tx) => {
      const row = await tx.get(key);
      check(row, 'This friend request or friendship no longer exists.', 404);
      if (action === 'accept' || action === 'decline')
        check(
          row.status === 'pending' && row.requestedBy !== actor,
          'Only the recipient can ' + action + ' a pending request.',
          403,
        );
      if (action === 'cancel')
        check(
          row.status === 'pending' && row.requestedBy === actor,
          'Only the sender can cancel a pending request.',
          403,
        );
      if (action === 'remove') check(row.status === 'accepted', 'This player is not on your friend list.', 409);
      if (action === 'accept') {
        row.status = 'accepted';
        row.accepted = timestamp();
        await tx.put(key, row);
      } else {
        await tx.remove(key);
        for (const id of [actor, other]) {
          const index = await tx.get('friends:' + id);
          await tx.put(
            'friends:' + id,
            {ids: (index?.ids || []).filter((x) => x !== (id === actor ? other : actor))},
            id,
          );
        }
      }
      return {ok: true};
    });
  }
  async friends(actor, dayValue) {
    const day = dayValue || today(),
      date = dayDate(day);
    check(
      date && date.getTime() >= Date.now() - 366 * 86400000 && date.getTime() <= Date.now() + 86400000,
      'Choose a valid quiz date within the past year.',
    );
    const index = await this.repo.getRuntime('friends:' + actor);
    const ids = [actor, ...(index?.value?.ids || [])].slice(0, 201);
    const rows = await Promise.all(
      ids.map(async (id) => ({id, row: await this.repo.getRuntime('friend:' + pairKey(actor, id))})),
    );
    const accepted = rows.filter((x) => x.id === actor || x.row?.value?.status === 'accepted').map((x) => x.id);
    const profiles = await Promise.all(ids.map((id) => this.repo.profile(id)));
    const names = new Map(profiles.filter(Boolean).map((p) => [p.id, p.username]));
    const scores = await this.repo.request('/rest/v1/rpc/aniloop_cloud_friend_scores', {p_ids: accepted, p_day: day});
    const result = new Map(scores.map((x) => [x.id, x]));
    const days = Array.from({length: 7}, (_, i) => {
      const d = new Date(date);
      d.setUTCDate(d.getUTCDate() - 6 + i);
      return d.toISOString().slice(0, 10);
    });
    const incomingIds = rows
      .filter((x) => x.id !== actor && x.row?.value?.status === 'pending' && x.row.value.requestedBy !== actor)
      .map((x) => x.id);
    const [looks, own] = await Promise.all([
      this.looksFor(ids.filter((id) => id !== actor)).catch(() => new Map()),
      this.repo.getRuntime('account:' + actor),
    ]);
    looks.set(actor, {...lookOf(own?.value), pictureUrl: pictureUrl(own?.value)});
    const look = (id) => looks.get(id) || DEFAULT_LOOK;
    const incoming = [],
      outgoing = [];
    for (const x of rows) {
      if (x.id === actor || x.row?.value?.status !== 'pending') continue;
      const mine = x.row.value.requestedBy === actor,
        p = {userId: x.id, username: names.get(x.id) || 'Player', ...look(x.id)};
      (mine ? outgoing : incoming).push(p);
    }
    const players = accepted.map((id) => {
      const p = result.get(id) || {};
      const record = (p.daily || []).find((r) => r.day === day);
      const dailyMap = new Map((p.daily || []).map((r) => [r.day, r]));
      return {
        userId: id,
        username: names.get(id) || 'Player',
        isSelf: id === actor,
        ...look(id),
        dailyScore: record?.score ?? null,
        breakdown: record?.breakdown ?? null,
        bestInfinity: p.bestInfinity ?? null,
        infinityRounds: p.infinityRounds || 0,
        history: days.map((d) => ({day: d, score: dailyMap.get(d)?.score ?? null})),
      };
    });
    players.sort(
      (a, b) =>
        (a.dailyScore === null) - (b.dailyScore === null) ||
        (b.dailyScore || 0) - (a.dailyScore || 0) ||
        a.username.localeCompare(b.username),
    );
    return {day, days, incoming, outgoing, players, friendCount: players.filter((p) => !p.isSelf).length};
  }
  async createRoom(actor, user, mode) {
    check(['party', 'coop'].includes(mode), 'Choose Party or Co-op Infinity.');
    for (let i = 0; i < 5; i++) {
      const code = Math.random().toString(36).slice(2, 8).toUpperCase().replace(/[01]/g, 'A');
      try {
        return await transaction(this.repo, actor, async (tx) => {
          check(!(await tx.get('membership:' + actor)), 'Leave your current room first.', 409);
          const room = makeRoom(code, {id: actor, username: user.username}, mode);
          await tx.put('room:' + code, room, null);
          await tx.put('membership:' + actor, {code}, actor);
          return {room: roomView(room, actor)};
        });
      } catch (e) {
        if (e.status !== 409 || e.message === 'Leave your current room first.') throw e;
      }
    }
    throw new GameError('Could not create a room. Try again.', 503);
  }
  async joinRoom(actor, user, code) {
    code = cleanText(code, 6).toUpperCase();
    check(/^[A-Z2-9]{6}$/.test(code), 'Enter a valid six-character room code.');
    return transaction(this.repo, actor, async (tx) => {
      check(!(await tx.get('membership:' + actor)), 'Leave your current room first.', 409);
      const room = await tx.get('room:' + code);
      check(room && room.updated + 86400 > timestamp(), 'Room not found or expired.', 404);
      check(room.state.phase === 'lobby' && room.members.length < 8, 'This room is full or has already started.', 409);
      room.members.push({id: actor, username: user.username, joined: timestamp()});
      room.revision++;
      room.updated = timestamp();
      await tx.put('room:' + code, room, null);
      await tx.put('membership:' + actor, {code}, actor);
      return {room: roomView(room, actor)};
    });
  }
  async roomLooks(result, actor) {
    if (!result?.room) return result;
    const players = result.room.players,
      looks = await this.looksFor(players.map((p) => p.id)).catch(() => new Map());
    const own = await this.repo.getRuntime('account:' + actor);
    result.room.players = players.map((p) => ({
      ...p,
      ...(looks.get(p.id) || DEFAULT_LOOK),
      ...(p.id === actor ? {pictureUrl: pictureUrl(own?.value)} : {}),
    }));
    return result;
  }
  async roomCurrent(actor) {
    const m = await this.repo.getRuntime('membership:' + actor);
    if (!m?.value) return {room: null};
    const r = await this.repo.getRuntime('room:' + m.value.code);
    return {room: r?.value ? roomView(r.value, actor) : null};
  }
  async roomGet(actor, code) {
    const row = await this.repo.getRuntime('room:' + cleanText(code, 6).toUpperCase());
    check(row?.value && row.value.updated + 86400 > timestamp(), 'Room not found or expired.', 404);
    return {room: roomView(row.value, actor)};
  }
  async roomMutate(actor, code, data) {
    code = cleanText(code, 6).toUpperCase();
    return transaction(this.repo, actor, async (tx) => {
      const room = await tx.get('room:' + code);
      check(room && room.updated + 86400 > timestamp(), 'Room not found or expired.', 404);
      roomAction(room, actor, data, this.pack);
      if (!room.members.some((m) => m.id === actor)) await tx.remove('membership:' + actor);
      else await tx.put('membership:' + actor, {code}, actor);
      if (!room.members.length) await tx.remove('room:' + code);
      else await tx.put('room:' + code, room, null);
      return {room: room.members.some((m) => m.id === actor) ? roomView(room, actor) : null};
    });
  }
  async picture(actor, payload) {
    const raw = payload?.image,
      saved = (a) => ({
        hasPicture: !!a.picture,
        pictureUrl: pictureUrl(a),
        pictureStatus: pictureStatus(a),
        pictureCheck: a.pictureStatus === 'approved' ? null : a.pictureCheck || null,
      });
    if (payload?.share === true) return this.sharePicture(actor, saved);
    if (raw === null)
      return transaction(this.repo, actor, async (tx) => {
        const a = (await tx.get('account:' + actor)) || newAccount();
        Object.assign(a, {picture: null, pictureType: null, pictureStatus: null});
        await tx.put('account:' + actor, a, actor);
        return saved(a);
      });
    const match =
      typeof raw === 'string' ? /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw) : null;
    check(
      match && match[2].length <= 470_000 && match[2].startsWith(PICTURE_TYPES[match[1]]),
      'The prepared profile picture could not be saved. Choose a PNG, JPEG or WebP image up to 8 MB.',
    );
    const day = today(),
      current = (await this.repo.getRuntime('account:' + actor))?.value,
      uploads = current?.pictureUploads?.day === day ? current.pictureUploads.count : 0;
    check(
      uploads < PICTURE_UPLOADS_PER_DAY,
      'You changed your profile picture too often today. Try again tomorrow.',
      429,
    );
    if (payload.manualReview === true)
      return transaction(this.repo, actor, async (tx) => {
        const a = (await tx.get('account:' + actor)) || newAccount(),
          count = a.pictureUploads?.day === day ? a.pictureUploads.count : 0;
        check(
          count < PICTURE_UPLOADS_PER_DAY,
          'You changed your profile picture too often today. Try again tomorrow.',
          429,
        );
        a.pictureUploads = {day, count: count + 1};
        await tx.put('account:' + actor, a, actor);
        await tx.put(
          'picture-review:' + actor,
          {id: crypto.randomUUID(), picture: match[2], pictureType: match[1], submitted: timestamp()},
          actor,
        );
        return {submitted: true};
      });
    // Safety filter (nudity, sexual content, graphic violence, self-harm). If no
    // filter is configured or it is unreachable, fail closed: the picture stays
    // visible only to its owner until an administrator approves it.
    const verdict = await this.checkPicture(raw);
    if (verdict.status === 'rejected') {
      await transaction(this.repo, actor, async (tx) => {
        const a = (await tx.get('account:' + actor)) || newAccount();
        a.pictureUploads = {day, count: uploads + 1};
        await tx.put('account:' + actor, a, actor);
      });
      throw new GameError(
        'This picture was blocked by the safety filter. Profile pictures must not show nudity, sexual content, graphic violence or self-harm.',
        422,
      );
    }
    return transaction(this.repo, actor, async (tx) => {
      const a = (await tx.get('account:' + actor)) || newAccount();
      Object.assign(a, {
        picture: match[2],
        pictureType: match[1],
        pictureStatus: verdict.status === 'approved' ? 'approved' : 'pending',
        pictureCheck: verdict.reason || null,
        pictureChecked: timestamp(),
        pictureUploads: {day, count: uploads + 1},
      });
      await tx.put('account:' + actor, a, actor);
      return saved(a);
    });
  }
  async checkPicture(dataUrl) {
    if (!this.moderateImage) return {status: 'pending', reason: 'not-configured'};
    try {
      return (await this.moderateImage(dataUrl)) || {status: 'pending', reason: 'unreachable'};
    } catch {
      return {status: 'pending', reason: 'unreachable'};
    }
  }
  // Share an already stored picture (uploaded while pictures were private) or retry a failed check.
  async sharePicture(actor, saved) {
    const day = today(),
      current = (await this.repo.getRuntime('account:' + actor))?.value;
    check(current?.picture, 'Upload a profile picture first.', 404);
    if (current.pictureStatus === 'approved') return saved(current);
    const uploads = current.pictureUploads?.day === day ? current.pictureUploads.count : 0;
    check(
      uploads < PICTURE_UPLOADS_PER_DAY,
      'You checked your profile picture too often today. Try again tomorrow.',
      429,
    );
    const verdict = await this.checkPicture(pictureUrl(current));
    const result = await transaction(this.repo, actor, async (tx) => {
      const a = (await tx.get('account:' + actor)) || newAccount();
      check(a.picture === current.picture, 'Your picture changed meanwhile. Try again.', 409);
      a.pictureUploads = {day, count: uploads + 1};
      a.pictureChecked = timestamp();
      if (verdict.status === 'rejected')
        Object.assign(a, {picture: null, pictureType: null, pictureStatus: null, pictureCheck: null});
      else
        Object.assign(a, {
          pictureStatus: verdict.status === 'approved' ? 'approved' : 'pending',
          pictureCheck: verdict.reason || null,
        });
      await tx.put('account:' + actor, a, actor);
      return saved(a);
    });
    if (verdict.status === 'rejected')
      throw new GameError(
        'This picture was blocked by the safety filter and has been removed. Profile pictures must not show nudity, sexual content, graphic violence or self-harm.',
        422,
      );
    return result;
  }
  async exportAccount(actor, jwt) {
    const data = await this.repo.request('/rest/v1/rpc/aniloop_export_own_account', {}, jwt);
    const own = await this.repo.getRuntime('account:' + actor);
    const rows = await this.repo.request(
      '/rest/v1/aniloop_runtime?' + new URLSearchParams({owner_id: 'eq.' + actor, select: 'key,value,revision'}),
    );
    return {
      cloud: data,
      privateData: {account: own?.value || null, records: rows.filter((r) => r.key !== 'account:' + actor)},
    };
  }
  async deleteAccount(actor, jwt) {
    await this.repo.request('/rest/v1/rpc/aniloop_delete_own_account', {}, jwt);
    return {ok: true};
  }
  async save(actor, payload, readOnly) {
    const key = 'save:' + actor;
    if (readOnly) {
      const row = await this.repo.getRuntime(key);
      return {state: row?.value?.state || null, savedAt: row?.value?.savedAt || 0};
    }
    const value = payload?.state;
    check(value && typeof value === 'object' && !Array.isArray(value) && value.version === 1, 'Invalid save data.');
    const encoded = JSON.stringify(value);
    check(encoded.length <= 500_000, 'Cloud saves are limited to 500 KB.');
    return transaction(this.repo, actor, async (tx) => {
      await tx.put(key, {state: value, savedAt: timestamp() * 1000}, actor);
      return {savedAt: timestamp() * 1000};
    });
  }
  async handle(actor, user, method, path, payload, jwt) {
    const route = path.split('?')[0],
      query = new URLSearchParams(path.split('?')[1] || '');
    if (route === '/api/config') return {supabaseEnabled: true, gameDataStorage: 'supabase'};
    if (route === '/api/leaderboard') return this.leaderboard(query, actor);
    if (route === '/api/account' && !actor) return {user: null};
    if (route === '/api/bugs') throw new GameError('Bug report intake is not configured yet.', 503);
    if (route === '/api/hints')
      throw new GameError(
        'This clip has no preprocessed protected hint asset configured in Supabase Storage yet.',
        503,
      );
    check(!!actor, 'Sign in to continue.', 401);
    if (route === '/api/account') return this.current(actor, user);
    if (route === '/api/account/save') return this.save(actor, payload, method === 'GET');
    if (route === '/api/account/export') return this.exportAccount(actor, jwt);
    if (route === '/api/account/delete') return this.deleteAccount(actor, jwt);
    if (route === '/api/account/picture') {
      if (method !== 'GET') return this.picture(actor, payload);
      const a = await this.ensureAccount(actor);
      return {pictureUrl: pictureUrl(a), pictureStatus: pictureStatus(a)};
    }
    if (route === '/api/daily') return this.daily(actor);
    if (route === '/api/daily/action') return this.dailyAct(actor, payload);
    if (route === '/api/scores') return this.submit(actor, payload.round);
    if (route === '/api/appearance') return this.saveAppearance(actor, payload || {});
    if (route === '/api/rewards') return this.rewards(actor);
    if (route === '/api/rewards/claim') return this.claim(actor);
    if (route === '/api/rewards/buy' || route === '/api/rewards/equip')
      return this.cosmetic(actor, payload.item, route.endsWith('/equip'));
    if (route === '/api/friends' && method === 'GET') return this.friends(actor, query.get('day'));
    if (route.startsWith('/api/friends/')) return this.friendChange(actor, route.split('/').at(-1), payload);
    if (route === '/api/rooms/current') return this.roomLooks(await this.roomCurrent(actor), actor);
    if (route === '/api/rooms/view') return this.roomLooks(await this.roomGet(actor, query.get('code')), actor);
    if (route === '/api/rooms/create')
      return this.roomLooks(await this.createRoom(actor, await this.repo.profile(actor), payload.mode), actor);
    if (route === '/api/rooms/join')
      return this.roomLooks(await this.joinRoom(actor, await this.repo.profile(actor), payload.code), actor);
    if (route === '/api/rooms/action')
      return this.roomLooks(await this.roomMutate(actor, payload.code, payload), actor);
    if (route === '/api/admin') return this.adminSummary(actor, query.get('q') || '');
    if (route === '/api/admin/daily') return this.adminDailyAnswers(actor);
    if (route === '/api/admin/action') return this.adminAction(actor, payload);
    throw new GameError('Unknown endpoint.', 404);
  }
  // Today's daily answers for administrators (same questions for every player).
  async adminDailyAnswers(actor) {
    check(await this.repo.isAdmin(actor), 'Administrator access required.', 403);
    const day = today(),
      seed = await this.dailySeed(day),
      session = createSession('daily', day, seed, this.pack.anime, this.pack.key),
      byId = new Map(this.pack.anime.map((a) => [a.id, a]));
    const title = (a) => (a ? a.englishTitle || a.alternativeTitle || a.title : 'Unknown anime'),
      song = (m) => (m ? [m.song, m.artist].filter(Boolean).join(' – ') : '');
    const categories = Object.entries(session.games).map(([id, g]) => ({
      id,
      rounds: g.questions.map((q, r) => {
        const level = g.levels?.[r] || null;
        if (id === 'character')
          return {
            level,
            characters: q.map((animeId, i) => {
              const a = byId.get(animeId),
                ref = g.characterRefs?.[r]?.[i],
                c = (a?.characters || []).find((x) => String(x.id) === String(ref));
              return {
                name: c?.name || a?.character || 'Unknown',
                anime: title(a),
                image: c?.image || a?.characterImage || null,
              };
            }),
          };
        const a = byId.get(q);
        return {
          level,
          anime: title(a),
          original: a?.title || '',
          year: a?.year || null,
          detail:
            id === 'opening' || id === 'ending'
              ? song(a?.[id])
              : id === 'anidle'
                ? [a?.studio, a?.year].filter(Boolean).join(' · ')
                : '',
          image: id === 'screenshot' ? a?.screenshots?.[0] || null : a?.cover || null,
        };
      }),
    }));
    return {day, categories};
  }
  async adminSummary(actor, search = '') {
    check(await this.repo.isAdmin(actor), 'Administrator access required.', 403);
    const q = cleanText(search, 24).replace(/[^A-Za-z0-9_-]/g, '');
    const profileQuery = new URLSearchParams({
      select: 'id,username,created_at',
      order: q ? 'username.asc' : 'created_at.desc',
      limit: '100',
    });
    if (q) profileQuery.set('username', 'ilike.*' + q + '*');
    const [profiles, admins, reports] = await Promise.all([
      this.repo.request('/rest/v1/aniloop_profiles?' + profileQuery),
      this.repo.request('/rest/v1/aniloop_admins?select=user_id'),
      this.repo.list('report:', 100),
    ]);
    const ids = profiles.map((p) => p.id),
      [wallets, briefs, scores] = await Promise.all([
        ids.length
          ? this.repo.request(
              '/rest/v1/aniloop_wallets?' +
                new URLSearchParams({user_id: 'in.(' + ids.join(',') + ')', select: 'user_id,shards'}),
            )
          : [],
        typeof this.repo.accountBriefs === 'function' ? this.repo.accountBriefs(ids).catch(() => []) : [],
        typeof this.repo.bestScores === 'function' ? this.repo.bestScores(ids).catch(() => []) : [],
      ]);
    const balance = new Map(wallets.map((x) => [x.user_id, x.shards])),
      brief = new Map(briefs.map((b) => [b.owner_id, b])),
      best = (id, mode) => scores.find((s) => s.user_id === id && s.mode === mode)?.score ?? null;
    return {
      accountCount: profiles.length,
      moderation: this.moderationConfigured ? 'configured' : 'not-configured',
      cosmetics: COSMETICS.map((c) => c.id),
      players: profiles.map((p) => {
        const b = brief.get(p.id) || {};
        return {
          id: p.id,
          username: p.username,
          created: p.created_at || null,
          shards: balance.get(p.id) || 0,
          role: admins.some((a) => a.user_id === p.id) ? 'admin' : 'none',
          isSelf: p.id === actor,
          pictureStatus: b.hasPicture ? b.pictureStatus || 'private' : null,
          frame: b.equipped || 'classic',
          owned: Array.isArray(b.owned) ? b.owned : [],
          bestInfinity: best(p.id, 'infinity'),
          bestDaily: best(p.id, 'daily'),
        };
      }),
      reports: reports.map((r) => ({...r.value, id: r.key.slice(7)})),
      pictures: await this.pendingPictures(new Map(profiles.map((p) => [p.id, p.username]))),
    };
  }
  async pendingPictures(names) {
    const [rows, reviews] = await Promise.all([
      typeof this.repo.pendingPictures === 'function' ? this.repo.pendingPictures(50).catch(() => []) : [],
      typeof this.repo.list === 'function' ? this.repo.list('picture-review:', 50).catch(() => []) : [],
    ]);
    return [
      ...rows.map((r) => ({
        userId: r.owner_id,
        username: names.get(r.owner_id) || 'Player',
        pictureUrl: r.picture ? `data:image/${r.pictureType || 'png'};base64,${r.picture}` : null,
      })),
      ...reviews.map((r) => ({
        userId: r.owner_id,
        username: names.get(r.owner_id) || 'Player',
        reviewId: r.value?.id,
        pictureUrl: r.value?.picture ? `data:image/${r.value.pictureType || 'png'};base64,${r.value.picture}` : null,
      })),
    ].filter((r) => r.pictureUrl);
  }
  async adminAction(actor, payload) {
    check(await this.repo.isAdmin(actor), 'Administrator access required.', 403);
    if (payload.action === 'set-shards') {
      check(
        validId(payload.userId) &&
          Number.isSafeInteger(payload.shards) &&
          payload.shards >= 0 &&
          payload.shards <= 1_000_000_000,
        'Invalid shard balance.',
      );
      return transaction(this.repo, actor, async (tx) => {
        const a = (await tx.get('account:' + payload.userId)) || {
          shards: 0,
          equipped: 'classic',
          owned: [],
          claims: [],
          scores: [],
          picture: null,
        };
        a.shards = payload.shards;
        tx.admin = true;
        await tx.put('account:' + payload.userId, a, payload.userId);
        return {ok: true};
      });
    }
    if (payload.action === 'delete-report') {
      const key = 'report:' + cleanText(payload.reportId, 80);
      return transaction(this.repo, actor, async (tx) => {
        check(await tx.get(key), 'Report not found.', 404);
        tx.admin = true;
        await tx.remove(key);
        return {ok: true};
      });
    }
    if (payload.action === 'picture-review-approve' || payload.action === 'picture-review-reject') {
      check(validId(payload.userId) && validId(payload.reviewId), 'Choose a picture review.');
      return transaction(this.repo, actor, async (tx) => {
        const key = 'picture-review:' + payload.userId,
          review = await tx.get(key);
        check(review?.id === payload.reviewId, 'This review was replaced or already handled.', 409);
        if (payload.action === 'picture-review-approve') {
          const account = (await tx.get('account:' + payload.userId)) || newAccount();
          Object.assign(account, {
            picture: review.picture,
            pictureType: review.pictureType,
            pictureStatus: 'approved',
            pictureCheck: null,
            pictureChecked: timestamp(),
          });
          await tx.put('account:' + payload.userId, account, payload.userId);
        }
        await tx.remove(key);
        tx.admin = true;
        return {ok: true};
      });
    }
    if (payload.action === 'picture-approve' || payload.action === 'picture-reject') {
      check(validId(payload.userId), 'Choose a player.');
      return transaction(this.repo, actor, async (tx) => {
        const a = await tx.get('account:' + payload.userId);
        check(a?.picture, 'This player has no profile picture.', 404);
        if (payload.action === 'picture-approve') a.pictureStatus = 'approved';
        else Object.assign(a, {picture: null, pictureType: null, pictureStatus: null});
        tx.admin = true;
        await tx.put('account:' + payload.userId, a, payload.userId);
        return {ok: true};
      });
    }
    const target = payload.userId;
    const account = (fn) => {
      check(validId(target), 'Choose a player.');
      return transaction(this.repo, actor, async (tx) => {
        const a = (await tx.get('account:' + target)) || newAccount();
        const result = (await fn(a)) || {ok: true};
        tx.admin = true;
        await tx.put('account:' + target, a, target);
        return result;
      });
    };
    if (payload.action === 'grant-item' || payload.action === 'revoke-item') {
      const def = COSMETICS.find((c) => c.id === payload.item);
      check(def, 'Unknown cosmetic.');
      return account((a) => {
        a.owned = Array.isArray(a.owned) ? a.owned : [];
        a.slots = normalizeSlots(a.slots);
        if (payload.action === 'grant-item') {
          if (!a.owned.includes(payload.item)) a.owned.push(payload.item);
        } else {
          a.owned = a.owned.filter((x) => x !== payload.item);
          if (a.equipped === payload.item) a.equipped = 'classic';
          for (const k of Object.keys(a.slots)) if (a.slots[k] === payload.item) a.slots[k] = null;
        }
      });
    }
    if (payload.action === 'add-shards') {
      check(Number.isSafeInteger(payload.amount) && Math.abs(payload.amount) <= 1_000_000, 'Invalid amount.');
      return account((a) => {
        a.shards = Math.max(0, Math.min(1_000_000_000, (a.shards || 0) + payload.amount));
        return {ok: true, shards: a.shards};
      });
    }
    if (payload.action === 'remove-picture')
      return account((a) => {
        check(a.picture, 'This player has no profile picture.', 404);
        Object.assign(a, {picture: null, pictureType: null, pictureStatus: null, pictureCheck: null});
      });
    if (payload.action === 'picture-approve-all' || payload.action === 'picture-recheck') {
      const rows = typeof this.repo.pendingPictures === 'function' ? await this.repo.pendingPictures(50) : [];
      let approved = 0,
        rejected = 0,
        waiting = 0;
      for (const row of rows) {
        const verdict =
          payload.action === 'picture-approve-all'
            ? {status: 'approved'}
            : await this.checkPicture(`data:image/${row.pictureType || 'png'};base64,${row.picture}`);
        if (verdict.status === 'pending') {
          waiting++;
          continue;
        }
        await transaction(this.repo, actor, async (tx) => {
          const a = await tx.get('account:' + row.owner_id);
          if (!a?.picture || a.picture !== row.picture) return;
          if (verdict.status === 'approved') {
            a.pictureStatus = 'approved';
            a.pictureCheck = null;
            approved++;
          } else {
            Object.assign(a, {picture: null, pictureType: null, pictureStatus: null, pictureCheck: null});
            rejected++;
          }
          tx.admin = true;
          await tx.put('account:' + row.owner_id, a, row.owner_id);
        });
      }
      return {
        ok: true,
        approved,
        rejected,
        waiting,
        reason: waiting && !this.moderationConfigured ? 'not-configured' : null,
      };
    }
    if (payload.action === 'reset-daily') {
      check(validId(target), 'Choose a player.');
      const day = today();
      await transaction(this.repo, actor, async (tx) => {
        tx.admin = true;
        await tx.remove('daily:' + target);
      });
      if (typeof this.repo.mutate === 'function')
        await this.repo.mutate(
          'DELETE',
          '/rest/v1/aniloop_scores?' +
            new URLSearchParams({user_id: 'eq.' + target, mode: 'eq.daily', seed: 'eq.' + day}),
        );
      return {ok: true};
    }
    if (payload.action === 'clear-scores') {
      check(validId(target) && ['infinity', 'daily', 'all'].includes(payload.mode), 'Choose a player and a mode.');
      check(typeof this.repo.mutate === 'function', 'Not available here.');
      const params = new URLSearchParams({user_id: 'eq.' + target});
      if (payload.mode !== 'all') params.set('mode', 'eq.' + payload.mode);
      await this.repo.mutate('DELETE', '/rest/v1/aniloop_scores?' + params);
      return {ok: true};
    }
    if (payload.action === 'set-admin') {
      check(validId(target) && typeof payload.admin === 'boolean', 'Choose a player.');
      check(target !== actor || payload.admin, 'You cannot remove your own administrator access.');
      check(typeof this.repo.mutate === 'function', 'Not available here.');
      if (payload.admin)
        await this.repo.mutate('POST', '/rest/v1/aniloop_admins?on_conflict=user_id', {user_id: target}).catch((e) => {
          if (e.status !== 409) throw e;
        });
      else
        await this.repo.mutate('DELETE', '/rest/v1/aniloop_admins?' + new URLSearchParams({user_id: 'eq.' + target}));
      return {ok: true};
    }
    if (payload.action === 'rename') {
      const name = String(payload.username || '');
      check(validId(target) && /^[A-Za-z0-9_-]{3,24}$/.test(name), 'Usernames use 3 to 24 letters, numbers, _ or -.');
      check(typeof this.repo.mutate === 'function', 'Not available here.');
      await this.repo.mutate('PATCH', '/rest/v1/aniloop_profiles?' + new URLSearchParams({id: 'eq.' + target}), {
        username: name,
      });
      return {ok: true};
    }
    throw new GameError('Unknown administrator action.');
  }
}
