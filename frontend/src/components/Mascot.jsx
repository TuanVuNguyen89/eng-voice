// Sao, the tutor: a round red sticker with a gold star, wearing a conical straw hat.
// Its mood follows the app state: idle, listening, thinking, speaking, happy.
const STAR = '60.0,85.5 62.5,91.6 69.0,92.1 64.0,96.3 65.6,102.7 60.0,99.2 54.4,102.7 56.0,96.3 51.0,92.1 57.5,91.6';

export default function Mascot({ mood = 'idle', size = 96 }) {
  return (
    <svg
      className={`mascot mood-${mood}`}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Sao is ${MOOD_LABEL[mood] || 'resting'}`}
    >
      <ellipse className="feet" cx="46" cy="104" rx="8" ry="5" fill="#1F2140" />
      <ellipse className="feet" cx="74" cy="104" rx="8" ry="5" fill="#1F2140" />
      <circle className="arm arm-l" cx="22" cy="76" r="8" fill="#E53935" stroke="#1F2140" strokeWidth="3.5" />
      <circle className="arm arm-r" cx="98" cy="76" r="8" fill="#E53935" stroke="#1F2140" strokeWidth="3.5" />
      <circle className="body" cx="60" cy="68" r="36" fill="#E53935" stroke="#1F2140" strokeWidth="4" />
      <ellipse cx="46" cy="44" rx="9" ry="5" fill="#FFFFFF" opacity="0.35" transform="rotate(-25 46 44)" />
      <polygon className="star" points={STAR} fill="#FFD43B" stroke="#1F2140" strokeWidth="2.5" strokeLinejoin="round" />
      <g className="eyes">
        <circle cx="46" cy="66" r="8" fill="#FFFFFF" stroke="#1F2140" strokeWidth="3" />
        <circle cx="74" cy="66" r="8" fill="#FFFFFF" stroke="#1F2140" strokeWidth="3" />
        <circle className="eye" cx="47" cy="67" r="4" fill="#1F2140" />
        <circle className="eye" cx="75" cy="67" r="4" fill="#1F2140" />
      </g>
      <path className="mouth" d="M51 81 Q60 89 69 81" fill="none" stroke="#1F2140" strokeWidth="4" strokeLinecap="round" />
      <circle cx="36" cy="76" r="4" fill="#FF9AA8" />
      <circle cx="84" cy="76" r="4" fill="#FF9AA8" />
      {/* conical straw hat: wide cone with a point and dark ribs */}
      <g className="hat">
        <path d="M14 46 Q60 58 106 46 Q90 30 60 8 Q30 30 14 46 Z" fill="#F2D27A" stroke="#1F2140" strokeWidth="4" strokeLinejoin="round" />
        <path d="M60 9 L60 54 M42 16 Q36 34 26 47 M78 16 Q84 34 94 47" fill="none" stroke="#B8862B" strokeWidth="2.5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const MOOD_LABEL = {
  idle: 'waiting for you',
  listening: 'listening',
  thinking: 'thinking',
  speaking: 'speaking',
  happy: 'vui',
};
