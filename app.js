const STORAGE = {
  settings: 'MUSEO_SPOTIFY_SETTINGS_V1',
  scenes: 'MUSEO_SPOTIFY_SCENES_V1',
  auth: 'MUSEO_SPOTIFY_AUTH_V1',
  oauth: 'MUSEO_SPOTIFY_OAUTH_V1',
  background: 'MUSEO_SPOTIFY_BACKGROUND_V1'
};

const SCOPES = [
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-modify-playback-state'
].join(' ');

const $ = (id) => document.getElementById(id);
const state = {
  settings: loadJSON(STORAGE.settings, { title: 'Botonera Museo', clientId: '' }),
  scenes: loadJSON(STORAGE.scenes, []),
  auth: loadJSON(STORAGE.auth, null),
  background: loadJSON(STORAGE.background, { context: '' }),
  devices: [],
  selectedDeviceId: '',
  playback: null,
  selectedSceneTrack: null,
  editMode: false,
  sceneTimer: null,
  fadeTimers: [],
  previousPlayback: null,
  activeSceneId: null,
  wakeLock: null,
  progressTimer: null
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function getRedirectUri() {
  return location.origin + location.pathname;
}

function toast(message, type = '') {
  const el = $('toast');
  el.textContent = message;
  el.className = `toast show ${type}`.trim();
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.className = 'toast'; }, 2800);
}

function formatMs(ms = 0) {
  ms = Math.max(0, Number(ms) || 0);
  const total = Math.floor(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function msFromInputs(minEl, secEl) {
  const min = Math.max(0, Number(minEl.value) || 0);
  const sec = Math.max(0, Number(secEl.value) || 0);
  return Math.round(min * 60000 + sec * 1000);
}

function setTimeInputs(ms, minEl, secEl) {
  ms = Math.max(0, Number(ms) || 0);
  minEl.value = Math.floor(ms / 60000);
  secEl.value = ((ms % 60000) / 1000).toFixed(1).replace(/\.0$/, '');
}

function extractSpotifyRef(value) {
  const v = (value || '').trim();
  let match = v.match(/^spotify:(track|playlist|album|artist):([A-Za-z0-9]+)$/i);
  if (match) return { type: match[1].toLowerCase(), id: match[2], uri: `spotify:${match[1].toLowerCase()}:${match[2]}` };
  match = v.match(/open\.spotify\.com\/(track|playlist|album|artist)\/([A-Za-z0-9]+)/i);
  if (match) return { type: match[1].toLowerCase(), id: match[2], uri: `spotify:${match[1].toLowerCase()}:${match[2]}` };
  return null;
}

function randomString(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}

async function sha256Base64Url(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function loginSpotify() {
  const clientId = ($('settingClientId').value || state.settings.clientId || '').trim();
  if (!clientId) return toast('Primero pegá tu Spotify Client ID.', 'error');
  state.settings.clientId = clientId;
  saveJSON(STORAGE.settings, state.settings);

  const verifier = randomString(96);
  const challenge = await sha256Base64Url(verifier);
  const oauthState = randomString(32);
  saveJSON(STORAGE.oauth, { verifier, state: oauthState, redirectUri: getRedirectUri() });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state: oauthState
  });
  location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

async function handleOAuthCallback() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  const error = params.get('error');
  if (error) {
    history.replaceState({}, '', getRedirectUri());
    toast(`Spotify: ${error}`, 'error');
    return;
  }
  if (!code) return;

  const oauth = loadJSON(STORAGE.oauth, null);
  if (!oauth || oauth.state !== returnedState) {
    history.replaceState({}, '', getRedirectUri());
    toast('No pude validar el inicio de sesión de Spotify.', 'error');
    return;
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: oauth.redirectUri,
    client_id: state.settings.clientId,
    code_verifier: oauth.verifier
  });

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await res.json();
  history.replaceState({}, '', getRedirectUri());
  if (!res.ok) return toast(data.error_description || 'No se pudo conectar con Spotify.', 'error');

  state.auth = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000) - 30000
  };
  saveJSON(STORAGE.auth, state.auth);
  localStorage.removeItem(STORAGE.oauth);
  updateConnectionUI();
  toast('Spotify conectado.');
}

