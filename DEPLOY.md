# Triển khai lên VPS (kéo về, không SSH từ GitHub)

Domain: **https://eng.ntuanvu89.id.vn**

## Luồng

```
git push main
  └─ GitHub Actions (.github/workflows/deploy.yml)
       └─ build backend + frontend → ghcr.io/tuanvunguyen89/eng-voice-{backend,frontend}:<sha>

VPS, cron mỗi 5 phút (deploy/poll-deploy.sh)
  ├─ git fetch origin/main → có commit mới chưa deploy?
  ├─ image của commit đó đã có trên GHCR chưa?
  └─ có → deploy/deploy.sh <sha>: git reset, compose pull, up -d, health check

Trình duyệt → Cloudflare (proxy, SSL Full strict)
           → nginx biên 113.190.235.211:443 (origin.pem)
           → VPS 192.168.2.61:80 (nginx theo server_name)
           → 127.0.0.1:9120 (frontend) → backend / postgres / minio
```

GitHub không cần truy cập VPS. Thời gian từ lúc push đến lúc lên production: tối đa khoảng 5 phút sau khi CI build xong.

## 1. GitHub

Không cần secret nào cho deploy. Workflow chỉ dùng `GITHUB_TOKEN` có sẵn để đẩy image.

Sau lần build đầu tiên, vào **Packages** → từng package (`eng-voice-backend`, `eng-voice-frontend`) → **Package settings → Change visibility → Public**. Khi đó VPS kéo image không cần đăng nhập.

Nếu giữ private, xem bước 2.3.

## 2. VPS: cài đặt một lần

### 2.1 Clone repo

```bash
sudo mkdir -p /opt/eng-voice && sudo chown $USER:$USER /opt/eng-voice
git clone https://github.com/TuanVuNguyen89/eng-voice.git /opt/eng-voice
cd /opt/eng-voice
chmod +x deploy/*.sh
```

### 2.2 Tạo `.env` (không commit)

```bash
cp .env.example .env && nano .env
```

Điền thật:

```
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://omniroute.tunyen.com/v1
OPENAI_MODEL=uberllm/anthropic/claude-haiku-5.5
POSTGRES_PASSWORD=<openssl rand -hex 24>
MINIO_ROOT_USER=<tên ngẫu nhiên>
MINIO_ROOT_PASSWORD=<openssl rand -hex 24>
APP_PORT=9120
```

Kiểm tra port trống: `ss -ltn | grep 9120` (không có dòng nào là ổn).

### 2.3 Nếu package để private

Tạo PAT (classic) có quyền `read:packages`:

```bash
echo "<PAT>" | docker login ghcr.io -u TuanVuNguyen89 --password-stdin
```

### 2.4 Quyền docker

```bash
sudo usermod -aG docker $USER     # đăng xuất rồi đăng nhập lại
```

### 2.5 Chạy thử một lần (sau khi CI đã build xong)

```bash
bash /opt/eng-voice/deploy/poll-deploy.sh
```

Lần đầu, script sẽ deploy commit mới nhất trên `main` nếu image đã có. Nếu log báo "not ready", đợi CI xong rồi chạy lại.

### 2.6 Bật cron mỗi 5 phút

```bash
crontab -e
```

Thêm dòng:

```
*/5 * * * * bash /opt/eng-voice/deploy/poll-deploy.sh >> $HOME/eng-voice-deploy.log 2>&1
```

Xem log: `tail -f ~/eng-voice-deploy.log`. Khi không có gì mới, script không ghi log nên file vẫn gọn.

## 3. VPS nginx (port 80)

Copy `deploy/vps-nginx-eng.conf` vào `/etc/nginx/sites-available/eng.ntuanvu89.id.vn`:

```bash
sudo ln -s /etc/nginx/sites-available/eng.ntuanvu89.id.vn /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
curl -s -H "Host: eng.ntuanvu89.id.vn" http://127.0.0.1/api/health   # → {"ok":true}
```

## 4. nginx biên (113.190.235.211)

Thêm site theo `deploy/edge-nginx-eng.conf`. Kiểm tra đường dẫn cert `origin.pem` và `origin.key` có đúng trên máy này.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Cloudflare

1. **DNS → Add record**: Type `A`, Name `eng`, IPv4 `113.190.235.211`, **Proxied** (cam).
2. **SSL/TLS → Overview**: **Full (strict)**.
3. Cert Universal `*.ntuanvu89.id.vn` đang Active, không cần cấp thêm.

## 6. Push code

```bash
cd D:\project\english-bots
git add -A && git status        # KIỂM TRA: không có .env
git commit -m "..."
git push origin main
```

## Rollback

```bash
cd /opt/eng-voice && bash deploy/deploy.sh <sha-cũ>
echo <sha-cũ> > ~/.eng-voice-deployed-sha     # để cron không deploy lại commit mới nhất
```

Sau rollback, muốn quay lại bản mới nhất chỉ cần xoá file `~/.eng-voice-deployed-sha`, cron sẽ deploy lại `origin/main`.

## Lưu ý bảo mật

- `.env` và mọi secret không được commit. `.gitignore` đã chặn `.env`.
- Key OpenAI đã từng xuất hiện trong chat, nên đổi sang key mới.
- Basic Auth chỉ an toàn qua HTTPS. Từ trình duyệt đến nginx biên là HTTPS. Đoạn nginx biên → VPS (`192.168.2.61:80`) là HTTP, chỉ chấp nhận được trong mạng nội bộ đáng tin.
- Postgres và MinIO không publish ra ngoài. Chỉ frontend có port `127.0.0.1:9120`.
