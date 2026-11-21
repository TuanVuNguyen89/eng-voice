import { useEffect, useMemo, useState } from 'react';
import { listenOnce, speak } from '../speech';
import { compareWords } from '../words';

const LEVELS = [
  { value: 0, label: 'Tất cả' },
  { value: 1, label: 'Dễ' },
  { value: 2, label: 'Trung bình' },
  { value: 3, label: 'Khó' },
];

export default function PracticeView({ topic, voiceName, rate }) {
  const samples = useMemo(() => (topic && topic.samples) || [], [topic]);
  const [level, setLevel] = useState(0);
  const pool = useMemo(() => samples.filter((s) => !level || s.level === level), [samples, level]);

  const [index, setIndex] = useState(0);
  const [target, setTarget] = useState('');
  const [result, setResult] = useState(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');

  const current = pool.length ? pool[index % pool.length] : null;

  // New topic or level: start from the first sentence of the filtered pool.
  useEffect(() => {
    setIndex(0);
  }, [topic && topic.id, level]);

  useEffect(() => {
    setTarget(current ? current.text : '');
    setResult(null);
    setError('');
  }, [current && current.text]);

  function nextSentence() {
    if (pool.length < 2) return;
    let next = index;
    while (next === index) next = Math.floor(Math.random() * pool.length);
    setIndex(next);
  }

  async function handleSay() {
    if (!target.trim()) return;
    setError('');
    setListening(true);
    try {
      const said = await listenOnce();
      setResult(compareWords(target, said));
    } catch (e) {
      setError(e.message);
    } finally {
      setListening(false);
    }
  }

  const bad = result ? [...new Set(result.words.filter((x) => !x.ok).map((x) => x.w))] : [];

  return (
    <div className="practice">
      <div className="row">
        <span className="muted">Mức độ:</span>
        {LEVELS.map((l) => (
          <button
            key={l.value}
            type="button"
            className={`chip ${level === l.value ? 'active' : ''}`}
            onClick={() => setLevel(l.value)}
          >
            {l.label}
          </button>
        ))}
        <span className="muted">{pool.length ? `Câu ${(index % pool.length) + 1}/${pool.length}` : 'Chưa có câu nào ở mức này'}</span>
      </div>

      {current && current.focus && (
        <p className="muted">Chú ý phát âm: {current.focus}</p>
      )}

      <label className="field">
        Câu mẫu cần luyện (có thể sửa)
        <textarea rows={3} value={target} onChange={(e) => { setTarget(e.target.value); setResult(null); }} />
      </label>

      <div className="row">
        <button type="button" className="ghost" onClick={() => speak(target, { voiceName, rate })}>🔊 Nghe mẫu</button>
        <button type="button" className="primary" onClick={handleSay} disabled={listening || !target.trim()}>
          {listening ? '🎙️ Đang nghe...' : '🎤 Tôi đọc câu này'}
        </button>
        <button type="button" className="ghost" onClick={nextSentence} disabled={pool.length < 2}>🔀 Câu khác</button>
      </div>
      {error && <div className="status err">{error}</div>}

      {result && (
        <div className="result">
          <div className="row">
            <span className="big-score">{result.score}%</span>
            <span className="muted">Đúng {result.words.filter((x) => x.ok).length}/{result.words.length} từ</span>
          </div>
          <div className="muted">Máy nghe được: "{result.said}"</div>
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
          <p className="muted">
            {bad.length
              ? `Cần luyện: ${bad.join(', ')}. Nghe mẫu rồi đọc lại chậm, rõ từng âm cuối và trọng âm.`
              : 'Tuyệt vời! Bạn đọc đúng toàn bộ câu. Bấm "Câu khác" để tiếp tục.'}
          </p>
        </div>
      )}
    </div>
  );
}
