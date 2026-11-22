// Built-in pronunciation drills for Vietnamese learners. Each item is one target word,
// optionally with a minimal-pair partner that is easy to confuse with it.

export const SOUND_PAIRS = [
  { word: 'think', pair: 'sink', tip: 'Place the tip of your tongue between your teeth and blow gently (/θ/). Don\'t say it like "s".' },
  { word: 'three', pair: 'tree', tip: 'Like "think": tongue between the teeth. Don\'t say "tree" (tongue touching the ridge behind the teeth).' },
  { word: 'very', pair: 'berry', tip: 'Upper teeth touch the lower lip for /v/. Don\'t press both lips together like /b/.' },
  { word: 'light', pair: 'right', tip: '"l": the tip of your tongue touches the ridge behind your upper teeth. "r": the tongue touches nothing and the lips are slightly rounded.' },
  { word: 'ship', pair: 'sheep', tip: 'Short, relaxed /ɪ/ in "ship". Long /iː/ with lips spread in "sheep".' },
  { word: 'chicken', tip: 'A light "ch" with a puff of air. Don\'t say it like "sh".' },
  { word: 'bowl', tip: 'Round your lips for "ow". For the final /l/, clearly touch the ridge behind your teeth. Don\'t say "bao".' },
  { word: 'spring', tip: 'Say "spr" as one smooth sound, not "suh-puh-ring".' },
  { word: 'vegetable', tip: 'Three syllables: VEJ-tuh-bul. The last syllable is light, not a full "tuh-boh".' },
  { word: 'comfortable', tip: 'Often shortened to three syllables: KUMF-tuh-bul.' },
  { word: 'thought', pair: 'taught', tip: '"th": tongue between the teeth. "au": round the lips more and hold the vowel longer.' },
  { word: 'work', pair: 'walk', tip: '/ɜːr/: curl the tongue slightly, lips not rounded. /ɔːk/: round the lips, no tongue curl.' },
];

export function normalize(text) {
  return String(text || '').toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
