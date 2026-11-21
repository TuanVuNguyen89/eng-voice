# Luyện nói tiếng Anh

Bot luyện nói tiếng Anh bằng giọng nói: chọn chủ đề, trò chuyện, bot chấm lỗi ngữ pháp và gợi ý phát âm.

## Cấu trúc
- `frontend/`: React (Vite), phục vụ bằng nginx. Nhận giọng nói và đọc bằng Web Speech API của trình duyệt.
- `backend/`: Python (FastAPI). Gọi AI qua endpoint OpenAI-compatible, lưu hội thoại vào PostgreSQL, lưu file ghi âm vào MinIO.
- `docker-compose.yml`: chạy toàn bộ: PostgreSQL, MinIO, backend, frontend.

## Chạy
1. Cài Docker Desktop.
2. `cp .env.example .env` rồi điền `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`.
3. `docker compose up -d --build`
4. Mở http://localhost:8080. MinIO console: http://localhost:9001 (user/pass trong `.env`).
5. Dừng: `docker compose down`. Xoá cả dữ liệu: `docker compose down -v`.

Nếu không có API key, bot vẫn hội thoại theo kịch bản nhưng không chấm lỗi.

## Hành vi nghe và nói
- Bot chỉ nói một lần mỗi câu trả lời. Muốn nghe lại, bấm 🔊.
- Micro tạm tắt khi bot đang nói, để không tự nghe giọng bot.
- Bot chờ bạn: ngừng khoảng 2 giây thì gửi câu; nếu câu đang dở (ví dụ kết thúc bằng "and", "because") thì chờ khoảng 4 giây.
- Có thể bấm ⏎ để gửi câu ngay.

## Dữ liệu
- PostgreSQL: bảng `sessions` (mỗi cuộc trò chuyện) và `messages` (từng câu, phản hồi, liên kết file ghi âm).
- MinIO: bucket `speak-audio`, file ghi âm từng lượt nói.

## Đăng nhập (HTTP Basic)
- Đăng ký tại màn hình đầu tiên: tên 3-32 ký tự (chữ, số, `_ . -`), mật khẩu ít nhất 6 ký tự.
- Mỗi yêu cầu gửi header `Authorization: Basic ...`. Trình duyệt giữ thông tin trong `sessionStorage` (mất khi đóng tab).
- Mật khẩu được băm bằng PBKDF2-SHA256 (200.000 vòng, có salt). Không lưu mật khẩu gốc.
- Hội thoại và file ghi âm chỉ người sở hữu mới xem/xoá được.
- Basic Auth gửi mật khẩu (mã hoá base64, không phải mã hoá) trên mỗi request. Khi đưa lên mạng công cộng **bắt buộc dùng HTTPS**.
