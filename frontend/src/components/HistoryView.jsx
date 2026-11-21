import { useEffect, useState } from 'react';
import { deleteSession, getSession, listSessions } from '../api';
import AudioClip from './AudioClip';
import Feedback from './Feedback';

export default function HistoryView({ voiceName, rate, onOpen }) {
  const [sessions, setSessions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  const refresh = () => listSessions().then(setSessions).catch((e) => setError(e.message));

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(id) {
    setError('');
    try {
      setDetail(await getSession(id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function remove(id) {
    // Destructive: removes the conversation and its recordings' references.
    if (!window.confirm('Xoá hội thoại này? Không thể khôi phục.')) return;
    try {
      await deleteSession(id);
      if (detail && detail.id === id) setDetail(null);
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  if (detail) {
    return (
      <div className="history">
        <div className="row">
          <button type="button" className="ghost" onClick={() => setDetail(null)}>← Danh sách</button>
          <button type="button" className="primary" onClick={() => onOpen(detail.id)}>Tiếp tục hội thoại</button>
        </div>
        <h3>{detail.topic_name}: {detail.title || 'Chưa có câu nói'}</h3>
        {detail.messages.map((m) => (
          <div key={m.id} className={`msg-row ${m.role}`}>
            <div className={`msg ${m.role}`}>
              <p>{m.text}</p>
              {m.audio_url && <AudioClip url={m.audio_url} />}
            </div>
            {m.role === 'user' && m.feedback && <Feedback feedback={m.feedback} voiceName={voiceName} rate={rate} />}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="history">
      <h3>Lịch sử hội thoại</h3>
      {error && <div className="status err">{error}</div>}
      {sessions.length === 0 && <p className="muted">Chưa có hội thoại nào.</p>}
      <ul className="session-list">
        {sessions.map((s) => (
          <li key={s.id}>
            <button type="button" className="session-item" onClick={() => openDetail(s.id)}>
              <b>{s.topic_name}</b>
              <span>{s.title || 'Chưa có câu nói'}</span>
              <small className="muted">{new Date(s.created_at).toLocaleString('vi-VN')} · {s.message_count} tin nhắn</small>
            </button>
            <button type="button" className="ghost danger" onClick={() => remove(s.id)}>Xoá</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
