import { useEffect, useState } from 'react';
import { createSession, getConfig, getTopics, login, setAuthLostHandler, setToken } from './api';
import { englishVoices, speak } from './speech';
import AuthView from './components/AuthView';
import ChatView from './components/ChatView';
import PracticeView from './components/PracticeView';
import HistoryView from './components/HistoryView';
import DrillView from './components/DrillView';
import Mascot from './components/Mascot';

const AUTH_KEY = 'speakbot.auth';
const PREFS_KEY = 'speakbot.prefs.v2';

// "Ghi nhớ" stores the login in localStorage (survives closing the browser).
// Otherwise it lives in sessionStorage (this tab only).
function loadAuth() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const saved = JSON.parse(store.getItem(AUTH_KEY) || 'null');
      if (saved) return saved;
    } catch (e) { /* storage blocked */ }
  }
  return null;
}

function saveAuth(value, remember = false) {
  try {
    localStorage.removeItem(AUTH_KEY);
    sessionStorage.removeItem(AUTH_KEY);
    if (value) (remember ? localStorage : sessionStorage).setItem(AUTH_KEY, JSON.stringify(value));
  } catch (e) { /* storage blocked: user logs in again after reload */ }
}

export default function App() {
  const [auth, setAuth] = useState(null); // { username, token }
  const [checking, setChecking] = useState(true);

  function logout() {
    setToken(null);
    saveAuth(null);
    setAuth(null);
  }

  useEffect(() => {
    setAuthLostHandler(logout);
    const saved = loadAuth();
    if (!saved || !saved.token) {
      setChecking(false);
      return;
    }
    // Re-check the saved login once, so an old or changed password does not leave a broken session.
    setToken(saved.token);
    login()
      .then((me) => setAuth({ username: me.username, token: saved.token }))
      .catch(() => {
        setToken(null);
        saveAuth(null);
      })
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) return <div className="auth"><p className="muted">Đang kiểm tra đăng nhập...</p></div>;

  if (!auth) {
    return (
      <AuthView
        onAuthed={(a, remember) => {
          saveAuth(a, remember);
          setAuth(a);
        }}
      />
    );
  }

  return <Workspace key={auth.username} username={auth.username} onLogout={logout} />;
}

function Workspace({ username, onLogout }) {
  const [prefs, setPrefs] = useState(loadPrefs);
  const [topics, setTopics] = useState([]);
  const [config, setConfig] = useState(null);
  const [voices, setVoices] = useState([]);
  const [tab, setTab] = useState('chat');
  const [sessionId, setSessionId] = useState(null);
  const [fresh, setFresh] = useState(false);
  const [error, setError] = useState('');

  const update = (patch) => setPrefs((p) => {
    const next = { ...p, ...patch };
    savePrefs(next);
    return next;
  });

  useEffect(() => {
    getTopics().then(setTopics).catch((e) => setError(`Không tải được chủ đề: ${e.message}`));
    getConfig().then(setConfig).catch(() => setConfig({ ai_enabled: false, model: '' }));
    const loadVoices = () => setVoices(englishVoices());
    loadVoices();
    if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // First load: start a conversation on the remembered topic (or the first one).
  useEffect(() => {
    if (!topics.length || sessionId !== null) return;
    const topicId = topics.some((t) => t.id === prefs.topicId) ? prefs.topicId : topics[0].id;
    update({ topicId });
    newChat(topicId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics]);

  async function newChat(topicId) {
    setError('');
    try {
      const s = await createSession(topicId);
      setSessionId(s.id);
      setFresh(true);
      setTab('chat');
    } catch (e) {
      setError(`Không tạo được hội thoại: ${e.message}`);
    }
  }

  function pickTopic(topicId) {
    update({ topicId });
    newChat(topicId);
  }

  function openSession(id) {
    setSessionId(id);
    setFresh(false);
    setTab('chat');
  }

  const topic = topics.find((t) => t.id === prefs.topicId) || topics[0];

  return (
    <div className="app">
      <header>
        <div className="brand">
          <Mascot size={44} />
          <h1 className="display">Luyện nói với Sao</h1>
        </div>
        <nav className="tabs">
          <button type="button" className={tab === 'chat' ? 'tab active' : 'tab'} onClick={() => setTab('chat')}>Trò chuyện</button>
          <button type="button" className={tab === 'practice' ? 'tab active' : 'tab'} onClick={() => setTab('practice')}>Luyện câu</button>
          <button type="button" className={tab === 'drill' ? 'tab active' : 'tab'} onClick={() => setTab('drill')}>Sửa lỗi</button>
          <button type="button" className={tab === 'history' ? 'tab active' : 'tab'} onClick={() => setTab('history')}>Lịch sử</button>
        </nav>
        <div className="account">
          <span className="muted">{username}</span>
          <button type="button" className="ghost" onClick={onLogout}>Đăng xuất</button>
        </div>
      </header>

      <main className="layout">
        <aside className="panel">
          <section>
            <h2>Chủ đề</h2>
            <div className="topics">
              {topics.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`topic ${topic && topic.id === t.id ? 'active' : ''}`}
                  onClick={() => pickTopic(t.id)}
                >
                  <span>{t.icon}</span> {t.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>Giọng đọc</h2>
            <select value={prefs.voiceName} onChange={(e) => update({ voiceName: e.target.value })} aria-label="Chọn giọng đọc">
              <option value="">Giọng mặc định của trình duyệt</option>
              {voices.map((v) => (
                <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
              ))}
            </select>
            <label className="field">
              Tốc độ: {Number(prefs.rate).toFixed(2)}
              <input type="range" min="0.6" max="1.3" step="0.05" value={prefs.rate} onChange={(e) => update({ rate: Number(e.target.value) })} />
            </label>
            <label className="check">
              <input type="checkbox" checked={prefs.autoListen} onChange={(e) => update({ autoListen: e.target.checked })} />
              Tự động nghe sau khi bot nói xong
            </label>
          </section>

          <section>
            <h2>AI</h2>
            <p className="muted">
              {config === null ? 'Đang kiểm tra...' : config.ai_enabled
                ? 'Sao đang chấm lỗi ngữ pháp và phát âm cho bạn.'
                : 'Sao đang hỏi theo kịch bản, chưa chấm lỗi.'}
            </p>
          </section>
        </aside>

        <section className="main">
          {error && <div className="status err">{error}</div>}

          {tab === 'chat' && topic && sessionId && (
            <>
              <div className="topic-info">
                <div>Chủ đề: {topic.icon} {topic.name}. Từ vựng gợi ý:</div>
                <div className="chips">
                  {topic.words.map((w) => (
                    <button key={w} type="button" className="chip" onClick={() => speakWord(w)}>{w}</button>
                  ))}
                </div>
              </div>
              <ChatView
                key={sessionId}
                sessionId={sessionId}
                fresh={fresh}
                voiceName={prefs.voiceName}
                rate={prefs.rate}
                autoListen={prefs.autoListen}
              />
            </>
          )}

          {tab === 'practice' && (
            <PracticeView
              key={topic ? topic.id : 'none'}
              topic={topic}
              voiceName={prefs.voiceName}
              rate={prefs.rate}
            />
          )}

          {tab === 'drill' && (
            <DrillView voiceName={prefs.voiceName} rate={prefs.rate} />
          )}

          {tab === 'history' && (
            <HistoryView voiceName={prefs.voiceName} rate={prefs.rate} onOpen={openSession} />
          )}
        </section>
      </main>
    </div>
  );
}

const DEFAULT_PREFS = { topicId: null, voiceName: '', rate: 0.95, autoListen: true };

function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch (e) {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) { /* storage blocked: keep defaults */ }
}

function speakWord(word) {
  // Speak a single vocabulary word using the same voice settings from prefs.
  const prefs = loadPrefs();
  speak(word, { voiceName: prefs.voiceName, rate: prefs.rate });
}
