# Triển khai lên VPS qua Docker Hub

Domain: **https://eng.ntuanvu89.id.vn**

## Luồng

```
git push main
  └─ GitHub Actions (.github/workflows/deploy.yml)
       └─ build backend + frontend → docker.io/<user>/eng-voice-{backend,frontend}:<sha>, :latest

VPS, cron mỗi phút (/opt/eng-voice/vps-agent.sh poll)
  ├─ hỏi GitHub API: commit mới nhất trên main là gì?
  ├─ so với commit đã deploy; nếu khác và image của commit đó đã có trên Docker Hub
  └─ tải docker-compose.prod.yml đúng commit đó, compose pull, up -d, health check

Trình duyệt → Cloudflare (proxy, SSL Full strict)
           → nginx biên 113.190.235.211:443 (origin.pem)
           → VPS 192.168.2.61:80 (nginx theo server_name)
           → 127.0.0.1:9120 (frontend) → backend / postgres / minio
```

GitHub không truy cập VPS. Cron chạy mỗi phút, nhưng gọi GitHub bằng ETag nên commit không đổi thì không tốn giới hạn API. VPS không cần git, chỉ cần curl để đọc GitHub và kéo image Docker Hub (image nên để Public).

## Phần A. Docker Hub

1. Đăng nhập https://hub.docker.com. Ghi nhớ **username**.
2. Vào **Account settings → Personal access tokens → Generate new token**.
   - Description: `github-actions-eng-voice`
   - Access permissions: **Read & Write**
   - Copy token ngay (chỉ hiện một lần).
3. (Tuỳ chọn) Tạo sẵn hai repository `eng-voice-backend` và `eng-voice-frontend`, để Public. Nếu không tạo sẵn, lần push đầu Docker Hub tự tạo, nhưng mặc định là Private.
   - Để Public thì VPS kéo image không cần đăng nhập.

## Phần B. GitHub: thêm secrets và variables

Repo `TuanVuNguyen89/eng-voice` → **Settings → Secrets and variables → Actions**.

**Tab "Variables" → New repository variable**

| Name | Value |
|---|---|
| `DOCKERHUB_USERNAME` | username Docker Hub của bạn |

**Tab "Secrets" → New repository secret**

| Name | Value |
|---|---|
| `DOCKERHUB_TOKEN` | token ở Phần A bước 2 |

Không cần đưa `OPENAI_API_KEY` hay mật khẩu database vào GitHub. CI chỉ build image; các giá trị đó nằm trong `.env` trên VPS.

Nếu sau này bạn muốn đặt env theo environment (ví dụ `production`), vào **Settings → Environments → New environment**. Các giá trị đặt ở đó chỉ dùng được cho job có khai báo `environment: production`, nên job build hiện tại không đọc được chúng.

## Phần C. VPS: cài đặt một lần (không cần git clone)

**VPS đã cài trước đó (cron 5 phút):** đổi sang mỗi phút bằng một trong hai cách:
- Chạy `crontab -e`, sửa `*/5 * * * *` thành `* * * * *` cho dòng `vps-agent.sh poll`.
- Hoặc tải lại `vps-agent.sh` mới rồi chạy `bash vps-agent.sh install`. Lệnh này thay dòng cron cũ và không hỏi lại `.env`.

Yêu cầu: VPS đã có Docker và `docker compose`, user hiện tại nằm trong nhóm `docker`, có `openssl` và `curl`.

**Repo đang private**, nên VPS cần một token để tải file. Có hai cách, chọn một:
- **Cách 1 (đơn giản nhất):** đổi repo `eng-voice` sang **Public** (Settings → General → Danger Zone → Change visibility). Code không có secret nào, `.env` đã được gitignore. Khi đó không cần token.
- **Cách 2:** giữ private. Tạo fine-grained PAT tại GitHub → Settings → Developer settings → Fine-grained tokens:
  - Repository access: chỉ chọn `eng-voice`
  - Permissions: **Contents: Read-only**
  - Dán token này vào lúc cài (hoặc sau này sửa `GH_TOKEN` trong `/opt/eng-voice/.env`).

Lệnh cài đặt, chạy trên VPS:

```bash
mkdir -p ~/eng-voice-setup && cd ~/eng-voice-setup
# Cách 1 (public):
curl -fsSL https://raw.githubusercontent.com/TuanVuNguyen89/eng-voice/main/deploy/vps-agent.sh -o vps-agent.sh
# Cách 2 (private): thêm header token
# curl -fsSL -H "Authorization: token <GH_TOKEN>" https://raw.githubusercontent.com/TuanVuNguyen89/eng-voice/main/deploy/vps-agent.sh -o vps-agent.sh

bash vps-agent.sh install
```

Script sẽ hỏi lần lượt: Docker Hub username, `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `APP_PORT`, và `GH_TOKEN` (để trống nếu repo public). Nó tự tạo mật khẩu Postgres và MinIO ngẫu nhiên, tạo `/opt/eng-voice/.env`, bật cron mỗi phút, rồi chạy deploy đầu tiên.

Kiểm tra:
```bash
tail -f /opt/eng-voice/deploy.log
crontab -l
```

Lần deploy đầu có thể báo "chưa có image" nếu CI chưa build xong. Khi đó cron sẽ tự thử lại sau 1 phút.

## Phần D. Nginx và Cloudflare

**VPS nginx (port 80):** copy `deploy/vps-nginx-eng.conf` vào `/etc/nginx/sites-available/eng.ntuanvu89.id.vn`, rồi:
```bash
sudo ln -s /etc/nginx/sites-available/eng.ntuanvu89.id.vn /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**nginx biên (113.190.235.211):** thêm site theo `deploy/edge-nginx-eng.conf`, kiểm tra đường dẫn cert, rồi `sudo nginx -t && sudo systemctl reload nginx`.

**Cloudflare:**
1. DNS → Add record: Type `A`, Name `eng`, IPv4 `113.190.235.211`, **Proxied** (cam).
2. SSL/TLS → Overview → **Full (strict)**.

## Phần E. Push code và chạy lần đầu

```bash
cd D:\project\english-bots
git add -A && git status        # KIỂM TRA: không có .env
git commit -m "..."
git push origin main
```

1. Vào tab **Actions** trên GitHub, đợi job `build-images` xanh.
2. Trên VPS, chờ tối đa 1 phút hoặc chạy tay: `bash /opt/eng-voice/vps-agent.sh poll`
3. Xem log: `tail -f ~/eng-voice-deploy.log`
4. Mở https://eng.ntuanvu89.id.vn.

## Rollback

```bash
cd /opt/eng-voice
IMAGE_TAG=<sha-cũ> docker compose -f docker-compose.prod.yml up -d   # chạy ngay bản cũ
echo <sha-cũ> > /opt/eng-voice/.deployed-sha                          # để cron không ghi đè lại
```
Muốn quay về bản mới nhất: xoá file `/opt/eng-voice/.deployed-sha`, cron sẽ deploy lại `main` ở lần chạy kế tiếp.

## Lưu ý bảo mật

- `.env` và token không bao giờ được commit. `.gitignore` đã chặn `.env`.
- Key OpenAI đã từng xuất hiện trong chat, nên đổi sang key mới.
- Đổi token Docker Hub nếu nó lộ.
- Basic Auth chỉ an toàn qua HTTPS. Đoạn nginx biên → VPS (`192.168.2.61:80`) là HTTP nên chỉ dùng trong mạng nội bộ đáng tin.
- Postgres và MinIO không publish ra ngoài. Chỉ frontend có port `127.0.0.1:9120`.
