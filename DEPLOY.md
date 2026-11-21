# Triển khai lên VPS qua Docker Hub

Domain: **https://eng.ntuanvu89.id.vn**

## Luồng

```
git push main
  └─ GitHub Actions (.github/workflows/deploy.yml)
       └─ build backend + frontend → docker.io/<user>/eng-voice-{backend,frontend}:<sha>, :latest

VPS, cron mỗi 5 phút (deploy/poll-deploy.sh)
  ├─ git fetch origin/main → có commit mới chưa deploy?
  ├─ image của commit đó đã có trên Docker Hub chưa?
  └─ có → deploy/deploy.sh <sha>: git reset, compose pull, up -d, health check

Trình duyệt → Cloudflare (proxy, SSL Full strict)
           → nginx biên 113.190.235.211:443 (origin.pem)
           → VPS 192.168.2.61:80 (nginx theo server_name)
           → 127.0.0.1:9120 (frontend) → backend / postgres / minio
```

GitHub không truy cập VPS. VPS không cần đăng nhập Docker Hub nếu repo image để Public.

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

## Phần C. VPS: cài đặt một lần

### C1. Clone repo
```bash
sudo mkdir -p /opt/eng-voice && sudo chown $USER:$USER /opt/eng-voice
git clone https://github.com/TuanVuNguyen89/eng-voice.git /opt/eng-voice
cd /opt/eng-voice && chmod +x deploy/*.sh
```

### C2. Tạo `.env` (không commit)
```bash
cp .env.example .env && nano .env
```
Điền:
```
IMAGE_NAMESPACE=<username Docker Hub>
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://omniroute.tunyen.com/v1
OPENAI_MODEL=uberllm/anthropic/claude-haiku-5.5
POSTGRES_PASSWORD=<openssl rand -hex 24>
MINIO_ROOT_USER=<tên ngẫu nhiên>
MINIO_ROOT_PASSWORD=<openssl rand -hex 24>
APP_PORT=9120
```
Kiểm tra port trống: `ss -ltn | grep 9120` (không có dòng nào là ổn).

### C3. Quyền Docker
```bash
sudo usermod -aG docker $USER      # đăng xuất rồi đăng nhập lại
```

### C4. Bật cron mỗi 5 phút
```bash
crontab -e
```
Thêm dòng:
```
*/5 * * * * bash /opt/eng-voice/deploy/poll-deploy.sh >> $HOME/eng-voice-deploy.log 2>&1
```

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
2. Trên VPS, chờ tối đa 5 phút hoặc chạy tay: `bash /opt/eng-voice/deploy/poll-deploy.sh`
3. Xem log: `tail -f ~/eng-voice-deploy.log`
4. Mở https://eng.ntuanvu89.id.vn.

## Rollback

```bash
cd /opt/eng-voice && bash deploy/deploy.sh <sha-cũ>
echo <sha-cũ> > ~/.eng-voice-deployed-sha     # để cron không tự deploy lại commit mới nhất
```
Muốn quay về bản mới nhất: xoá `~/.eng-voice-deployed-sha`.

## Lưu ý bảo mật

- `.env` và token không bao giờ được commit. `.gitignore` đã chặn `.env`.
- Key OpenAI đã từng xuất hiện trong chat, nên đổi sang key mới.
- Đổi token Docker Hub nếu nó lộ.
- Basic Auth chỉ an toàn qua HTTPS. Đoạn nginx biên → VPS (`192.168.2.61:80`) là HTTP nên chỉ dùng trong mạng nội bộ đáng tin.
- Postgres và MinIO không publish ra ngoài. Chỉ frontend có port `127.0.0.1:9120`.
