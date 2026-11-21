import { speak } from '../speech';

export default function Feedback({ feedback, voiceName, rate }) {
  const corrections = feedback.corrections || [];
  const tips = feedback.tips || [];
  const score = Number.isFinite(Number(feedback.score)) && feedback.score !== null ? Number(feedback.score) : null;

  return (
    <div className="feedback">
      <div className="score">Điểm: {score ?? '—'}/100</div>

      {corrections.length > 0 && (
        <>
          <h4>Sửa lỗi</h4>
          <ul>
            {corrections.map((c, i) => (
              <li key={i}>
                <span className="bad">{c.said}</span> → <span className="good">{c.better}</span>
                {c.why && <div className="muted">{c.why}</div>}
              </li>
            ))}
          </ul>
        </>
      )}

      {tips.length > 0 && (
        <>
          <h4>Gợi ý phát âm: những từ bạn đang phát âm chưa đúng</h4>
          <ul>
            {tips.map((t, i) => (
              <li key={i}>
                <b>{t.word}</b> — {t.tip}
                <button type="button" className="say" title="Nghe từ mẫu" onClick={() => speak(t.word, { voiceName, rate })}>
                  🔊
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {corrections.length === 0 && tips.length === 0 && <div className="muted">Câu nói rất ổn!</div>}
    </div>
  );
}
