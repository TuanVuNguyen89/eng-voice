// Bo, the tutor robot. Its mood follows the app state: idle, listening, thinking, speaking, happy.
export default function Mascot({ mood = 'idle', size = 96 }) {
  return (
    <svg
      className={`mascot mood-${mood}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Bo đang ${MOOD_LABEL[mood] || 'nghỉ'}`}
    >
      <line x1="60" y1="18" x2="60" y2="30" stroke="#1F2140" strokeWidth="4" strokeLinecap="round" />
      <circle className="antenna" cx="60" cy="14" r="7" fill="#FF7A9A" stroke="#1F2140" strokeWidth="3" />
      <rect x="20" y="30" width="80" height="68" rx="26" fill="#6EC6FF" stroke="#1F2140" strokeWidth="4" />
      <rect x="32" y="48" width="56" height="30" rx="14" fill="#1F2140" />
      <g className="eyes">
        <circle className="eye" cx="49" cy="63" r="6" fill="#FFD43B" />
        <circle className="eye" cx="71" cy="63" r="6" fill="#FFD43B" />
      </g>
      <path className="mouth" d="M50 86 Q60 92 70 86" fill="none" stroke="#1F2140" strokeWidth="4" strokeLinecap="round" />
      <circle cx="28" cy="82" r="5" fill="#FF7A9A" opacity="0.8" />
      <circle cx="92" cy="82" r="5" fill="#FF7A9A" opacity="0.8" />
      <rect className="foot" x="36" y="98" width="18" height="10" rx="5" fill="#FFD43B" stroke="#1F2140" strokeWidth="3" />
      <rect className="foot" x="66" y="98" width="18" height="10" rx="5" fill="#FFD43B" stroke="#1F2140" strokeWidth="3" />
    </svg>
  );
}

const MOOD_LABEL = {
  idle: 'chờ bạn',
  listening: 'lắng nghe',
  thinking: 'suy nghĩ',
  speaking: 'nói',
  happy: 'vui',
};
