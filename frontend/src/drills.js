// Built-in pronunciation drills for Vietnamese learners. Each item is one target word,
// optionally with a minimal-pair partner that is easy to confuse with it.

export const SOUND_PAIRS = [
  { word: 'think', pair: 'sink', tip: 'Đặt đầu lưỡi giữa hai hàm răng rồi thổi nhẹ (âm /θ/). Không đọc thành "s".' },
  { word: 'three', pair: 'tree', tip: 'Giống "think": lưỡi giữa răng, không đọc thành "tree" (lưỡi chạm lợi).' },
  { word: 'very', pair: 'berry', tip: 'Răng trên chạm môi dưới để đọc /v/. Đừng mím hai môi như /b/.' },
  { word: 'light', pair: 'right', tip: 'Âm "l": đầu lưỡi chạm lợi trên. Âm "r": lưỡi không chạm gì, môi hơi tròn.' },
  { word: 'ship', pair: 'sheep', tip: '/ɪ/ ngắn và thả lỏng ở "ship". /iː/ kéo dài, môi căng ở "sheep".' },
  { word: 'chicken', tip: '"ch" bật hơi nhẹ như "ch" tiếng Việt. Không đọc thành "sh".' },
  { word: 'bowl', tip: 'Môi tròn khi đọc "ow". Âm /l/ cuối: đầu lưỡi chạm lợi rõ, không đọc thành "bao".' },
  { word: 'spring', tip: 'Đọc liền cụm "spr" thành một âm, không tách thành "sờ-pờ-ring".' },
  { word: 'vegetable', tip: '3 âm tiết: VEJ-tuh-bul. Âm cuối nhẹ, không đọc đủ "ta-bồ".' },
  { word: 'comfortable', tip: 'Thường rút gọn còn 3 âm tiết: KUMF-tuh-bul.' },
  { word: 'thought', pair: 'taught', tip: '"th" đặt lưỡi giữa răng. "au" tròn môi hơn, kéo dài.' },
  { word: 'work', pair: 'walk', tip: '/ɜːr/ lưỡi cuộn nhẹ, môi không tròn. /ɔːk/ môi tròn, không cuộn lưỡi.' },
];

export function normalize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
