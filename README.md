# Speak English with Sao

Web app để luyện nói tiếng Anh bằng giọng nói. Bạn trò chuyện với **Sao** (nhân vật robot-sao có nón lá), Sao trả lời bằng giọng nói, chấm lỗi ngữ pháp và gợi ý phát âm. Giao diện và thông báo đều bằng tiếng Anh.

Tính năng chính:
- **Chat**: nói hoặc gõ, Sao trả lời theo 29 chủ đề, mỗi chủ đề có nhiều câu mở đầu ngẫu nhiên.
- **Practice**: đọc câu mẫu, so khớp từng từ với những gì micro nghe được.
- **Fix mistakes**: luyện lại các câu bạn nói sai và các từ hay phát âm sai.
- **History**: xem lại các cuộc trò chuyện có lượt nói, nghe lại file ghi âm.

---

## 1. Yêu cầu

- **Docker Desktop** (có `docker compose`). Đây là cách chạy đơn giản nhất.
- **Node.js 22+** và **npm**: chỉ cần khi phát triển frontend.
- **Python 3.12+**: chỉ cần khi chạy backend trực tiếp trên máy (không qua Docker).
- **Chrome hoặc Edge**: Firefox và Safari không hỗ trợ nhận giọng nói đầy đủ.
- Git.

## 2. Chạy nhanh bằng Docker

```bash
git clone https://github.com/TuanVuNguyen89/eng-voice.git
cd eng-voice
cp .env.example .env          # Windows PowerShell: copy .env.example .env
docker compose up -d --build
```

Mở **http://localhost:8080**, tạo tài khoản và thử.

Lần đầu build mất vài phút. Các lệnh hữu ích:

```bash
docker compose ps                      # trạng thái các container
docker compose logs -f backend         # log backend
docker compose down                    # dừng (giữ dữ liệu)
docker compose down -v                 # dừng và XOÁ dữ liệu database + ghi âm
```

Sau khi sửa code backend hoặc frontend, chạy lại `docker compose up -d --build`.

Bạn có thể bỏ qua API key: app vẫn chạy, Sao chỉ hỏi theo kịch bản và không chấm lỗi. Xem mục 4 để bật AI.

## 3. Phát triển từng phần (nhanh hơn để debug)

Chạy PostgreSQL và MinIO bằng Docker, còn backend và frontend chạy trên máy. Dev compose đã mở các port `127.0.0.1` cho việc này.

```bash
docker compose up -d postgres minio
```

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
# macOS/Linux:  source .venv/bin/activate
# Windows:      .venv\Scripts\activate
pip install -r requirements.txt
```

Đặt biến môi trường rồi chạy (ví dụ trên PowerShell dùng `$env:NAME="..."`):

```bash
export DATABASE_URL="postgresql+psycopg://speak:speak_dev_pw@localhost:5432/speak"
export MINIO_ENDPOINT="localhost:9000"
export MINIO_ACCESS_KEY="minioadmin"
export MINIO_SECRET_KEY="minioadmin123"
export OPENAI_API_KEY="..."            # bỏ trống nếu chưa có
uvicorn app.main:app --reload --port 8000
```

Kiểm tra: http://localhost:8000/docs (Swagger) và http://localhost:8000/api/health.

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

Mở **http://localhost:5173**. Vite tự chuyển các request `/api` sang `localhost:8000`.

## 4. Cấu hình

Mọi cấu hình nằm trong file `.env` ở thư mục gốc (không commit file này).

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `OPENAI_API_KEY` | Key của endpoint OpenAI-compatible. Bỏ trống để tắt AI | (trống) |
| `OPENAI_BASE_URL` | URL gốc của API, ví dụ `https://api.openai.com/v1` | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Tên model | `gpt-4o-mini` |
| `POSTGRES_PASSWORD` | Mật khẩu PostgreSQL | `speak_dev_pw` |
| `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` | Tài khoản MinIO (lưu file ghi âm) | `minioadmin` / `minioadmin123` |
| `APP_PORT` | Port cho web trên máy bạn | `8080` |

Khoá API chỉ nằm ở backend. Trình duyệt không bao giờ nhận được key.

Muốn dùng model chạy offline (Ollama, llama.cpp…) thì đặt `OPENAI_BASE_URL` về endpoint OpenAI-compatible của máy đó.

