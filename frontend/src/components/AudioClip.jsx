import { useEffect, useState } from 'react';
import { fetchAudioUrl } from '../api';

export default function AudioClip({ url }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;
    fetchAudioUrl(url)
      .then((u) => {
        if (cancelled) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setSrc(u);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (error) return <small className="err-text">{error}</small>;
  if (!src) return <small className="muted">đang tải ghi âm...</small>;
  return <audio controls src={src} className="rec" />;
}
