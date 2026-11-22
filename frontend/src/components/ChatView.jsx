import { useEffect, useRef, useState } from 'react';
import { getSession, postTurn } from '../api';
import { createTurnListener, hasRecognition, speak, stopSpeaking } from '../speech';
import AudioClip from './AudioClip';
import Feedback from './Feedback';
import Mascot from './Mascot';

const STATUS_TEXT = {
  idle: 'Nhấn 🎤 để bắt đầu nói.',
  listening: '🎙️ Đang nghe. Cứ nói tự nhiên; ngừng khoảng 2 giây bot sẽ trả lời (ngừng lâu hơn nếu câu đang dở).',
  thinking: '⏳ Bot đang trả lời...',
  speaking: '🔊 Bot đang nói. Micro tạm tắt để không tự nghe giọng bot.',
};

export default function ChatView({ sessionId, fresh, voiceName, rate, autoListen }) {
  const [messages, setMessages] = useState([]);
  const [phase, setPhase] = useState('idle'); // idle | listening | thinking | speaking
  const [live, setLive] = useState('');
  const [error, setError] = useState('');
  const [typed, setTyped] = useState('');

  // Refs keep async callbacks reading the latest values.
  const alive = useRef(true);
  const sessionRef = useRef(sessionId);
  const voiceRef = useRef(voiceName);
  const rateRef = useRef(rate);
  const autoRef = useRef(autoListen);
  const listenerRef = useRef(null);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const turnRef = useRef(0);
  const logRef = useRef(null);

  sessionRef.current = sessionId;
  voiceRef.current = voiceName;
  rateRef.current = rate;
  autoRef.current = autoListen;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelListening();
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionId) return undefined;
    let cancelled = false;
    setMessages([]);
    setPhase('idle');
    setLive('');
    setError('');
    cancelListening();
    getSession(sessionId)
      .then((s) => {
        if (cancelled || !alive.current) return;
        setMessages(s.messages);
        const last = s.messages[s.messages.length - 1];
        // Speak the opening line once, only for a brand-new conversation.
        if (fresh && last && last.role === 'assistant') speakThenListen(last.text);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages, live]);

  // ----- recording (optional): saves the learner's voice per turn to MinIO -----
  async function startRecorder(token) {
    chunksRef.current = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (token !== turnRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data && e.data.size && chunksRef.current.push(e.data);
      rec.start();
      recorderRef.current = rec;
    } catch (e) {
      recorderRef.current = null; // recording is optional; chat still works
    }
  }

  function stopRecorder() {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      recorderRef.current = null;
      const cleanup = () => {
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      if (!rec || rec.state === 'inactive') {
        cleanup();
        return resolve(null);
      }
      rec.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
          : null;
        cleanup();
        resolve(blob);
      };
      rec.stop();
    });
  }

  // ----- conversation flow -----
  function cancelListening() {
    turnRef.current += 1;
    if (listenerRef.current) {
      listenerRef.current.stop();
      listenerRef.current = null;
    }
    if (recorderRef.current || streamRef.current) {
      stopRecorder();
    }
  }

  function startListening() {
    if (listenerRef.current && listenerRef.current.isRunning()) return;
    setError('');
    setLive('');
    if (!hasRecognition()) {
      setError('Trình duyệt không hỗ trợ nhận giọng nói. Hãy dùng Chrome hoặc Edge, hoặc gõ câu bên dưới.');
      return;
    }
    turnRef.current += 1;
    const token = turnRef.current;
    try {
      const listener = createTurnListener({
        onPartial: (t) => alive.current && setLive(t),
        onFinal: (t) => handleFinal(t),
        onError: (e) => {
          if (!alive.current) return;
          setError(`Lỗi micro: ${e}`);
          setPhase('idle');
          setLive('');
        },
      });
      listenerRef.current = listener;
      listener.start();
      setPhase('listening');
      startRecorder(token);
    } catch (e) {
      setError(e.message);
      setPhase('idle');
    }
  }

  async function handleFinal(text) {
    listenerRef.current = null;
    const blob = await stopRecorder();
    if (!alive.current) return;
    setLive('');
    const clean = text.trim();
    if (!clean) {
      // Nothing heard: keep listening if hands-free mode is on.
      if (autoRef.current) startListening();
      else setPhase('idle');
      return;
    }
    await sendTurn(clean, blob);
  }

  async function sendTurn(text, blob) {
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { id: tempId, role: 'user', text, audio_url: null, feedback: null, pending: true }]);
    setPhase('thinking');
    setError('');
    try {
      const out = await postTurn(sessionRef.current, text, blob);
      if (!alive.current) return;
      setMessages((m) => [...m.filter((x) => x.id !== tempId), out.user_message, out.assistant_message]);
      await speakThenListen(out.assistant_message.text);
    } catch (e) {
      if (!alive.current) return;
      setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, pending: false, failed: true } : x)));
      setError(`${e.message} (câu của bạn chưa được lưu. Hãy thử lại.)`);
      setPhase('idle');
    }
  }

  async function speakThenListen(text) {
    setPhase('speaking');
    await speak(text, { voiceName: voiceRef.current, rate: rateRef.current });
    if (!alive.current) return;
    if (autoRef.current) startListening();
    else setPhase('idle');
  }

  function handleMicButton() {
    if (phase === 'listening') {
      listenerRef.current && listenerRef.current.finish(); // send now
    } else if (phase === 'idle') {
      startListening();
    }
  }

  function handleStop() {
    cancelListening();
    stopSpeaking();
    setLive('');
    setPhase('idle');
  }

  function handleTypedSubmit(e) {
    e.preventDefault();
    const text = typed.trim();
    if (!text || phase === 'thinking') return;
    setTyped('');
    cancelListening();
    stopSpeaking();
    sendTurn(text, null);
  }

  const micDisabled = phase === 'thinking' || phase === 'speaking';

  return (
    <div className="chat">
      <div className="chat-head">
        <Mascot mood={phase} size={76} />
        <div className={`bubble-status ${error ? 'err' : ''}`} aria-live="polite">
          {error || STATUS_TEXT[phase]}
        </div>
      </div>
      <div className="log" ref={logRef} aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={`msg-row ${m.role}`}>
            {m.role === 'assistant' && <Mascot mood="idle" size={36} />}
            <div className="msg-col">
              <span className="who">{m.role === 'user' ? 'Bạn' : 'Sao'}</span>
              <div className={`msg ${m.role}${m.failed ? ' failed' : ''}`}>
                <p>{m.text}</p>
                {(m.role === 'assistant' || m.audio_url || m.pending || m.failed) && (
                  <div className="msg-tools">
                    {m.role === 'assistant' && (
                      <button
                        type="button"
                        className="say listen"
                        onClick={() => speak(m.text, { voiceName: voiceRef.current, rate: rateRef.current })}
                      >
                        🔊 Nghe lại
                      </button>
                    )}
                    {m.audio_url && <AudioClip url={m.audio_url} />}
                    {m.pending && <small className="muted">đang gửi...</small>}
                    {m.failed && <small className="err-text">chưa lưu</small>}
                  </div>
                )}
              </div>
              {m.role === 'user' && m.feedback && (
                <Feedback feedback={m.feedback} voiceName={voiceRef.current} rate={rateRef.current} />
              )}
            </div>
          </div>
        ))}
        {phase === 'listening' && live && (
          <div className="msg-row user">
            <div className="msg-col">
              <span className="who">Bạn</span>
              <div className="msg user live-text"><p>{live}</p></div>
            </div>
          </div>
        )}
        {phase === 'thinking' && (
          <div className="msg-row assistant">
            <Mascot mood="thinking" size={36} />
            <div className="msg-col">
              <span className="who">Sao</span>
              <div className="msg assistant typing"><p>…</p></div>
            </div>
          </div>
        )}
      </div>

      <div className="controls">
        <button
          type="button"
          className={`mic ${phase === 'listening' ? 'live' : ''}`}
          onClick={handleMicButton}
          disabled={micDisabled}
          title={phase === 'listening' ? 'Gửi câu ngay' : 'Nói'}
        >
          {phase === 'listening' ? '⏎' : '🎤'}
        </button>
        {(phase === 'listening' || phase === 'speaking') && (
          <button type="button" className="ghost" onClick={handleStop}>⏹ Dừng</button>
        )}
        <form className="composer" onSubmit={handleTypedSubmit}>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Hoặc gõ tiếng Anh ở đây..."
            aria-label="Nhập câu tiếng Anh"
            disabled={phase === 'thinking'}
          />
          <button type="submit" disabled={phase === 'thinking' || !typed.trim()}>Gửi</button>
        </form>
      </div>
    </div>
  );
}
