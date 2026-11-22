import { useEffect, useMemo, useState } from 'react';
import { listenOnce, speak } from '../speech';
import { compareWords, normWords } from '../words';
import Mascot from './Mascot';

const LEVELS = [
  { value: 0, label: 'Tất cả' },
  { value: 1, label: 'Dễ' },
  { value: 2, label: 'Trung bình' },
  { value: 3, label: 'Khó' },
];

export default function PracticeView({ topic, voiceName, rate }) {
  const samples = useMemo(() => (topic && topic.samples) || [], [topic]);
  const [mode, setMode] = useState('sentence'); // sentence | word
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
        <div className="segments">
          <button type="button" className={`segment ${mode === 'sentence' ? 'on' : ''}`} onClick={() => setMode('sentence')}>
            Cả câu
          </button>
          <button type="button" className={`segment ${mode === 'word' ? 'on' : ''}`} onClick={() => setMode('word')}>
            Từng từ
          </button>
        </div>
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

      {current && mode === 'sentence' && (
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

      {current && mode === 'word' && (
        <WordMode
          key={current.text}
          sentence={current.text}
          focus={current.focus}
          onNext={nextSentence}
          canNext={pool.length > 1}
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

// Reads the sentence one word at a time. Each word is checked on its own.
function WordMode({ sentence, focus, onNext, canNext, voiceName, rate }) {
  const tokens = useMemo(() => sentence.split(/\s+/).filter(Boolean), [sentence]);
  const [idx, setIdx] = useState(0);
  const [marks, setMarks] = useState(() => tokens.map(() => null)); // null | 'ok' | 'miss' | 'skip'
  const [heard, setHeard] = useState('');
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');

  const done = idx >= tokens.length;
  const token = tokens[idx] || '';
  const okCount = marks.filter((m) => m === 'ok').length;

  function advance(nextMarks) {
    setMarks(nextMarks);
    setHeard('');
    setError('');
    setIdx((i) => i + 1);
  }

  async function sayWord() {
    if (done) return;
    setError('');
    setListening(true);
    try {
      const said = await listenOnce();
      setHeard(said);
      const expected = normWords(token).join(' ');
      if (expected && normWords(said).join(' ') === expected) {
        const next = [...marks];
        next[idx] = 'ok';
        setTimeout(() => advance(next), 700); // brief pause so the ✓ is visible
      } else {
        const next = [...marks];
        next[idx] = 'miss';
        setMarks(next);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setListening(false);
    }
  }

  function skip() {
    const next = [...marks];
    next[idx] = 'skip';
    advance(next);
  }

  function restart() {
    setIdx(0);
    setMarks(tokens.map(() => null));
    setHeard('');
    setError('');
  }

  const mood = listening ? 'listening' : done && okCount === tokens.length ? 'happy' : 'idle';

  return (
    <div className="word-mode">
      <div className="word-tiles" aria-label="Các từ trong câu">
        {tokens.map((t, i) => (
          <button
            key={i}
            type="button"
            className={`tile ${marks[i] || ''} ${i === idx && !done ? 'current' : ''}`}
            onClick={() => { setIdx(i); setHeard(''); setError(''); }}
            title="Chọn từ này để luyện"
          >
            {t}
          </button>
        ))}
      </div>

      {!done && (
        <div className="word-stage">
          <Mascot mood={mood} size={70} />
          <div className="word-card">
            <p className="muted">Từ {idx + 1}/{tokens.length}{focus && idx === 0 && <> · Chú ý: {focus}</>}</p>
            <p className="prompt big">{token}</p>
            <div className="row">
              <button type="button" className="ghost" onClick={() => speak(token, { voiceName, rate })}>🔊 Nghe từ</button>
              <button type="button" className="primary" onClick={sayWord} disabled={listening}>
                {listening ? '🎙️ Đang nghe...' : '🎤 Nói từ này'}
              </button>
              <button type="button" className="ghost" onClick={skip}>Bỏ qua →</button>
            </div>
            {heard && (
              <p className={marks[idx] === 'miss' ? 'warn' : 'muted'}>
                {marks[idx] === 'miss' ? `Máy nghe được "${heard}". Thử lại chậm hơn.` : `Máy nghe được "${heard}".`}
              </p>
            )}
            {error && <div className="status err">{error}</div>}
          </div>
        </div>
      )}

      {done && (
        <div className="word-summary">
          <Mascot mood={okCount === tokens.length ? 'happy' : 'idle'} size={80} />
          <p className="display prompt">Xong! Đúng {okCount}/{tokens.length} từ.</p>
          <div className="row">
            <button type="button" className="primary" onClick={restart}>Luyện lại câu này</button>
            {canNext && <button type="button" className="ghost" onClick={onNext}>🔀 Câu khác</button>}
          </div>
        </div>
      )}

      <div className="word-progress" aria-hidden="true">
        <div className="word-progress-bar" style={{ width: `${(marks.filter(Boolean).length / tokens.length) * 100}%` }} />
      </div>
    </div>
  );
}
