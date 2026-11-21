import { useState } from 'react';
import { listenOnce, speak } from '../speech';
import { compareWords } from '../words';

export default function PracticeView({ defaultSentence, voiceName, rate }) {
  const [target, setTarget] = useState(defaultSentence || '');
  const [result, setResult] = useState(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');

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
      <label className="field">
        Câu mẫu cần luyện
        <textarea rows={3} value={target} onChange={(e) => { setTarget(e.target.value); setResult(null); }} />
      </label>
      <div className="row">
        <button type="button" className="ghost" onClick={() => speak(target, { voiceName, rate })}>🔊 Nghe mẫu</button>
        <button type="button" className="primary" onClick={handleSay} disabled={listening}>
          {listening ? '🎙️ Đang nghe...' : '🎤 Tôi đọc câu này'}
        </button>
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
              : 'Tuyệt vời! Bạn đọc đúng toàn bộ câu. Thử câu khó hơn nhé.'}
          </p>
        </div>
      )}
    </div>
  );
}
