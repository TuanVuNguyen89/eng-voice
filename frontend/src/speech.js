// Browser speech helpers (Web Speech API): text-to-speech and turn-based speech-to-text.

export function englishVoices() {
  if (!('speechSynthesis' in window)) return [];
  return speechSynthesis
    .getVoices()
    .filter((v) => /^en/i.test(v.lang))
    .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name));
}

// Speaks once and resolves when finished. Never repeats on its own.
export function speak(text, { voiceName, rate = 0.95 } = {}) {
  return new Promise((resolve) => {
    if (!('speechSynthesis' in window) || !text) return resolve();
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = speechSynthesis.getVoices().find((v) => v.name === voiceName);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = 'en-US';
    }
    u.rate = Number(rate) || 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

export function hasRecognition() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

// A word at the end of a sentence that usually means the speaker is still mid-thought.
const DANGLING = /\b(and|but|or|so|because|to|the|a|an|of|with|for|that|if|when|is|are|was|were|i|my|your|in|on|at|about|like|think|which|who)\s*$/i;

/**
 * Turn-based listener. Keeps listening across pauses and calls onFinal(text) only after the
 * learner has been silent long enough:
 *  - silenceMs after a complete-looking phrase,
 *  - pauseMs after a phrase that trails off (e.g. "...because"), so thinking time is respected.
 * finish() sends immediately. stop() discards without sending.
 */
export function createTurnListener({ silenceMs = 2000, pauseMs = 4000, onPartial, onFinal, onError }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) throw new Error('Trình duyệt không hỗ trợ nhận giọng nói. Hãy dùng Chrome hoặc Edge.');

  let rec = null;
  let running = false;
  let committed = '';
  let hypothesis = '';
  let timer = null;

  const current = () => `${committed} ${hypothesis}`.trim();

  function arm() {
    clearTimeout(timer);
    const text = current();
    if (!text) return; // nothing said yet: wait as long as needed
    timer = setTimeout(finish, DANGLING.test(text) ? pauseMs : silenceMs);
  }

  function finish() {
    const text = current();
    stop();
    onFinal && onFinal(text);
  }

  function stop() {
    running = false;
    clearTimeout(timer);
    const r = rec;
    rec = null;
    if (r) {
      try { r.abort(); } catch (e) { /* already stopped */ }
    }
  }

  function launch() {
    const r = new SR();
    rec = r;
    r.lang = 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) committed = `${committed} ${res[0].transcript}`.trim();
        else interim += res[0].transcript;
      }
      hypothesis = interim.trim();
      onPartial && onPartial(current());
      arm();
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return; // harmless, keep going
      running = false;
      clearTimeout(timer);
      onError && onError(e.error);
    };
    // Chrome ends continuous sessions on its own (e.g. after long silence): restart them.
    r.onend = () => {
      if (running && rec === r) {
        try { launch(); } catch (err) { running = false; onError && onError(String(err)); }
      }
    };
    r.start();
  }

  return {
    start() {
      committed = '';
      hypothesis = '';
      running = true;
      launch();
    },
    finish,
    stop,
    isRunning: () => running,
  };
}

// One-shot recognition for the practice tab.
export function listenOnce() {
  return new Promise((resolve, reject) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return reject(new Error('Trình duyệt không hỗ trợ nhận giọng nói. Hãy dùng Chrome hoặc Edge.'));
    const r = new SR();
    r.lang = 'en-US';
    r.interimResults = false;
    r.maxAlternatives = 1;
    let got = false;
    r.onresult = (e) => { got = true; resolve(e.results[0][0].transcript); };
    r.onerror = (e) => reject(new Error(`Lỗi micro: ${e.error}`));
    r.onend = () => { if (!got) reject(new Error('Không nghe thấy gì, thử lại nhé.')); };
    try { r.start(); } catch (e) { reject(e); }
  });
}
