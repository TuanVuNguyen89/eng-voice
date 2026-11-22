import json

import httpx

from .config import settings


class LLMError(Exception):
    pass


SYSTEM_TEMPLATE = """You are a friendly English speaking partner and pronunciation coach for a Vietnamese learner.
Topic: {topic}. Opening line you used: "{starter}". Stay on this topic.
Reply in English with 1-3 short sentences that sound natural when spoken aloud, then ask one follow-up question.
The learner's message is a speech-to-text transcript. If a word looks like a plausible mishearing of a similar-sounding word, treat it as a possible pronunciation issue (e.g. "ship" vs "sheep", "three" vs "tree").
Review the learner's LAST message and return ONLY a JSON object with this shape:
{{"reply": string, "score": integer 0-100 (overall clarity and grammar of the last message),
 "corrections": [{{"said": string, "better": string, "why": string}}],
 "pronunciation_tips": [{{"word": string, "tip": string}}]}}
Write "why" and "tip" in English, short and simple. Use empty arrays if nothing needs fixing."""


def _normalize(data: dict) -> dict:
    corrections = data.get("corrections") if isinstance(data.get("corrections"), list) else []
    tips = data.get("pronunciation_tips") if isinstance(data.get("pronunciation_tips"), list) else []
    try:
        score = int(data.get("score"))
    except (TypeError, ValueError):
        score = None
    return {
        "reply": str(data.get("reply") or "").strip() or "...",
        "feedback": {"score": score, "corrections": corrections, "tips": tips},
    }


def chat(history: list[dict], topic_name: str, starter: str) -> dict:
    """history: [{"role": "user"|"assistant", "content": str}], last item is the learner's newest message."""
    if not settings.openai_api_key:
        raise LLMError("The server has no OPENAI_API_KEY")

    body = {
        "model": settings.openai_model,
        "temperature": 0.7,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_TEMPLATE.format(topic=topic_name, starter=starter)},
            *history[-12:],
        ],
    }
    try:
        with httpx.Client(timeout=45.0) as client:
            res = client.post(
                f"{settings.openai_base_url}/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json=body,
            )
    except httpx.HTTPError as exc:
        raise LLMError(f"Could not reach the AI service: {exc}") from exc

    if res.status_code >= 400:
        raise LLMError(f"API error {res.status_code}: {res.text[:200]}")

    try:
        content = res.json()["choices"][0]["message"]["content"]
        return _normalize(json.loads(content))
    except (KeyError, IndexError, ValueError, TypeError) as exc:
        raise LLMError("The AI returned an unexpected format") from exc
