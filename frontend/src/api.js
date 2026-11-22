const JSON_HEADERS = { 'Content-Type': 'application/json' };

// Basic auth token = base64("username:password"). Kept in memory; the App stores it in sessionStorage.
let token = null;
let onAuthLost = null;

export function setToken(value) {
  token = value;
}

export function setAuthLostHandler(fn) {
  onAuthLost = fn;
}

// UTF-8 safe base64 (btoa alone fails on non-Latin characters).
export function makeToken(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function authHeaders(extra = {}) {
  return token ? { ...extra, Authorization: `Basic ${token}` } : { ...extra };
}

async function request(path, options = {}) {
  const res = await fetch(`/api${path}`, { ...options, headers: authHeaders(options.headers || {}) });
  if (!res.ok) {
    // A protected call failing with 401 means the saved login is no longer valid.
    if (res.status === 401 && token && !path.startsWith('/auth/') && onAuthLost) onAuthLost();
    let message = `Lỗi ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data.detail === 'string') message = data.detail;
    } catch (e) { /* non-JSON error body */ }
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

export const register = (username, password) =>
  request('/auth/register', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ username, password }) });
export const login = () => request('/auth/login', { method: 'POST' });

export const getConfig = () => request('/config');
export const getTopics = () => request('/topics');
export const getDrills = () => request('/drills');
export const listSessions = () => request('/sessions');
export const createSession = (topicId) =>
  request('/sessions', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ topic_id: topicId }) });
export const getSession = (id) => request(`/sessions/${id}`);
export const deleteSession = (id) => request(`/sessions/${id}`, { method: 'DELETE' });
export const hasTurns = (id) => request(`/sessions/${id}/has-turns`);

export function postTurn(sessionId, text, audioBlob) {
  const form = new FormData();
  form.append('text', text);
  if (audioBlob) form.append('audio', audioBlob, 'turn.webm');
  return request(`/sessions/${sessionId}/turns`, { method: 'POST', body: form });
}

// <audio src> cannot send headers, so audio is fetched with auth and played from a blob URL.
export async function fetchAudioUrl(url) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Không tải được ghi âm (${res.status})`);
  return URL.createObjectURL(await res.blob());
}
