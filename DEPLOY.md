# Triển khai lên VPS

Domain: **https://eng.ntuanvu89.id.vn** (đổi tên nếu bạn muốn, phải sửa đồng bộ trong `deploy/*.conf`).

## Luồng

```
git push main
  └─ GitHub Actions
       ├─ build backend + frontend → push ghcr.io/tuanvunguyen89/eng-voice-{backend,frontend}:<sha>
       └─ SSH vào VPS → /opt/eng-voice/deploy/deploy.sh <sha>
            ├─ git reset về origin/main
            ├─ docker compose -f docker-compose.prod.yml pull && up -d
            └─ health check http://127.0.0.1:9120/api/health

Trình duyệt → Cloudflare (proxy, SSL Full strict)
           → nginx biên 113.190.235.211:443 (origin.pem)
           → VPS 192.168.2.61:80 (nginx, theo server_name)
           → 127.0.0.1:9120 (frontend container) → backend / postgres / minio (trong mạng docker)
```

Port 9120 chỉ bind trên `127.0.0.1` của VPS, nên không lộ ra ngoài.

## 1. GitHub: secrets và environment

Repo → **Settings → Secrets and variables → Actions**, thêm:

| Secret | Giá trị |
|---|---|
| `VPS_HOST` | IP/host SSH của VPS (ví dụ `192.168.2.61` nếu SSH từ mạng nội bộ, hoặc IP công khai) |
| `VPS_USER` | user SSH trên VPS (ví dụ `deploy`) |
| `VPS_SSH_KEY` | private key ed25519 của user đó (nội dung đầy đủ, gồm dòng BEGIN/END) |
| `VPS_PORT` | (tuỳ chọn) port SSH, mặc định 22 |

Tạo key riêng cho CI, không dùng key cá nhân:

```bash
ssh-keygen -t ed25519 -C "github-actions-eng-voice" -f ~/eng-voice-ci -N ""
# public key → VPS:
ssh-copy-id -i ~/eng-voice-ci.pub user@VPS
# private key ~/eng-voice-ci → dán vào secret VPS_SSH_KEY
```

Tạo environment **production** (Settings → Environments → New). Nên bật "Required reviewers" để mỗi lần deploy phải bấm duyệt.

Package GHCR: sau lần push đầu, vào Packages → từng package → **Package settings → Change visibility → Public** để VPS kéo không cần đăng nhập. Nếu muốn giữ private, xem bước 2.3.

## 2. VPS: chuẩn bị một lần

### 2.1 Cài Docker và clone repo

```bash
sudo mkdir -p /opt/eng-voice && sudo chown $USER:$USER /opt/eng-voice
git clone https://github.com/TuanVuNguyen89/eng-voice.git /opt/eng-voice
cd /opt/eng-voice
```

Repo đang public nên clone không cần token. Nếu bạn đổi sang private, dùng deploy key hoặc PAT.

### 2.2 Tạo file `.env` (KHÔNG commit)

```bash
cp .env.example .env
nano .env
```

Điền thật (đổi các giá trị mặc định):

```
OPENAI_API_KEY=...          # key của bạn
OPENAI_BASE_URL=https://omniroute.tunyen.com/v1
OPENAI_MODEL=uberllm/anthropic/claude-haiku-5.5
POSTGRES_PASSWORD=<openssl rand -hex 24>
MINIO_ROOT_USER=<tên ngẫu nhiên>
MINIO_ROOT_PASSWORD=<openssl rand -hex 24>
APP_PORT=9120
```

Kiểm tra port 9120 còn trống: `ss -ltn | grep 9120` (không có dòng nào là ổn).

### 2.3 Đăng nhập GHCR (chỉ cần nếu package để private)

Tạo PAT (classic) với quyền `read:packages`, rồi:

```bash
echo "<PAT>" | docker login ghcr.io -u TuanVuNguyen89 --password-stdin
```

### 2.4 Cho phép user deploy chạy docker và script

```bash
sudo usermod -aG docker $USER      # đăng xuất/đăng nhập lại sau lệnh này
chmod +x /opt/eng-voice/deploy/deploy.sh
```

Thử deploy tay lần đầu (cần image đã được CI push, tức là đã chạy workflow ít nhất một lần):

```bash
cd /opt/eng-voice && bash deploy/deploy.sh latest
```

## 3. VPS nginx (port 80, cùng kiểu với các site khác)

Tạo file `/etc/nginx/sites-available/eng.ntuanvu89.id.vn` với nội dung `deploy/vps-nginx-eng.conf`, rồi bật:

```bash
sudo ln -s /etc/nginx/sites-available/eng.ntuanvu89.id.vn /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
curl -s -H "Host: eng.ntuanvu89.id.vn" http://127.0.0.1/api/health   # → {"ok":true}
```

## 4. nginx biên (113.190.235.211)

Thêm một site giống `hermes.ntuanvu89.id.vn`, nội dung trong `deploy/edge-nginx-eng.conf`. Đường dẫn cert phải trỏ đúng file hiện có (`origin.pem`, `origin.key`) trên máy đó. Nếu cert hiện tại chỉ dành cho hermes, dùng cert Cloudflare Origin cho `*.ntuanvu89.id.vn`.

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 5. Cloudflare

1. **DNS → Add record**: Type `A`, Name `eng`, IPv4 `113.190.235.211`, **Proxied** (đám mây cam). Giống record `hermes` trong ảnh.
2. **SSL/TLS → Overview**: đặt **Full (strict)** (vì nginx biên đang dùng cert origin hợp lệ).
3. Chứng chỉ Universal `*.ntuanvu89.id.vn` đã Active, nên không cần cấp thêm.

## 6. Chạy lần đầu

1. Đẩy code lên `main` (xem mục 7). Workflow build image và chờ bạn duyệt environment `production`.
2. Mở https://eng.ntuanvu89.id.vn, đăng ký tài khoản và kiểm tra app.

## 7. Push code lên GitHub

```bash
cd D:\project\english-bots
git init -b main
git add .
git status            # KIỂM TRA: không được thấy .env
git commit -m "Initial commit: eng-voice (React + FastAPI + PostgreSQL + MinIO)"
git remote add origin https://github.com/TuanVuNguyen89/eng-voice.git
git push -u origin main
```

## Cập nhật sau này

Chỉ cần `git push origin main`. CI tự build, bạn duyệt environment, VPS tự deploy.

Rollback: trên VPS chạy `bash /opt/eng-voice/deploy/deploy.sh <sha-cũ>`, với sha là tag image trước đó trong GHCR.

## Lưu ý bảo mật

- `.env` và private key không bao giờ được commit. `.gitignore` đã chặn `.env`.
- Key OpenAI đã từng xuất hiện trong chat, nên nên đổi sang key mới.
- Basic Auth chỉ an toàn khi đi qua HTTPS. Từ trình duyệt đến Cloudflare và từ Cloudflare đến nginx biên là HTTPS. Đoạn nginx biên → VPS (`192.168.2.61:80`) vẫn là HTTP, nên chỉ chấp nhận được khi nó nằm trong mạng nội bộ hoặc VPN đáng tin cậy.
- Postgres và MinIO không được publish ra ngoài; chỉ frontend có port 127.0.0.1:9120.