## 5. Cấu trúc thư mục

```
backend/
  app/
    main.py        # toàn bộ API endpoints
    auth.py        # đăng ký, đăng nhập HTTP Basic, băm mật khẩu PBKDF2
    llm.py         # gọi model chấm lỗi, prompt
    db.py          # kết nối PostgreSQL, tạo bảng khi khởi động
    models.py      # User, Session, Message
    storage.py     # MinIO: lưu và đọc file ghi âm
    topics.json    # 29 chủ đề (SINH RA từ samples_src.py, đừng sửa tay)
  samples_src.py   # NGUỒN câu luyện, câu mở đầu, ghi chú phát âm
  scripts/build_topics.py   # sinh lại topics.json từ samples_src.py
frontend/
  src/
    App.jsx                 # khung app, tab, sidebar
    api.js                  # mọi lệnh gọi API
    speech.js               # TTS, nhận giọng nói, bộ lắng nghe theo lượt
    drills.js               # cặp âm dễ nhầm có sẵn
    components/
      ChatView.jsx          # màn hình trò chuyện
      PracticeView.jsx      # luyện câu
      DrillView.jsx         # sửa lỗi
      HistoryView.jsx       # lịch sử
      Mascot.jsx            # nhân vật Sao (SVG)
  scripts/make_og.py        # vẽ ảnh preview mạng xã hội (public/og-image.png)
deploy/                     # agent chạy trên VPS và cấu hình nginx
docker-compose.yml          # môi trường dev
docker-compose.prod.yml     # môi trường production (dùng image trên Docker Hub)
DEPLOY.md                   # hướng dẫn triển khai
```

## 6. Quy ước khi làm việc

- **Sửa câu luyện**: sửa `backend/samples_src.py`, rồi chạy `python backend/scripts/build_topics.py`. Không sửa `topics.json` bằng tay.
- **Ngôn ngữ**: UI, thông báo lỗi và ghi chú phát âm đều bằng tiếng Anh. Comment trong code có thể tiếng Việt hoặc tiếng Anh.
- **Line endings**: repo dùng LF (đã có `.gitattributes`). Đừng commit file CRLF. Đặc biệt `deploy/vps-agent.sh` phải là LF, vì bash trên VPS sẽ lỗi nếu có `\r`.
- **Không commit secret**: `.env`, key, token đều đã nằm trong `.gitignore`. Kiểm tra `git status` trước khi commit.
- **Thay đổi schema database**: bảng được tạo bằng `create_all` khi khởi động. Thay đổi cột của bảng đã tồn tại cần viết migration thủ công (xem `db.py` làm mẫu).
- **Push lên `main`** sẽ kích hoạt CI build image. VPS tự deploy trong vòng 1 phút sau khi image sẵn sàng.

## 7. Kiểm tra nhanh

```bash
curl http://localhost:8080/api/health        # {"ok":true}
```

Hiện chưa có bộ test tự động. Kiểm tra bằng tay: đăng ký, chat một lượt bằng chữ, mở Practice và Fix mistakes, rồi mở History.

## 8. Lỗi thường gặp

- **Micro không hoạt động**: dùng Chrome hoặc Edge, mở qua `localhost` hoặc `https`, và cho phép micro khi trình duyệt hỏi.
- **Bot không trả lời, chỉ thấy "Sao is replying..."**: kiểm tra `OPENAI_API_KEY` và `OPENAI_BASE_URL`. Lỗi API hiện ngay trong khung chat. Xem log: `docker compose logs backend`.
- **Port 8080 đã bận**: đổi `APP_PORT` trong `.env`.
- **Không tải được ảnh preview trên mạng xã hội**: thẻ `og:image` trỏ tới domain production. Ở local điều này là bình thường.
- **Sửa code nhưng trang không đổi**: với Docker, chạy lại `docker compose up -d --build`. Với `npm run dev`, tải lại trang.
- **`/api` trả 401**: phiên đăng nhập đã hết hạn, đăng nhập lại.

## 9. Triển khai

Xem [DEPLOY.md](DEPLOY.md) để biết luồng CI/CD, cài agent trên VPS, và cấu hình nginx và Cloudflare.
