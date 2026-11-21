// Word-level comparison of a target sentence with what the recognizer heard.

export function normWords(s) {
  return s
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// LCS alignment: marks each target word as matched (ok) or missing/wrong (not ok).
export function compareWords(target, said) {
  const t = normWords(target);
  const s = normWords(said);
  const n = t.length;
  const m = s.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = t[i] === s[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const words = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (t[i] === s[j]) {
      words.push({ w: t[i], ok: true });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      words.push({ w: t[i], ok: false });
      i++;
    } else {
      j++;
    }
  }
  while (i < n) {
    words.push({ w: t[i], ok: false });
    i++;
  }
  const okCount = words.filter((x) => x.ok).length;
  return { words, score: n ? Math.round((100 * okCount) / n) : 0, said: s.join(' ') };
}
