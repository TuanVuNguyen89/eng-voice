import { useEffect, useState } from 'react';
import { deleteSession, getSession, listSessions } from '../api';
import AudioClip from './AudioClip';
import ConfirmDialog from './ConfirmDialog';
import Feedback from './Feedback';
import Mascot from './Mascot';

export default function HistoryView({ voiceName, rate, onOpen }) {
  const [sessions, setSessions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(null); // session id waiting for confirmation
  const [loading, setLoading] = useState(true);

  const refresh = () =>
    listSessions()
      .then(setSessions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

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

  async function confirmRemove() {
    const id = pending;
    setPending(null);
    try {
      await deleteSession(id);
      if (detail && detail.id === id) setDetail(null);
      refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  const dialog = (
    <ConfirmDialog
      open={!!pending}
      title="Xoá hội thoại này?"
      message="Toàn bộ câu nói, phản hồi và file ghi âm của cuộc trò chuyện sẽ bị xoá. Không thể khôi phục."
      confirmLabel="Xoá vĩnh viễn"
      cancelLabel="Giữ lại"
      danger
      onConfirm={confirmRemove}
      onCancel={() => setPending(null)}
    />
  );

  if (detail) {
    const turns = detail.messages.filter((m) => m.role === 'user').length;
    return (
      <div className="history">
        <div className="history-top">
          <button type="button" className="ghost" onClick={() => setDetail(null)}>← Danh sách</button>
          <button type="button" className="primary" onClick={() => onOpen(detail.id)}>Tiếp tục</button>
        </div>
        <header className="history-title">
          <span className="chip active">{detail.topic_name}</span>
          <h3 className="display">{detail.title || 'Chưa có câu nói'}</h3>
          <p className="muted">{new Date(detail.created_at).toLocaleString('vi-VN')} · {turns} lượt nói</p>
        </header>

        <div className="log transcript">
          {detail.messages.map((m) => (
            <div key={m.id} className={`msg-row ${m.role}`}>
              {m.role === 'assistant' && <Mascot mood="idle" size={34} />}
              <div className="msg-col">
                <span className="who">{m.role === 'user' ? 'Bạn' : 'Sao'}</span>
                <div className={`msg ${m.role}`}>
                  <p>{m.text}</p>
                  {m.audio_url && <AudioClip url={m.audio_url} />}
                </div>
                {m.role === 'user' && m.feedback && (
                  <Feedback feedback={m.feedback} voiceName={voiceName} rate={rate} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="history">
      <div className="history-top">
        <h3 className="display">Lịch sử hội thoại</h3>
        <span className="muted">{sessions.length} cuộc trò chuyện</span>
      </div>
      {error && <div className="status err">{error}</div>}
      {loading && <p className="muted">Đang tải...</p>}
      {!loading && sessions.length === 0 && (
        <div className="empty">
          <Mascot mood="idle" size={72} />
          <p className="display">Chưa có cuộc trò chuyện nào.</p>
          <p className="muted">Nói với Sao ít nhất một câu, cuộc trò chuyện sẽ được lưu ở đây.</p>
        </div>
      )}
      <ul className="session-list">
        {sessions.map((s) => (
          <li key={s.id} className="session-row">
            <button type="button" className="session-item" onClick={() => openDetail(s.id)}>
              <span className="chip">{s.topic_name}</span>
              <b>{s.title || 'Chưa có câu nói'}</b>
              <small className="muted">
                {new Date(s.created_at).toLocaleString('vi-VN')} · {s.message_count} tin nhắn
              </small>
            </button>
            <button type="button" className="ghost danger" onClick={() => setPending(s.id)}>Xoá</button>
          </li>
        ))}
      </ul>
      {dialog}
    </div>
  );
}
