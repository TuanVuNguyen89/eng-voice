import { useEffect, useMemo, useState } from 'react';
import { getDrills } from '../api';
import { SOUND_PAIRS, normalize } from '../drills';
import { listenOnce, speak } from '../speech';
import { compareWords } from '../words';
import Mascot from './Mascot';

const TABS = [
  { id: 'sentences', label: 'Sửa câu của bạn' },
  { id: 'words', label: 'Từ bạn hay sai' },
  { id: 'pairs', label: 'Cặp âm dễ nhầm' },
];

export default function DrillView({ voiceName, rate }) {
  const [tab, setTab] = useState('sentences');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [listening, setListening] = useState(false);
  const [solved, setSolved] = useState(0);

  useEffect(() => {
    getDrills().then(setData).catch((e) => setError(e.message));
  }, []);

  const items = useMemo(() => {
    if (!data) return [];
    if (tab === 'sentences') {
      return data.sentences.map((s) => ({ kind: 'sentence', target: s.better, said: s.said, hint: s.why }));
    }
    if (tab === 'words') {
      return data.words.map((w) => ({ kind: 'word', target: w.word, hint: w.tip }));
    }
    return SOUND_PAIRS.map((p) => ({ kind: 'pair', target: p.word, pair: p.pair, hint: p.tip }));
  }, [data, tab]);

  useEffect(() => {
    setIndex(0);
    setResult(null);
    setError('');
  }, [tab]);

  const current = items.length ? items[index % items.length] : null;

  function next() {
    if (items.length < 2) return;
    setIndex((i) => (i + 1) % items.length);
    setResult(null);
    setError('');
  }

  async function check() {
    if (!current) return;
    setError('');
    setListening(true);
    try {
      const said = await listenOnce();
      const r = compareWords(current.target, said);
      // For a minimal pair: if the learner said the partner word instead, point it out.
      const confusedWith =
        current.kind === 'pair' && r.score < 100 && normalize(said) === current.pair ? current.pair : null;
      setResult({ ...r, said, confusedWith });
      if (r.score === 100) setSolved((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setListening(false);
    }
  }

  const mood = listening ? 'listening' : result && result.score === 100 ? 'happy' : 'idle';
  const empty = data && tab === 'sentences' && data.sentences.length === 0;

  return (
    <div className="drills">
      <div className="stage-head">
        <Mascot mood={mood} size={84} />
        <div>
          <h2 className="display">Luyện sửa lỗi</h2>
          <p className="muted">Nói lại đúng, rồi để Bo chấm. Lỗi được gom từ chính các cuộc trò chuyện của bạn.</p>
        </div>
      </div>

      <div className="segments" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`segment ${tab === t.id ? 'on' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!data && !error && <p className="muted">Đang tải bài luyện...</p>}
      {error && !current && <div className="status err">{error}</div>}

      {empty && (
        <div className="empty">
          <p className="display">Chưa có lỗi nào để luyện.</p>
          <p className="muted">Hãy trò chuyện với Bo vài lượt. Các câu bạn nói sai sẽ tự xuất hiện ở đây.</p>
        </div>
      )}

      {current && (
        <div className="drill-card">
          <div className="drill-meta">
            <span className="counter">{(index % items.length) + 1} / {items.length}</span>
            <span className="counter">Đã đúng: {solved}</span>
          </div>

          {current.kind === 'sentence' && (
            <>
              <p className="said">Bạn nói: <s>{current.said}</s></p>
              <p className="prompt">{current.target}</p>
              {current.hint && <p className="muted">{current.hint}</p>}
            </>
          )}

          {current.kind === 'word' && (
            <>
              <p className="prompt big">{current.target}</p>
              <p className="muted">{current.hint}</p>
            </>
          )}

          {current.kind === 'pair' && (
            <>
              <p className="prompt big">
                {current.target} <span className="vs">/</span> {current.pair}
              </p>
              <p className="muted">{current.hint}</p>
              <p className="muted">Nói từ đầu tiên ({current.target}), không phải từ thứ hai.</p>
            </>
          )}

          <div className="row">
            <button type="button" className="btn-ghost" onClick={() => speak(current.target, { voiceName, rate })}>🔊 Nghe mẫu</button>
            <button type="button" className="btn-main" onClick={check} disabled={listening}>
              {listening ? 'Đang nghe...' : '🎤 Nói ngay'}
            </button>
            <button type="button" className="btn-ghost" onClick={next} disabled={items.length < 2}>Tiếp →</button>
          </div>

          {error && <div className="status err">{error}</div>}

          {result && (
            <div className={`verdict ${result.score === 100 ? 'pass' : 'retry'}`}>
              <span className="badge">{result.score === 100 ? 'Chuẩn!' : `${result.score}%`}</span>
              <div className="words">
                {result.words.map((x, i) => (
                  <span key={i}>
                    <span className={`w ${x.ok ? 'ok' : 'bad'}`}>{x.w}</span>
                    {!x.ok && (
                      <button type="button" className="say" title="Nghe từ này" onClick={() => speak(x.w, { voiceName, rate })}>🔊</button>
                    )}{' '}
                  </span>
                ))}
              </div>
              <p className="muted">Máy nghe được: "{result.said}"</p>
              {result.confusedWith && (
                <p className="warn">Bạn đang đọc giống "{result.confusedWith}". Đọc lại từ {current.target}.</p>
              )}
              {result.score < 100 && !result.confusedWith && (
                <p className="muted">Nghe mẫu rồi nói lại chậm hơn.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