async function refreshAccessToken() {
  if (!state.auth?.refreshToken || !state.settings.clientId) return false;
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: state.auth.refreshToken,
    client_id: state.settings.clientId
  });
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
  });
  const data = await res.json();
  if (!res.ok) return false;
  state.auth.accessToken = data.access_token;
  state.auth.expiresAt = Date.now() + (data.expires_in * 1000) - 30000;
  if (data.refresh_token) state.auth.refreshToken = data.refresh_token;
  saveJSON(STORAGE.auth, state.auth);
  return true;
}

async function getToken() {
  if (!state.auth?.accessToken) throw new Error('Spotify no está conectado.');
  if (Date.now() >= (state.auth.expiresAt || 0)) {
    const ok = await refreshAccessToken();
    if (!ok) {
      logoutSpotify(false);
      throw new Error('La sesión de Spotify venció. Volvé a conectarla.');
    }
  }
  return state.auth.accessToken;
}

async function spotifyApi(path, options = {}, retry = true) {
  const token = await getToken();
  const headers = { ...(options.headers || {}), Authorization: `Bearer ${token}` };
  if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const res = await fetch(`https://api.spotify.com/v1${path}`, { ...options, headers });
  if (res.status === 401 && retry && await refreshAccessToken()) return spotifyApi(path, options, false);
  if (!res.ok) {
    let message = `Spotify respondió ${res.status}`;
    try {
      const data = await res.json();
      message = data?.error?.message || data?.error_description || message;
    } catch {}
    if (res.status === 404) message = 'No hay un dispositivo Spotify activo. Abrí Spotify en la notebook y reproducí algo una vez.';
    if (res.status === 403) message = 'Spotify rechazó el control. Verificá Premium, permisos y el dispositivo elegido.';
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

function updateConnectionUI() {
  const connected = !!state.auth?.accessToken;
  $('spotifyStatus').className = `status-pill ${connected ? 'online' : 'offline'}`;
  $('spotifyStatus').innerHTML = `<span class="dot"></span> ${connected ? 'Spotify conectado' : 'Spotify desconectado'}`;
  $('btnSpotifyLogout').disabled = !connected;
  $('btnSpotifyLogin').textContent = connected ? 'Reconectar Spotify' : 'Conectar con Spotify';
}

function logoutSpotify(showToast = true) {
  state.auth = null;
  state.devices = [];
  state.selectedDeviceId = '';
  localStorage.removeItem(STORAGE.auth);
  updateConnectionUI();
  renderDevices();
  if (showToast) toast('Sesión de Spotify cerrada.');
}

async function loadDevices() {
  try {
    const data = await spotifyApi('/me/player/devices');
    state.devices = data.devices || [];
    const selectedStillExists = state.devices.some(d => d.id === state.selectedDeviceId);
    if (!selectedStillExists) {
      state.selectedDeviceId = state.devices.find(d => d.is_active)?.id || state.devices[0]?.id || '';
    }
    renderDevices();
    if (!state.devices.length) toast('No aparece ningún dispositivo. Abrí Spotify en la notebook.', 'error');
  } catch (e) { toast(e.message, 'error'); }
}

function renderDevices() {
  const select = $('deviceSelect');
  select.innerHTML = '';
  if (!state.devices.length) {
    const o = document.createElement('option');
    o.value = ''; o.textContent = 'Sin dispositivos';
    select.appendChild(o); return;
  }
  state.devices.forEach(d => {
    const o = document.createElement('option');
    o.value = d.id || '';
    o.textContent = `${d.name}${d.is_active ? ' • activo' : ''}${d.is_restricted ? ' • restringido' : ''}`;
    if (d.id === state.selectedDeviceId) o.selected = true;
    select.appendChild(o);
  });
}

function deviceQuery() {
  return state.selectedDeviceId ? `?device_id=${encodeURIComponent(state.selectedDeviceId)}` : '';
}

async function activateSelectedDevice(play = false) {
  if (!state.selectedDeviceId) throw new Error('Elegí la notebook en “Salida de audio”.');
  await spotifyApi('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [state.selectedDeviceId], play })
  });
}

async function refreshPlayback(silent = true) {
  if (!state.auth?.accessToken) return;
  try {
    const data = await spotifyApi('/me/player');
    state.playback = data;
    renderPlayback();
  } catch (e) { if (!silent) toast(e.message, 'error'); }
}

function renderPlayback() {
  const p = state.playback;
  if (!p?.item) {
    $('nowTitle').textContent = 'Sin reproducción';
    $('nowArtist').textContent = 'Elegí música de fondo o dispará una escena.';
    $('nowTime').textContent = '0:00';
    $('nowDuration').textContent = '0:00';
    $('progressFill').style.width = '0%';
    $('btnPlayPause').textContent = '▶';
    return;
  }
  $('nowTitle').textContent = p.item.name || 'Spotify';
  $('nowArtist').textContent = (p.item.artists || []).map(a => a.name).join(', ');
  $('nowTime').textContent = formatMs(p.progress_ms);
  $('nowDuration').textContent = formatMs(p.item.duration_ms);
  const pct = p.item.duration_ms ? Math.min(100, (p.progress_ms / p.item.duration_ms) * 100) : 0;
  $('progressFill').style.width = `${pct}%`;
  $('btnPlayPause').textContent = p.is_playing ? '❚❚' : '▶';
  $('btnShuffle').classList.toggle('active', !!p.shuffle_state);
  if (typeof p.device?.volume_percent === 'number') {
    $('volumeRange').value = p.device.volume_percent;
    $('volumeValue').textContent = `${p.device.volume_percent}%`;
  }
}

async function playTrack(uri, positionMs = 0) {
  if (!state.selectedDeviceId) await loadDevices();
  if (!state.selectedDeviceId) throw new Error('No encontré la notebook en Spotify Connect.');
  await spotifyApi(`/me/player/play${deviceQuery()}`, {
    method: 'PUT', body: JSON.stringify({ uris: [uri], position_ms: Math.max(0, positionMs || 0) })
  });
}

async function playContext(uri) {
  if (!state.selectedDeviceId) await loadDevices();
  if (!state.selectedDeviceId) throw new Error('No encontré la notebook en Spotify Connect.');
  await spotifyApi(`/me/player/play${deviceQuery()}`, {
    method: 'PUT', body: JSON.stringify({ context_uri: uri, position_ms: 0 })
  });
}

async function pausePlayback() {
  await spotifyApi(`/me/player/pause${deviceQuery()}`, { method: 'PUT' });
  clearSceneTimers();
}

async function togglePlayback() {
  try {
    await refreshPlayback(false);
    if (state.playback?.is_playing) await pausePlayback();
    else await spotifyApi(`/me/player/play${deviceQuery()}`, { method: 'PUT' });
    setTimeout(() => refreshPlayback(), 450);
  } catch (e) { toast(e.message, 'error'); }
}

async function skip(which) {
  try {
    const path = which === 'next' ? '/me/player/next' : '/me/player/previous';
    await spotifyApi(`${path}${deviceQuery()}`, { method: 'POST' });
    clearSceneTimers();
    state.activeSceneId = null;
    setTimeout(() => refreshPlayback(), 450);
  } catch (e) { toast(e.message, 'error'); }
}

async function toggleShuffle() {
  try {
    await refreshPlayback(false);
    const next = !state.playback?.shuffle_state;
    const q = new URLSearchParams({ state: String(next) });
    if (state.selectedDeviceId) q.set('device_id', state.selectedDeviceId);
    await spotifyApi(`/me/player/shuffle?${q}`, { method: 'PUT' });
    $('btnShuffle').classList.toggle('active', next);
  } catch (e) { toast(e.message, 'error'); }
}

let volumeDebounce;
function onVolumeInput() {
  const v = Number($('volumeRange').value);
  $('volumeValue').textContent = `${v}%`;
  clearTimeout(volumeDebounce);
  volumeDebounce = setTimeout(async () => {
    try {
      const q = new URLSearchParams({ volume_percent: String(v) });
      if (state.selectedDeviceId) q.set('device_id', state.selectedDeviceId);
      await spotifyApi(`/me/player/volume?${q}`, { method: 'PUT' });
    } catch (e) { toast(e.message, 'error'); }
  }, 180);
}

async function searchTracks(query, targetEl, mode = 'play') {
  query = (query || '').trim();
  if (!query) return;
  targetEl.innerHTML = '<div class="muted">Buscando…</div>';
  try {
    const data = await spotifyApi(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`);
    renderSearchResults(data.tracks?.items || [], targetEl, mode);
  } catch (e) {
    targetEl.innerHTML = '';
    toast(e.message, 'error');
  }
}

function renderSearchResults(items, targetEl, mode) {
  targetEl.innerHTML = '';
  if (!items.length) {
    targetEl.innerHTML = '<div class="muted">No encontré resultados.</div>';
    return;
  }
  items.forEach(track => {
    const row = document.createElement('div');
    row.className = 'result-row';
    const title = document.createElement('div');
    title.className = 'result-title';
    title.innerHTML = `<strong>${escapeHtml(track.name)}</strong><span>${escapeHtml((track.artists || []).map(a => a.name).join(', '))}</span>`;
    const main = document.createElement('button');
    main.className = 'result-action';
    main.textContent = mode === 'select' ? 'Elegir' : '▶';
    main.onclick = async () => {
      if (mode === 'select') {
        selectSceneTrack(track);
        targetEl.innerHTML = '';
      } else {
        try {
          state.previousPlayback = null;
          $('btnReturnBackground').disabled = true;
          clearSceneTimers();
          state.activeSceneId = null;
          await playTrack(track.uri, 0);
          setTimeout(() => refreshPlayback(), 450);
        } catch (e) { toast(e.message, 'error'); }
      }
    };
    row.append(title, main);
    if (mode === 'play') {
      const secondary = document.createElement('button');
      secondary.className = 'result-action secondary-action';
      secondary.textContent = '+ Escena';
      secondary.onclick = () => openSceneDialog(null, track);
      row.appendChild(secondary);
    }
    targetEl.appendChild(row);
  });
}

function escapeHtml(s = '') {
  return String(s).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
}

async function useTrackUrl() {
  const ref = extractSpotifyRef($('trackUrl').value);
  if (!ref || ref.type !== 'track') return toast('Pegá un enlace de canción de Spotify.', 'error');
  try {
    const track = await spotifyApi(`/tracks/${encodeURIComponent(ref.id)}`);
    selectSceneTrack(track);
  } catch (e) { toast(e.message, 'error'); }
}

function selectSceneTrack(track) {
  state.selectedSceneTrack = {
    uri: track.uri,
    id: track.id,
    name: track.name,
    artist: (track.artists || []).map(a => a.name).join(', '),
    durationMs: track.duration_ms || 0,
    spotifyUrl: track.external_urls?.spotify || ''
  };
  renderSelectedTrack();
}

function renderSelectedTrack() {
  const t = state.selectedSceneTrack;
  if (!t) {
    $('selectedTrack').className = 'selected-track muted';
    $('selectedTrack').textContent = 'Ninguna canción seleccionada.';
    return;
  }
  $('selectedTrack').className = 'selected-track';
  $('selectedTrack').innerHTML = `<strong>${escapeHtml(t.name)}</strong><br><span class="muted">${escapeHtml(t.artist)} · ${formatMs(t.durationMs)}</span>`;
}

async function captureNow() {
  try {
    const p = await spotifyApi('/me/player/currently-playing');
    if (!p?.item || p.item.type !== 'track') throw new Error('No hay una canción sonando en Spotify.');
    selectSceneTrack(p.item);
    setTimeInputs(p.progress_ms || 0, $('startMin'), $('startSec'));
    if (!$('sceneName').value.trim()) $('sceneName').value = p.item.name;
    toast(`Capturado en ${formatMs(p.progress_ms)}.`);
  } catch (e) { toast(e.message, 'error'); }
}

async function captureEndNow() {
  try {
    const p = await spotifyApi('/me/player/currently-playing');
    if (!p?.item || p.item.type !== 'track') throw new Error('No hay una canción sonando en Spotify.');
    if (state.selectedSceneTrack?.uri && state.selectedSceneTrack.uri !== p.item.uri) {
      throw new Error('El tema que está sonando no es el mismo que el de esta escena.');
    }
    if (!state.selectedSceneTrack) selectSceneTrack(p.item);
    $('autoStop').checked = true;
    toggleEndFields();
    setTimeInputs(p.progress_ms || 0, $('endMin'), $('endSec'));
    toast(`Final capturado en ${formatMs(p.progress_ms)}.`);
  } catch (e) { toast(e.message, 'error'); }
}

function openSceneDialog(scene = null, preselectedTrack = null) {
  $('sceneForm').reset();
  $('sceneId').value = scene?.id || '';
  $('sceneDialogTitle').textContent = scene ? 'Editar botón' : 'Nuevo botón';
  $('btnDeleteScene').classList.toggle('hidden', !scene);
  $('autoStop').checked = !!scene?.endMs;
  toggleEndFields();

  if (scene) {
    $('sceneName').value = scene.name;
    state.selectedSceneTrack = {
      uri: scene.trackUri,
      id: scene.trackId || extractSpotifyRef(scene.trackUri)?.id || '',
      name: scene.trackName || 'Canción guardada',
      artist: scene.artist || '',
      durationMs: scene.durationMs || 0,
      spotifyUrl: scene.spotifyUrl || ''
    };
    setTimeInputs(scene.startMs || 0, $('startMin'), $('startSec'));
    if (scene.endMs) setTimeInputs(scene.endMs, $('endMin'), $('endSec'));
    $('fadeSeconds').value = scene.fadeSeconds || 0;
  } else {
    $('sceneName').value = '';
    state.selectedSceneTrack = null;
    setTimeInputs(0, $('startMin'), $('startSec'));
    setTimeInputs(0, $('endMin'), $('endSec'));
    $('fadeSeconds').value = 0;
    if (preselectedTrack) selectSceneTrack(preselectedTrack);
  }
  $('sceneResults').innerHTML = '';
  $('trackUrl').value = '';
  renderSelectedTrack();
  $('sceneDialog').showModal();
}

function toggleEndFields() {
  const enabled = $('autoStop').checked;
  $('endFields').classList.toggle('hidden', !enabled);
  $('fadeRow').classList.toggle('hidden', !enabled);
}

function saveSceneFromForm(event) {
  event.preventDefault();
  const name = $('sceneName').value.trim();
  if (!name) return toast('Poné un nombre al botón.', 'error');
  if (!state.selectedSceneTrack?.uri) return toast('Elegí o capturá una canción.', 'error');

  const startMs = msFromInputs($('startMin'), $('startSec'));
  let endMs = null;
  if ($('autoStop').checked) {
    endMs = msFromInputs($('endMin'), $('endSec'));
    if (endMs <= startMs) return toast('El final tiene que estar después del inicio.', 'error');
  }

  const existingId = $('sceneId').value;
  const existingIndex = state.scenes.findIndex(s => s.id === existingId);
  const scene = {
    id: existingId || (crypto.randomUUID ? crypto.randomUUID() : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`),
    name,
    trackUri: state.selectedSceneTrack.uri,
    trackId: state.selectedSceneTrack.id,
    trackName: state.selectedSceneTrack.name,
    artist: state.selectedSceneTrack.artist,
    durationMs: state.selectedSceneTrack.durationMs,
    spotifyUrl: state.selectedSceneTrack.spotifyUrl,
    startMs,
    endMs,
    fadeSeconds: endMs ? Math.max(0, Math.min(10, Number($('fadeSeconds').value) || 0)) : 0
  };

  if (existingIndex >= 0) state.scenes[existingIndex] = scene;
  else state.scenes.push(scene);
  saveJSON(STORAGE.scenes, state.scenes);
  renderScenes();
  $('sceneDialog').close();
  toast(existingIndex >= 0 ? 'Botón actualizado.' : 'Botón agregado.');
}

function deleteCurrentScene() {
  const id = $('sceneId').value;
  if (!id) return;
  if (!confirm('¿Eliminar este botón?')) return;
  state.scenes = state.scenes.filter(s => s.id !== id);
  saveJSON(STORAGE.scenes, state.scenes);
  renderScenes();
  $('sceneDialog').close();
  toast('Botón eliminado.');
}

function moveScene(id, delta) {
  const i = state.scenes.findIndex(s => s.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= state.scenes.length) return;
  [state.scenes[i], state.scenes[j]] = [state.scenes[j], state.scenes[i]];
  saveJSON(STORAGE.scenes, state.scenes);
  renderScenes();
}

function renderScenes() {
  const grid = $('scenesGrid');
  grid.innerHTML = '';
  grid.classList.toggle('edit-mode', state.editMode);
  $('btnEditScenes').textContent = state.editMode ? 'Listo' : 'Editar';
  $('emptyScenes').classList.toggle('hidden', state.scenes.length > 0);

  state.scenes.forEach((scene, index) => {
    const card = document.createElement('div');
    card.className = `scene-card${state.activeSceneId === scene.id ? ' playing' : ''}`;
    const fire = document.createElement('button');
    fire.className = 'scene-fire';
    fire.disabled = state.editMode;
    fire.innerHTML = `
      <span class="scene-number">ESCENA ${String(index + 1).padStart(2, '0')}</span>
      <span class="scene-name">${escapeHtml(scene.name)}</span>
      <span class="scene-meta">${escapeHtml(scene.trackName || '')}<br>desde ${formatMs(scene.startMs)}${scene.endMs ? ` · hasta ${formatMs(scene.endMs)}` : ''}</span>`;
    fire.onclick = () => fireScene(scene);

    const controls = document.createElement('div');
    controls.className = 'scene-edit-controls';
    const up = document.createElement('button'); up.type = 'button'; up.textContent = '←'; up.title = 'Mover antes'; up.onclick = () => moveScene(scene.id, -1);
    const down = document.createElement('button'); down.type = 'button'; down.textContent = '→'; down.title = 'Mover después'; down.onclick = () => moveScene(scene.id, 1);
    const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = '✎'; edit.title = 'Editar'; edit.onclick = () => openSceneDialog(scene);
    controls.append(up, down, edit);
    card.append(fire, controls);
    grid.appendChild(card);
  });
}

async function snapshotCurrentPlayback() {
  try {
    const p = await spotifyApi('/me/player');
    if (!p?.item) return null;
    return {
      contextUri: p.context?.uri || null,
      itemUri: p.item.uri || null,
      progressMs: p.progress_ms || 0,
      wasPlaying: !!p.is_playing,
      shuffle: !!p.shuffle_state
    };
  } catch { return null; }
}

async function fireScene(scene) {
  try {
    await requestWakeLock();
    clearSceneTimers();
    const snap = await snapshotCurrentPlayback();
    if (snap?.itemUri && !state.activeSceneId) {
      state.previousPlayback = snap;
      $('btnReturnBackground').disabled = false;
    }
    await playTrack(scene.trackUri, scene.startMs || 0);
    state.activeSceneId = scene.id;
    renderScenes();
    toast(`${scene.name} · ${formatMs(scene.startMs)}`);
    scheduleSceneEnd(scene);
    setTimeout(() => refreshPlayback(), 500);
  } catch (e) { toast(e.message, 'error'); }
}

function clearSceneTimers() {
  if (state.sceneTimer) clearTimeout(state.sceneTimer);
  state.sceneTimer = null;
  state.fadeTimers.forEach(clearTimeout);
  state.fadeTimers = [];
}

function scheduleSceneEnd(scene) {
  if (!scene.endMs || scene.endMs <= scene.startMs) return;
  const total = scene.endMs - scene.startMs;
  const fadeMs = Math.min(total, Math.max(0, Number(scene.fadeSeconds || 0) * 1000));
  if (fadeMs > 0) {
    state.sceneTimer = setTimeout(() => fadeOutAndPause(fadeMs), Math.max(0, total - fadeMs));
  } else {
    state.sceneTimer = setTimeout(async () => {
      try { await pausePlayback(); } catch {}
      state.activeSceneId = null;
      renderScenes();
      toast('Escena finalizada.');
    }, total);
  }
}

async function fadeOutAndPause(durationMs) {
  let startVolume = Number($('volumeRange').value) || 75;
  try {
    await refreshPlayback();
    if (typeof state.playback?.device?.volume_percent === 'number') startVolume = state.playback.device.volume_percent;
  } catch {}
  const steps = Math.max(3, Math.min(12, Math.round(durationMs / 350)));
  for (let i = 1; i <= steps; i++) {
    const t = setTimeout(async () => {
      const vol = Math.max(0, Math.round(startVolume * (1 - i / steps)));
      try {
        const q = new URLSearchParams({ volume_percent: String(vol) });
        if (state.selectedDeviceId) q.set('device_id', state.selectedDeviceId);
        await spotifyApi(`/me/player/volume?${q}`, { method: 'PUT' });
        $('volumeRange').value = vol;
        $('volumeValue').textContent = `${vol}%`;
        if (i === steps) {
          await pausePlayback();
          const restoreQ = new URLSearchParams({ volume_percent: String(startVolume) });
          if (state.selectedDeviceId) restoreQ.set('device_id', state.selectedDeviceId);
          setTimeout(async () => {
            try {
              await spotifyApi(`/me/player/volume?${restoreQ}`, { method: 'PUT' });
              $('volumeRange').value = startVolume;
              $('volumeValue').textContent = `${startVolume}%`;
            } catch {}
          }, 350);
          state.activeSceneId = null;
          renderScenes();
          toast('Escena finalizada.');
        }
      } catch {}
    }, Math.round((durationMs / steps) * i));
    state.fadeTimers.push(t);
  }
}

async function returnToBackground() {
  const p = state.previousPlayback;
  if (!p?.itemUri) return;
  try {
    clearSceneTimers();
    if (p.contextUri) {
      await spotifyApi(`/me/player/play${deviceQuery()}`, {
        method: 'PUT',
        body: JSON.stringify({ context_uri: p.contextUri, offset: { uri: p.itemUri }, position_ms: p.progressMs || 0 })
      });
    } else {
      await playTrack(p.itemUri, p.progressMs || 0);
    }
    const q = new URLSearchParams({ state: String(!!p.shuffle) });
    if (state.selectedDeviceId) q.set('device_id', state.selectedDeviceId);
    spotifyApi(`/me/player/shuffle?${q}`, { method: 'PUT' }).catch(() => {});
    state.previousPlayback = null;
    state.activeSceneId = null;
    $('btnReturnBackground').disabled = true;
    renderScenes();
    setTimeout(() => refreshPlayback(), 450);
    toast('Volvimos a la música de fondo.');
  } catch (e) { toast(e.message, 'error'); }
}

async function startBackground() {
  const value = $('backgroundContext').value.trim();
  const ref = extractSpotifyRef(value);
  if (!ref || !['playlist','album','artist'].includes(ref.type)) return toast('Pegá una playlist, álbum o artista de Spotify.', 'error');
  try {
    state.previousPlayback = null;
    state.activeSceneId = null;
    $('btnReturnBackground').disabled = true;
    clearSceneTimers();
    await playContext(ref.uri);
    setTimeout(() => refreshPlayback(), 450);
  } catch (e) { toast(e.message, 'error'); }
}

function saveBackground() {
  state.background.context = $('backgroundContext').value.trim();
  saveJSON(STORAGE.background, state.background);
  toast('Música de fondo guardada.');
}

async function stopAll() {
  try {
    await pausePlayback();
    state.activeSceneId = null;
    renderScenes();
    setTimeout(() => refreshPlayback(), 300);
  } catch (e) { toast(e.message, 'error'); }
}

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (!state.wakeLock || state.wakeLock.released) state.wakeLock = await navigator.wakeLock.request('screen');
  } catch {}
}

