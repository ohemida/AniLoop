import {CATEGORIES, totalScore} from './core.js';
import {FRAMES} from './assets/appearance.js';
import {avatarMarkup} from './assets/friends-ui.js';
export function createSocial(ctx) {
  const {esc, button: btn, fmt} = ctx;
  let room = null,
    rewards = null,
    poll = null,
    pollBusy = false,
    busy = false,
    rewardBusy = false,
    joinDraft = '',
    local = {frame: 0, music: 'audio'},
    error = '',
    rewardError = '';
  const active = () => ctx.getView() === 'room' && room?.session;
  const fire =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2c1 6-5 6-3 11 1-3 3-3 4-5 5 4 6 7 4 11-3 5-11 3-12-2-1-4 1-7 4-9-1 4 0 5 1 5-1-4 3-6 2-11Z" fill="currentColor"/></svg>';
  const frameClass = () =>
    rewards?.equipped && rewards.equipped !== 'classic' && FRAMES.some((f) => f.id === rewards.equipped)
      ? 'frame-' + rewards.equipped
      : '';
  function streakMarkup() {
    return `<span class="streak-flame">${fire}</span><strong>${rewards?.streak || 0}</strong><span>day streak</span>`;
  }
  function sidebar() {
    return `<button type="button" class="daily-sidebar" data-action="rewards"><span>${streakMarkup()}</span><span class="shard-balance">◇ ${fmt(rewards?.balance || 0)}</span></button>`;
  }
  function daysMarkup() {
    const today = rewards?.today || new Date().toISOString().slice(0, 10),
      date = new Date(today + 'T12:00:00Z');
    return Array.from({length: 7}, (_, i) => {
      const d = new Date(date);
      d.setUTCDate(d.getUTCDate() - 6 + i);
      const key = d.toISOString().slice(0, 10),
        claimed = rewards?.history.some((h) => h.day === key);
      return `<div class="daily-day ${claimed ? 'claimed' : ''} ${i === 6 ? 'today' : ''}"><span>${d.toLocaleDateString('en-US', {weekday: 'short', timeZone: 'UTC'})}</span><strong>${claimed ? '✓' : i === 6 ? '◇' : '·'}</strong><small>${d.getUTCDate()}</small></div>`;
    }).join('');
  }
  function claimButton() {
    const ready = ctx.soloDaily()?.games && CATEGORIES.every((c) => ctx.soloDaily().games[c.id].done);
    return !ctx.user()
      ? btn('login', 'Sign in to earn shards', 'btn secondary')
      : rewards?.claimedToday
        ? '<span class="reward-claimed">✓ Daily reward claimed</span>'
        : ready
          ? btn('social:claim', 'Claim daily reward')
          : btn('social:play-daily', 'Play the daily quiz');
  }
  function dailyPanel() {
    return `<section class="daily-panel" aria-label="Daily streak and rewards"><div class="daily-streak"><div class="streak-ring">${fire}<strong>${rewards?.streak || 0}</strong></div><div><span class="mode-label">Keep your loop alive</span><h2>${rewards?.streak ? 'A little anime, every day.' : 'Your next daily starts a streak.'}</h2><p>Finish all five daily categories and claim <strong>100 Loop Shards</strong> to grow your streak. Every seventh streak day earns 50 extra.</p></div></div><div class="daily-calendar">${daysMarkup()}</div><div class="daily-panel-actions">${claimButton()}${btn('rewards', 'View rewards', 'btn ghost small')}</div><span class="daily-reset">Rewards reset at 00:00 UTC · Cosmetic rewards only</span></section>`;
  }
  function rewardsView() {
    return `<section class="community-intro"><span class="mode-label">Daily rewards</span><h1>Make every day a loop.</h1><p>Build your streak, collect Loop Shards, and unlock profile frames. Shards never buy points, extra guesses, or team hints.</p></section>${dailyPanel()}${rewardError ? `<p class="media-error" role="alert">${esc(rewardError)}</p>` : ''}<section class="reward-milestones"><div class="section-top"><h2>Your streak milestones</h2><p>Best streak: ${rewards?.bestStreak || 0} days</p></div><div class="milestone-grid">${(
      rewards?.milestones || [
        {days: 3, name: 'First spark'},
        {days: 7, name: 'Weekly regular'},
        {days: 14, name: 'Unbroken loop'},
        {days: 30, name: 'Daily devotee'},
      ]
    )
      .map(
        (m) =>
          `<article class="milestone ${m.unlocked ? 'earned' : ''}"><span>${m.unlocked ? '✦' : '◇'}</span><strong>${m.days} days</strong><h3>${esc(m.name)}</h3><small>${m.unlocked ? 'Badge earned' : 'Keep your daily streak going'}</small></article>`,
      )
      .join('')}</div></section>${ctx.appearanceTeaser()}`;
  }
  function roster() {
    if (!room) return '';
    return `<div class="room-players">${room.players.map((player) => `<div class="room-player ${player.id === ctx.user()?.id ? 'self' : ''}">${avatarMarkup(player.username, player.pictureUrl, esc, player.frame)}<span><strong>${esc(player.username)}</strong><small>${player.host ? 'Host' : player.id === ctx.user()?.id ? 'You' : 'Player'}${room.phase === 'playing' ? ' · ' + (player.ready ? 'Finished' : 'Thinking…') : ''}</small></span>${room.mode === 'party' ? `<b>${fmt(player.score)}</b>` : ''}${room.hostId === ctx.user()?.id && player.id !== ctx.user()?.id ? btn('social:kick:' + player.id, '×', 'remove-player', 'aria-label="Remove ' + esc(player.username) + '"') : ''}</div>`).join('')}</div>`;
  }
  function controls() {
    if (!room) return '';
    const host = room.hostId === ctx.user()?.id;
    if (room.phase === 'lobby')
      return host
        ? btn('social:start', 'Start together', 'btn', room.players.length < 2 ? 'disabled' : '')
        : '<p class="subtle">Waiting for the host to start.</p>';
    if (room.phase === 'complete')
      return host
        ? btn('social:next-loop', 'Start the next loop')
        : '<p class="subtle">Waiting for the host to start the next loop.</p>';
    return host
      ? btn(
          'social:next',
          room.step === room.totalSteps - 1 ? 'Finish this loop' : 'Next shared question',
          'btn',
          room.allReady ? '' : 'disabled',
        )
      : `<p class="subtle">${room.allReady ? 'Everyone is ready. Waiting for the host.' : 'Finish your answer, then wait for the host.'}</p>`;
  }
  function roomsView() {
    return `<section class="community-intro"><span class="mode-label">Better in a party</span><h1>Same anime. Your people.</h1><p>Create a private room, share its code, and play synchronized questions with up to eight players. Everyone needs an AniLoop account and the same hosted server.</p></section>${error ? `<p class="media-error" role="alert">${esc(error)}</p>` : ''}${room ? `<section class="room-resume panel"><div><span class="mode-label">Your active room</span><h2>${esc(room.code)} · ${room.mode === 'coop' ? 'Co-op Infinity' : 'Party'}</h2><p class="subtle">${room.players.length} players · Loop ${room.loop}</p></div><div class="hero-actions">${btn('social:resume', 'Return to room')}${btn('social:leave', 'Leave room', 'btn ghost')}</div></section>` : `<div class="room-create-grid"><article class="room-mode-card"><span class="room-mode-symbol">♧</span><h2>Party room</h2><p>Identical questions, individual answers and scores. The host advances once everyone finishes.</p>${ctx.user() ? btn('social:create:party', 'Create party room') : btn('login', 'Sign in to create a room')}</article><article class="room-mode-card coop"><span class="room-mode-symbol">∞</span><h2>Co-op Infinity</h2><p>One team, one score, five categories. Share eight hints per full loop, then take on a new round together.</p>${ctx.user() ? btn('social:create:coop', 'Create co-op room') : btn('login', 'Sign in to play co-op')}</article></div><form class="room-join panel" data-social-form="join"><div class="field"><label for="room-code">Have a room code?</label><input id="room-code" name="code" minlength="6" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="ABC234" value="${esc(joinDraft || new URLSearchParams(location.search).get('room') || '')}" required></div><button class="btn secondary" type="submit">Join room</button><p class="subtle">Rooms expire after 24 hours without game activity. Join before the host starts.</p></form>`}`;
  }
  function roomView() {
    if (!room) return roomsView();
    const category = CATEGORIES.find((c) => c.id === room.category),
      g = room.session?.games[room.category];
    return `<div class="room-heading"><div><span class="mode-label">${room.mode === 'coop' ? 'Co-op Infinity · 8 shared hints' : 'Party · individual scores'}</span><h1>Your room, in sync.</h1><div class="room-code-line"><code>${esc(room.code)}</code>${btn('social:copy', 'Copy invite', 'btn ghost small')}<span class="subtle">Loop ${room.loop} · ${room.players.length}/8 players</span></div></div>${btn('social:leave', 'Leave room', 'btn ghost small')}</div><div class="room-layout"><aside class="room-team-panel"><h2>${room.mode === 'coop' ? 'Your team' : 'Your party'}</h2><div class="room-roster">${roster()}</div><div class="room-scoreboard">${room.mode === 'coop' ? `<div class="team-total"><span>Team score</span><strong>${fmt(room.session ? totalScore(room.session) : 0)}</strong></div><div class="team-hints"><span>Shared hints</span><strong>${room.hintsRemaining} / 8</strong></div>` : '<p class="subtle">Scores are calculated by the room server.</p>'}</div><div class="room-host-controls">${controls()}</div><p class="subtle room-sync">Updates every 1.5 seconds. Reconnect with this account to resume.</p></aside><section class="room-stage">${room.phase === 'lobby' ? `<div class="room-lobby"><div class="lobby-orbits"><span>∞</span><i></i><i></i></div><h2>Gather your party.</h2><p>Share <strong>${esc(room.code)}</strong> with your friends. The host can start when at least two players have joined.</p><p class="subtle">${room.mode === 'coop' ? 'Anyone can answer for the team. Hints and answers update for everyone.' : 'Everyone answers the same questions separately. Answers stay hidden until you submit.'}</p></div>` : room.phase === 'complete' ? `<div class="room-complete"><span class="mode-label">All five categories complete</span><h2>Another loop, together.</h2><strong class="room-final-score">${fmt(room.mode === 'coop' ? totalScore(room.session) : Math.max(...room.players.map((p) => p.score)))}</strong><p>${room.mode === 'coop' ? 'Team score' : 'Highest party score'} · ${room.mode === 'coop' ? 8 - room.hintsRemaining + ' of 8 hints used' : 'Final results are shown in your party panel.'}</p><div class="room-host-controls">${controls()}</div></div>` : `<div class="room-question-heading"><div><span class="mode-label">Shared question ${room.step + 1} / ${room.totalSteps}</span><h2>${esc(category.name)} · ${room.questionIndex + 1} / ${room.category === 'anidle' ? 1 : 3}</h2></div><span class="difficulty ${String(g.levels[g.index]).toLowerCase()}">${esc(g.levels[g.index])}</span></div>${room.mode === 'coop' && room.hintsRemaining === 0 ? '<p class="hint-budget-note">No team hints left this loop. Previously unlocked clues remain available.</p>' : ''}<div class="game-panel room-game-panel">${ctx.views[room.category](g)}${room.ready ? `<div class="result room-result" role="status"><strong>${room.mode === 'coop' ? 'Team answer recorded' : 'Your answer is recorded'}</strong><div class="result-score">${fmt(g.scores[g.index])} points</div>${room.category !== 'character' ? `<p>The answer: <strong>${ctx.titleMarkup(ctx.anime(g.questions[g.index]))}</strong></p>` : ''}<p class="subtle">${room.mode === 'coop' ? 'The host can move your team to the next question.' : 'Waiting for the other players and the host.'}</p></div>` : ''}</div>`}</section></div>`;
  }
  function applyLocal(data) {
    if (!data?.session) return;
    const g = data.session.games[data.category];
    g.activeFrame = local.frame;
    g.musicMode = local.music;
  }
  function renderPreserving(sameStep) {
    const mediaBefore = sameStep
      ? [...ctx.app.querySelectorAll('audio,video')].map((media) => ({
          tag: media.tagName,
          src: media.getAttribute('src'),
          time: media.currentTime,
          paused: media.paused,
          volume: media.volume,
        }))
      : [];
    const fields = sameStep
      ? [...ctx.app.querySelectorAll('form input:not([type=password])')].map((input) => ({
          id: input.id,
          value: input.value,
          focused: document.activeElement === input,
          start: input.selectionStart,
        }))
      : [];
    ctx.render();
    for (const field of fields) {
      const input = document.getElementById(field.id);
      if (input) {
        input.value = field.value;
        if (field.focused) {
          input.focus({preventScroll: true});
          if (input.type === 'text' && field.start !== null) input.setSelectionRange(field.start, field.start);
        }
      }
    }
    for (const before of mediaBefore) {
      const media = ctx.app.querySelector(before.tag.toLowerCase());
      if (!media) continue;
      const restore = () =>
        queueMicrotask(() => {
          if (!media.isConnected || media.getAttribute('src') !== before.src) return;
          media.volume = before.volume;
          if (Number.isFinite(media.duration)) media.currentTime = Math.min(before.time, media.duration);
          if (!before.paused) media.play().catch(() => {});
        });
      if (media.readyState >= 1) restore();
      else media.addEventListener('loadedmetadata', restore, {once: true});
    }
    disableHints();
  }
  function disableHints() {
    if (active() && room.mode === 'coop' && room.hintsRemaining === 0)
      ctx.app.querySelectorAll('[data-action^="hint:"]').forEach((button) => {
        button.disabled = true;
      });
  }
  function setRoom(data, force = false) {
    if (data && room?.code === data.code && data.revision < room.revision) return;
    const old = room,
      sameStep = old?.code === data?.code && old?.step === data?.step && old?.loop === data?.loop;
    if (!sameStep) local = {frame: 0, music: 'audio'};
    applyLocal(data);
    room = data;
    if (ctx.getView() === 'room' && data?.category) ctx.select(data.category);
    if (ctx.getView() === 'room') {
      if (!data) {
        ctx.go('rooms');
        return;
      }
      const unchanged =
        !force && sameStep && old?.phase === data.phase && JSON.stringify(old.session) === JSON.stringify(data.session);
      if (unchanged) {
        ctx.app.querySelectorAll('.room-roster').forEach((el) => (el.innerHTML = roster()));
        ctx.app.querySelectorAll('.room-host-controls').forEach((el) => (el.innerHTML = controls()));
      } else renderPreserving(sameStep);
    } else if (ctx.getView() === 'rooms') ctx.render();
  }
  function startPoll() {
    clearInterval(poll);
    poll = setInterval(async () => {
      if (!ctx.user() || !room || !['rooms', 'room'].includes(ctx.getView()) || pollBusy || busy) return;
      pollBusy = true;
      const code = room.code;
      try {
        const data = await ctx.api('/api/rooms/view?code=' + code);
        if (room?.code === code) {
          setRoom(data.room);
          const note = ctx.app.querySelector('.room-sync');
          if (note) note.textContent = 'Updates every 1.5 seconds. Reconnect with this account to resume.';
        }
      } catch (cause) {
        if (cause.message.includes('Join this room') || cause.message.includes('expired')) {
          room = null;
          ctx.go('rooms');
        }
        error = cause.message;
        const note = ctx.app.querySelector('.room-sync');
        if (note) note.textContent = 'Connection interrupted. Retrying automatically…';
      } finally {
        pollBusy = false;
      }
    }, 1500);
  }
  async function refresh() {
    if (!ctx.user()) {
      clear();
      return;
    }
    const results = await Promise.allSettled([ctx.api('/api/rewards'), ctx.api('/api/rooms/current')]);
    if (results[0].status === 'fulfilled') {
      rewards = results[0].value.rewards;
      rewardError = '';
    } else rewardError = results[0].reason.message;
    if (results[1].status === 'fulfilled') {
      room = results[1].value.room;
      startPoll();
    } else error = results[1].reason.message;
  }
  async function mutate(action, extra = {}) {
    if (busy) return;
    busy = true;
    const snapshot = room;
    try {
      const data = await ctx.api('/api/rooms/action', {
        code: snapshot.code,
        revision: snapshot.revision,
        turn: snapshot.turn,
        action,
        ...extra,
      });
      setRoom(data.room, true);
    } catch (cause) {
      try {
        setRoom((await ctx.api('/api/rooms/view?code=' + snapshot.code)).room);
      } catch {}
      throw cause;
    } finally {
      busy = false;
    }
  }
  async function action(name) {
    if (name === 'rooms') {
      ctx.go('rooms');
      if (ctx.user()) {
        await refresh();
        ctx.render();
      }
      return true;
    }
    if (name === 'rewards') {
      ctx.go('rewards');
      if (ctx.user()) {
        await refresh();
        ctx.render();
      }
      return true;
    }
    if (name.startsWith('social:')) {
      const parts = name.split(':'),
        operation = parts[1];
      if (operation === 'play-daily') {
        ctx.playDaily();
        return true;
      }
      if (!ctx.user()) {
        ctx.login();
        return true;
      }
      if (operation === 'create') {
        const result = await ctx.api('/api/rooms/create', {mode: parts[2]});
        room = result.room;
        error = '';
        ctx.go('room');
        startPoll();
      }
      if (operation === 'resume') {
        applyLocal(room);
        if (room?.category) ctx.select(room.category);
        ctx.go('room');
        startPoll();
      }
      if (operation === 'leave') {
        await mutate('leave');
        ctx.go('rooms');
      }
      if (['start', 'next', 'next-loop'].includes(operation)) await mutate(operation);
      if (operation === 'kick')
        await mutate('kick', {userId: /^[0-9a-f-]{36}$/i.test(parts[2]) ? parts[2] : Number(parts[2])});
      if (operation === 'copy') {
        const invite = location.origin + location.pathname + '?room=' + room.code;
        try {
          await navigator.clipboard.writeText(invite);
          ctx.toast('Invite link copied.');
        } catch {
          ctx.toast('Room code: ' + room.code);
        }
      }
      if (operation === 'claim') {
        const result = await ctx.api('/api/rewards/claim', {round: ctx.soloDaily()});
        rewards = result.rewards;
        ctx.render();
        ctx.toast('Daily claimed: +' + result.earned + ' Loop Shards.');
      }
      if (operation === 'buy' || operation === 'equip') {
        const result = await ctx.api('/api/rewards/' + operation, {item: parts[2]});
        rewards = result.rewards;
        ctx.render();
        ctx.toast(operation === 'buy' ? 'Frame unlocked and equipped.' : 'Profile frame equipped.');
      }
      return true;
    }
    if (!active()) return false;
    if (name.startsWith('play:')) {
      ctx.toast('Your room follows the host’s shared question. Leave the room view to play solo.');
      return true;
    }
    if (name.startsWith('hint:')) {
      const n = Number(name.split(':')[1]);
      if (room.category === 'screenshot' && n < 3) local.frame = n;
      if (['opening', 'ending'].includes(room.category)) local.music = 'video';
      await mutate('hint', {number: n});
      return true;
    }
    if (name.startsWith('view-frame:')) {
      const n = Number(name.split(':')[1]);
      if (n === 0 || room.session.games.screenshot.hints.includes(n)) {
        local.frame = n;
        applyLocal(room);
        renderPreserving(true);
      }
      return true;
    }
    if (name.startsWith('music-mode:')) {
      const mode = name.split(':')[1];
      if (mode === 'audio' || room.session.games[room.category].hints.length) {
        local.music = mode;
        applyLocal(room);
        renderPreserving(true);
      }
      return true;
    }
    if (name === 'giveup') {
      await mutate('giveup');
      return true;
    }
    if (name === 'skip-anidle') {
      await mutate('skip');
      return true;
    }
    if (name === 'continue' || name === 'next') {
      await mutate(name === 'next' ? 'next-loop' : 'next');
      return true;
    }
    return false;
  }
  async function submit(form) {
    const data = new FormData(form);
    if (form.dataset.socialForm === 'join') {
      joinDraft = String(data.get('code') || '')
        .trim()
        .toUpperCase();
      if (!ctx.user()) {
        ctx.login();
        return;
      }
      const result = await ctx.api('/api/rooms/join', {code: data.get('code')});
      room = result.room;
      if (room.category) ctx.select(room.category);
      applyLocal(room);
      ctx.go('room');
      startPoll();
    }
  }
  async function answer(form) {
    const data = new FormData(form);
    if (room.category === 'character')
      await mutate('answer', {
        entries: Array.from({length: 4}, (_, i) => ({
          characterValue: String(data.get('character-' + i) || ''),
          animeValue: String(data.get('anime-' + i) || ''),
        })),
      });
    else {
      await mutate('answer', {value: String(data.get('answer') || '')});
      if (room?.category === 'anidle' && !room.ready) {
        const input = document.getElementById('answer');
        if (input) {
          input.value = '';
          input.focus();
        }
      }
    }
  }
  function clear() {
    clearInterval(poll);
    room = null;
    rewards = null;
    error = '';
    rewardError = '';
  }
  async function tick() {
    if (!ctx.user() || !rewards || rewards.today === new Date().toISOString().slice(0, 10) || rewardBusy) return;
    rewardBusy = true;
    try {
      rewards = (await ctx.api('/api/rewards')).rewards;
      if (['home', 'rewards'].includes(ctx.getView())) ctx.render();
      else {
        const panel = ctx.app.querySelector('.daily-sidebar');
        if (panel) panel.outerHTML = sidebar();
      }
    } catch {
    } finally {
      rewardBusy = false;
    }
  }
  function boot() {
    if (new URLSearchParams(location.search).has('room')) ctx.go('rooms');
  }
  return {
    get rewards() {
      return rewards;
    },
    setRewards: (value) => {
      rewards = value;
    },
    get active() {
      return active();
    },
    get session() {
      return room?.session;
    },
    get room() {
      return room;
    },
    view: (name) => (name === 'room' ? roomView() : name === 'rooms' ? roomsView() : rewardsView()),
    isView: (name) => ['rooms', 'room', 'rewards'].includes(name),
    refresh,
    action,
    submit,
    answer,
    dailyPanel,
    sidebar,
    frameClass,
    clear,
    boot,
    tick,
  };
}
