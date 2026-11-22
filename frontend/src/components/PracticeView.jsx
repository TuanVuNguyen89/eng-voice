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

  return (
    <div className="practice">
      <div className="practice-top">
        <div className="levels">
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
        </div>
      </div>

      {!current && <p className="muted">Chưa có câu nào ở mức này.</p>}

      {current && (
        <SentenceMode
          current={current}
          index={index}
          pool={pool}
          target={target}
          setTarget={setTarget}
          result={result}
          setResult={setResult}
          listening={listening}
          setListening={setListening}
          error={error}
          setError={setError}
          nextSentence={nextSentence}
          voiceName={voiceName}
          rate={rate}
        />
      )}

    </div>
  );
}

function SentenceMode({
  current, index, pool, target, setTarget, result, setResult, listening, setListening,
  error, setError, nextSentence, voiceName, rate,
}) {
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
    <>
      <p className="muted">
        Câu {(index % pool.length) + 1}/{pool.length}
        {current.focus && <> · Chú ý: {current.focus}</>}
      </p>
      <label className="field">
        Câu mẫu (có thể sửa)
        <textarea rows={3} value={target} onChange={(e) => { setTarget(e.target.value); setResult(null); }} />
      </label>
      <div className="row">
        <button type="button" className="ghost" onClick={() => speak(target, { voiceName, rate })}>🔊 Nghe mẫu</button>
        <button type="button" className="primary" onClick={handleSay} disabled={listening || !target.trim()}>
          {listening ? '🎙️ Đang nghe...' : '🎤 Đọc cả câu'}
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
              ? `Cần luyện: ${bad.join(', ')}. Chuyển sang chế độ "Từng từ" để luyện riêng.`
              : 'Tuyệt vời! Bạn đọc đúng toàn bộ câu.'}
          </p>
        </div>
      )}
    </>
  );
}