function openSettings() {
  $('settingTitle').value = state.settings.title || 'Botonera Museo';
  $('settingClientId').value = state.settings.clientId || '';
  $('redirectUriText').textContent = getRedirectUri();
  $('settingsDialog').showModal();
}

function saveSettings(event) {
  event.preventDefault();
  state.settings.title = $('settingTitle').value.trim() || 'Botonera Museo';
  state.settings.clientId = $('settingClientId').value.trim();
  saveJSON(STORAGE.settings, state.settings);
  $('appTitle').textContent = state.settings.title;
  $('settingsDialog').close();
  toast('Configuración guardada.');
}

function exportBackup() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    title: state.settings.title,
    background: state.background,
    scenes: state.scenes
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `botonera-museo-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function importBackup(file) {
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.scenes)) throw new Error('Archivo inválido.');
    if (!confirm(`¿Importar ${data.scenes.length} botones? Reemplazará los actuales.`)) return;
    state.scenes = data.scenes;
    state.background = data.background || { context: '' };
    if (data.title) state.settings.title = data.title;
    saveJSON(STORAGE.scenes, state.scenes);
    saveJSON(STORAGE.background, state.background);
    saveJSON(STORAGE.settings, state.settings);
    $('backgroundContext').value = state.background.context || '';
    $('appTitle').textContent = state.settings.title;
    renderScenes();
    toast('Backup importado.');
  } catch (e) { toast(e.message, 'error'); }
}

function bindEvents() {
  $('btnSettings').onclick = openSettings;
  $('btnCloseSettings').onclick = () => $('settingsDialog').close();
  $('settingsForm').onsubmit = saveSettings;
  $('btnSpotifyLogin').onclick = loginSpotify;
  $('btnSpotifyLogout').onclick = () => logoutSpotify(true);
  $('btnCopyRedirect').onclick = async () => {
    await navigator.clipboard.writeText(getRedirectUri());
    toast('Redirect URI copiada.');
  };
  $('btnExport').onclick = exportBackup;
  $('importFile').onchange = e => importBackup(e.target.files?.[0]);

  $('deviceSelect').onchange = e => { state.selectedDeviceId = e.target.value; };
  $('btnRefreshDevices').onclick = loadDevices;
  $('btnPrev').onclick = () => skip('previous');
  $('btnNext').onclick = () => skip('next');
  $('btnPlayPause').onclick = togglePlayback;
  $('btnShuffle').onclick = toggleShuffle;
  $('btnStopAll').onclick = stopAll;
  $('btnReturnBackground').onclick = returnToBackground;
  $('volumeRange').oninput = onVolumeInput;
  $('btnSaveBackground').onclick = saveBackground;
  $('btnStartBackground').onclick = startBackground;

  $('btnGlobalSearch').onclick = () => searchTracks($('globalSearch').value, $('globalResults'), 'play');
  $('globalSearch').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('btnGlobalSearch').click(); } };

  $('btnAddScene').onclick = () => openSceneDialog();
  $('btnEditScenes').onclick = () => { state.editMode = !state.editMode; renderScenes(); };
  $('btnCloseScene').onclick = () => $('sceneDialog').close();
  $('btnCancelScene').onclick = () => $('sceneDialog').close();
  $('sceneForm').onsubmit = saveSceneFromForm;
  $('btnDeleteScene').onclick = deleteCurrentScene;
  $('btnCaptureNow').onclick = captureNow;
  $('btnCaptureEnd').onclick = captureEndNow;
  $('autoStop').onchange = toggleEndFields;
  $('btnUseTrackUrl').onclick = useTrackUrl;
  $('btnSceneSearch').onclick = () => searchTracks($('sceneSearch').value, $('sceneResults'), 'select');
  $('sceneSearch').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('btnSceneSearch').click(); } };

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      requestWakeLock();
      refreshPlayback();
    }
  });
}

async function init() {
  bindEvents();
  $('appTitle').textContent = state.settings.title || 'Botonera Museo';
  $('backgroundContext').value = state.background.context || '';
  $('redirectUriText').textContent = getRedirectUri();
  updateConnectionUI();
  renderScenes();
  await handleOAuthCallback();
  if (state.auth?.accessToken) {
    await loadDevices();
    await refreshPlayback();
  }
  requestWakeLock();
  state.progressTimer = setInterval(() => {
    if (state.auth?.accessToken && document.visibilityState === 'visible') refreshPlayback(true);
  }, 4000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
