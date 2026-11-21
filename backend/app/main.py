import json
import uuid
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session as DBSession, selectinload

from . import storage
from .auth import current_user, hash_password, validate_new_account
from .config import settings
from .db import get_db, init_db
from .llm import LLMError, chat
from .models import Message, Session, User

TOPICS = json.loads((Path(__file__).parent / "topics.json").read_text(encoding="utf-8"))
TOPIC_BY_ID = {t["id"]: t for t in TOPICS}
ACK = ["Nice!", "Got it.", "Interesting!", "Thanks for sharing."]
MAX_AUDIO_BYTES = 15 * 1024 * 1024

app = FastAPI(title="Luyện nói tiếng Anh API")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    storage.ensure_bucket()


class Credentials(BaseModel):
    username: str
    password: str


class CreateSession(BaseModel):
    topic_id: str


def message_out(m: Message) -> dict:
    return {
        "id": str(m.id),
        "role": m.role,
        "text": m.text,
        "audio_url": f"/api/audio/{m.audio_key}" if m.audio_key else None,
        "feedback": m.feedback,
        "created_at": m.created_at.isoformat(),
    }


def session_out(s: Session, include_messages: bool = True) -> dict:
    data = {
        "id": str(s.id),
        "topic_id": s.topic_id,
        "topic_name": TOPIC_BY_ID.get(s.topic_id, {}).get("name", s.topic_id),
        "title": s.title,
        "created_at": s.created_at.isoformat(),
    }
    if include_messages:
        data["messages"] = [message_out(m) for m in s.messages]
    return data


def offline_reply(topic: dict, turn_index: int) -> str:
    follow = topic["followups"]
    return f"{ACK[turn_index % len(ACK)]} {follow[turn_index % len(follow)]}"


def load_owned_session(db: DBSession, session_id: uuid.UUID, user: User, with_messages: bool = True) -> Session:
    query = select(Session).where(Session.id == session_id, Session.user_id == user.id)
    if with_messages:
        query = query.options(selectinload(Session.messages))
    s = db.execute(query).scalar_one_or_none()
    if not s:
        raise HTTPException(404, "Không tìm thấy hội thoại")
    return s


# ----- public -----

@app.get("/api/health")
def health():
    return {"ok": True}


@app.post("/api/auth/register", status_code=201)
def register(body: Credentials, db: DBSession = Depends(get_db)):
    username = body.username.strip()
    validate_new_account(username, body.password)
    if db.scalar(select(User).where(User.username == username)):
        raise HTTPException(409, "Tên đăng nhập đã tồn tại")
    db.add(User(username=username, password_hash=hash_password(body.password)))
    db.commit()
    return {"username": username}


# ----- protected: every route below needs a valid Basic Authorization header -----

@app.post("/api/auth/login")
def login(user: User = Depends(current_user)):
    return {"username": user.username}


@app.get("/api/config")
def config(user: User = Depends(current_user)):
    return {"ai_enabled": bool(settings.openai_api_key), "model": settings.openai_model}


@app.get("/api/topics")
def topics(user: User = Depends(current_user)):
    return TOPICS


@app.get("/api/sessions")
def list_sessions(user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    rows = db.execute(
        select(Session, func.count(Message.id))
        .outerjoin(Message, Message.session_id == Session.id)
        .where(Session.user_id == user.id)
        .group_by(Session.id)
        .order_by(Session.created_at.desc())
    ).all()
    return [{**session_out(s, include_messages=False), "message_count": n} for s, n in rows]


@app.post("/api/sessions", status_code=201)
def create_session(body: CreateSession, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    topic = TOPIC_BY_ID.get(body.topic_id)
    if not topic:
        raise HTTPException(404, "Không có chủ đề này")
    s = Session(user_id=user.id, topic_id=topic["id"], title="")
    db.add(s)
    db.flush()
    db.add(Message(session_id=s.id, role="assistant", text=topic["starter"]))
    db.commit()
    db.refresh(s)
    return session_out(s)


@app.get("/api/sessions/{session_id}")
def get_session(session_id: uuid.UUID, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    return session_out(load_owned_session(db, session_id, user))


@app.delete("/api/sessions/{session_id}", status_code=204)
def delete_session(session_id: uuid.UUID, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    s = load_owned_session(db, session_id, user, with_messages=False)
    db.delete(s)
    db.commit()


@app.post("/api/sessions/{session_id}/turns")
def add_turn(
    session_id: uuid.UUID,
    text: str = Form(...),
    audio: UploadFile | None = File(None),
    user: User = Depends(current_user),
    db: DBSession = Depends(get_db),
):
    s = load_owned_session(db, session_id, user)
    text = text.strip()
    if not text:
        raise HTTPException(400, "Câu nói trống")

    topic = TOPIC_BY_ID.get(s.topic_id, TOPICS[0])
    user_msg = Message(session_id=s.id, role="user", text=text)
    db.add(user_msg)
    db.flush()

    if audio is not None:
        data = audio.file.read(MAX_AUDIO_BYTES + 1)
        if len(data) > MAX_AUDIO_BYTES:
            raise HTTPException(413, "File ghi âm quá lớn")
        if data:
            key = f"{s.id}/{user_msg.id}"
            storage.put_audio(key, data, audio.content_type or "audio/webm")
            user_msg.audio_key = key

    if not s.title:
        s.title = text[:60]
    db.commit()

    # History from stored messages; the new user message was appended above.
    history = [{"role": m.role, "content": m.text} for m in s.messages]
    history.append({"role": "user", "content": text})

    try:
        if settings.openai_api_key:
            out = chat(history, topic["name"], topic["starter"])
        else:
            turn_index = sum(1 for m in s.messages if m.role == "assistant")
            out = {"reply": offline_reply(topic, turn_index), "feedback": None}
    except LLMError as exc:
        raise HTTPException(502, str(exc)) from exc

    assistant_msg = Message(session_id=s.id, role="assistant", text=out["reply"])
    db.add(assistant_msg)
    user_msg.feedback = out["feedback"]
    db.commit()
    db.refresh(user_msg)
    db.refresh(assistant_msg)
    return {"user_message": message_out(user_msg), "assistant_message": message_out(assistant_msg)}


@app.get("/api/audio/{key:path}")
def get_audio(key: str, user: User = Depends(current_user), db: DBSession = Depends(get_db)):
    # Object keys look like "<session_id>/<message_id>": only the owner may read them.
    try:
        session_id = uuid.UUID(key.split("/", 1)[0])
    except ValueError as exc:
        raise HTTPException(404, "Không có file ghi âm") from exc
    load_owned_session(db, session_id, user, with_messages=False)

    try:
        obj = storage.get_audio(key)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(404, "Không có file ghi âm") from exc

    def stream():
        try:
            yield from obj.stream(32 * 1024)
        finally:
            obj.close()
            obj.release_conn()

    return StreamingResponse(stream(), media_type=obj.headers.get("Content-Type", "audio/webm"))
