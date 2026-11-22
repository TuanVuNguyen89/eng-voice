// Genie, the tutor. Its mood follows the app state: idle, listening, thinking, speaking, happy.
export default function Mascot({ mood = 'idle', size = 96 }) {
  return (
    <svg
      className={`mascot mood-${mood}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Genie đang ${MOOD_LABEL[mood] || 'nghỉ'}`}
    >
      <path className="wisp" d="M40 84 Q60 112 80 84 Q72 104 60 108 Q48 104 40 84 Z" fill="#5BB8FF" stroke="#1F2140" strokeWidth="4" strokeLinejoin="round" />
      <ellipse cx="60" cy="64" rx="30" ry="32" fill="#5BB8FF" stroke="#1F2140" strokeWidth="4" />
      <path className="turban" d="M31 38 Q60 2 89 38 Q60 46 31 38 Z" fill="#FFD43B" stroke="#1F2140" strokeWidth="4" strokeLinejoin="round" />
      <circle className="gem" cx="60" cy="28" r="5" fill="#FF7A9A" stroke="#1F2140" strokeWidth="2.5" />
      <g className="eyes">
        <circle cx="49" cy="62" r="8" fill="#FFFFFF" stroke="#1F2140" strokeWidth="3" />
        <circle cx="71" cy="62" r="8" fill="#FFFFFF" stroke="#1F2140" strokeWidth="3" />
        <circle className="eye" cx="50" cy="63" r="4" fill="#1F2140" />
        <circle className="eye" cx="72" cy="63" r="4" fill="#1F2140" />
      </g>
      <path className="mouth" d="M49 78 Q60 88 71 78" fill="none" stroke="#1F2140" strokeWidth="4" strokeLinecap="round" />
      <circle cx="37" cy="74" r="4.5" fill="#FF7A9A" opacity="0.85" />
      <circle cx="83" cy="74" r="4.5" fill="#FF7A9A" opacity="0.85" />
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
