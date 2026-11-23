"""Regenerate backend/app/topics.json from backend/samples_src.py.

Edit SAMPLES / STARTERS in samples_src.py, then run from the repo root:
    python backend/scripts/build_topics.py
"""
import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import samples_src as src  # noqa: E402

path = BACKEND / "app" / "topics.json"
topics = json.loads(path.read_text(encoding="utf-8"))

ids = {t["id"] for t in topics}
assert ids == set(src.SAMPLES) == set(src.STARTERS), "topic ids differ between topics.json and samples_src.py"

for t in topics:
    t["samples"] = [{"level": lv, "focus": f, "text": x} for lv, f, x in src.SAMPLES[t["id"]]]
    t["starters"] = src.STARTERS[t["id"]]
    t["starter"] = t["starters"][0]
    t["sample"] = next(r["text"] for r in t["samples"] if r["level"] == 1)

# write bytes so Windows does not turn \n into \r\n
path.write_bytes((json.dumps(topics, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
print(f"wrote {path} ({len(topics)} topics)")
