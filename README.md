# ORCA FINANCIAL Dashboard

Dashboard tài chính fullstack xây bằng **Next.js App Router + PostgreSQL + Drizzle ORM**.

> Bản cấu hình hiện tại đã được chỉnh để **Cloudflare Pages không còn bị `Page not found` do build/deploy sai luồng**. Để tương thích Pages, project đang dùng **Next.js 15.5.2 + @cloudflare/next-on-pages**.

Repo này đã được chỉnh để:
- đưa lên **GitHub public**
- chạy local được ngay
- deploy được qua **Netlify**
- deploy được qua **Cloudflare**
- giữ nguyên các tính năng:
  - search `[Thông tin] ngày xx/xx/xxxx`
  - export PDF / PNG
  - auto update **mỗi 1 giờ**
  - daily task riêng
  - snapshot dữ liệu vào PostgreSQL
  - responsive cho **mobile + laptop**
  - web notification khi có dữ liệu mới

---

## 1) Chạy local

```bash
npm install
cp .env.example .env
```

Sửa `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/app_db
CRON_SECRET=dev-secret
MIN_UPDATE_INTERVAL_MINUTES=50
PG_POOL_MAX=5
```

Đồng bộ schema:

```bash
npx drizzle-kit push
```

Chạy app:

```bash
npm run dev
```

Kiểm tra:

```txt
http://localhost:3000
http://localhost:3000/api/health
http://localhost:3000/api/dashboard
```

---

## 2) Đưa lên GitHub bằng GitHub Desktop

1. Mở **GitHub Desktop**
2. Chọn **Add an Existing Repository from your Hard Drive**
3. Chọn thư mục project này
4. Nếu chưa có repo git, chọn **Create Repository**
5. Commit với message ví dụ:
   - `initial commit`
6. Bấm **Commit to main**
7. Bấm **Publish repository**

### Nếu GitHub Desktop báo lỗi LF / CRLF
Repo đã có:
- `.gitattributes`
- `.editorconfig`

Nếu vẫn lỗi, chạy:

```bash
git config core.autocrlf false
git add --renormalize .
```

---

## 3) Deploy qua Netlify

Repo đã có file:
- `netlify.toml`

### Trên Netlify cần set env:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require
CRON_SECRET=your-secret
MIN_UPDATE_INTERVAL_MINUTES=50
PG_POOL_MAX=5
```

### Build command
Netlify sẽ đọc từ `netlify.toml`:

```txt
npm run build
```

### Sau khi deploy, test:

```txt
/api/health
/api/dashboard
/api/cron/hourly-update?force=1
```

---

## 4) Deploy qua Cloudflare Pages

Repo đã có sẵn:
- `wrangler.toml`
- package `@cloudflare/next-on-pages`
- npm scripts ngắn gọn trong `package.json`:
  - `npm run cf:build`
  - `npm run cf:preview`
  - `npm run cf:deploy`
  - `npm run cf:upload`

### Rất quan trọng
Project này nếu deploy lên **Cloudflare Pages** mà bị `Page not found`, nguyên nhân phổ biến nhất là:
1. build command đang để `npm run build`
2. không dùng adapter `@cloudflare/next-on-pages`
3. output directory không trỏ tới `.vercel/output/static`
4. route động chưa chạy Edge runtime
5. dùng database không phù hợp với môi trường Cloudflare

### Cách đúng để chạy Cloudflare Pages cho project này

### Test local theo luồng Cloudflare Pages
```bash
npm run cf:build
npm run cf:preview
```

### Deploy thủ công bằng Wrangler Pages
```bash
npm run cf:deploy
```

### Upload preview branch
```bash
npm run cf:upload
```

---

### Nếu dùng Cloudflare dashboard / Git integration
Cấu hình **chính xác** như sau:

#### Framework preset
```txt
Next.js
```

#### Build command
```bash
npm run cf:build
```

#### Build output directory
```txt
.vercel/output/static
```

#### Root directory
```txt
/
```

#### Node version
```txt
20
```

---

### Nếu bạn vẫn bị `Page not found`
Hãy kiểm tra 4 điểm này theo đúng thứ tự:

#### A. Build output directory có đúng là `.vercel/output/static` không?
Nếu không đúng, Cloudflare Pages sẽ deploy xong nhưng root route sẽ 404.

#### B. Build command có đang là `npm run build` không?
Nếu có, đổi thành:
```bash
npm run cf:build
```

#### C. Bạn có đang dùng route runtime kiểu Node không?
Tôi đã chuyển page và API routes sang:
```ts
export const runtime = "edge";
```
để tương thích hơn với Cloudflare Pages.

#### D. Database có dùng Cloudflare-friendly driver chưa?
Phải dùng:
```env
DB_DRIVER=neon
```

và `DATABASE_URL` của **Neon Postgres**. Nếu dùng Postgres TCP thông thường, build có thể pass nhưng runtime edge/pages rất dễ hỏng hoặc 404.

---

### Env cần có trên Cloudflare
```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require
CRON_SECRET=your-secret
MIN_UPDATE_INTERVAL_MINUTES=50
PG_POOL_MAX=5
DB_DRIVER=neon
```

> Khuyên dùng `DATABASE_URL` của **Neon Postgres** khi chạy trên Cloudflare Pages. Đây là lựa chọn ổn định hơn nhiều so với Postgres TCP truyền thống trong môi trường edge/serverless.


---

## 5) Real-time data + Cron update mỗi 1 giờ (BẮT BUỘC)

### Cơ chế hoạt động

#### A. Client-side (tự động, không cần cấu hình thêm)
- Dashboard gọi `/api/dashboard?auto=1` khi mở trang
- Tự refresh mỗi **1 giờ** bằng `setInterval`
- Tự refresh khi quay lại tab/browser (event `focus`)
- Nếu snapshot trong DB quá cũ (> 50 phút), API sẽ **tự quét dữ liệu mới real-time** rồi trả về
- Có thông báo web khi có snapshot mới

#### B. Server-side cron (cần cấu hình external cron)
Cloudflare Pages **không có cron scheduler tích hợp** như Vercel.
Vì vậy bạn cần dùng **external cron service miễn phí** để gọi API route mỗi giờ.

### Cách thiết lập cron mỗi 1 giờ (miễn phí)

#### Bước 1: lấy URL API
Sau khi deploy, URL cron sẽ là:

```txt
https://YOUR-SITE.pages.dev/api/cron/hourly-update?force=1
```

#### Bước 2: dùng một trong các dịch vụ cron miễn phí sau

| Dịch vụ | URL | Miễn phí |
|---------|-----|----------|
| **cron-job.org** | https://cron-job.org | ✅ 50 jobs miễn phí |
| **EasyCron** | https://www.easycron.com | ✅ 1 job miễn phí |
| **UptimeRobot** | https://uptimerobot.com | ✅ 50 monitors miễn phí |

#### Bước 3: cấu hình cron job
- URL: `https://YOUR-SITE.pages.dev/api/cron/hourly-update?force=1`
- Method: `GET`
- Schedule: mỗi **1 giờ** (hoặc `0 * * * *`)
- Header (nếu đặt CRON_SECRET):

```txt
Authorization: Bearer YOUR_CRON_SECRET
```

#### Bước 4: test thủ công
Sau khi deploy, mở trình duyệt:

```txt
https://YOUR-SITE.pages.dev/api/cron/hourly-update?force=1
```

Nếu thấy JSON trả về với `"ok": true`, cron hoạt động đúng.

### API / cron routes
- `/api/dashboard` — trả dữ liệu mới nhất, tự quét nếu cần
- `/api/cron/hourly-update` — trigger quét dữ liệu mới (dùng cho cron)
- `/api/cron/daily-update` — alias tương thích ngược
- `/api/cron/daily-task` — chạy tổng hợp theo ngày

---

## 6) Tính năng chính

### Nội dung
- thị trường Việt Nam
- thị trường toàn cầu
- vĩ mô Việt Nam
- vĩ mô toàn cầu
- hàng hóa chi tiết, nhiều nhóm
- tin quốc tế
- tin Việt Nam
- tin doanh nghiệp
- heatmap ngành
- kỹ thuật VNINDEX / VN30
- chiến lược đầu tư
- watchlist cổ phiếu

### Tương tác
- search theo từ khóa / ngày
- export PDF
- export PNG
- bật thông báo web
- refresh thủ công
- auto refresh mỗi 1 giờ

### Backend / database
- snapshot dữ liệu vào PostgreSQL
- auto scan quote + tin RSS
- healthcheck DB
- daily task + hourly task

---

## 7) File quan trọng

- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/DashboardClient.tsx`
- `src/components/SearchOverlay.tsx`
- `src/lib/dashboard-data.ts`
- `src/lib/dashboard-store.ts`
- `src/lib/search-index.ts`
- `src/lib/export-utils.ts`
- `src/db/index.ts`
- `src/db/schema.ts`
- `src/app/api/dashboard/route.ts`
- `src/app/api/cron/hourly-update/route.ts`
- `src/app/api/cron/daily-task/route.ts`
- `netlify.toml`
- `wrangler.toml`

---

## 8) Checklist trước khi public / deploy

- [ ] `.env` không commit lên GitHub
- [ ] `.next` không còn trong repo
- [ ] `.env.example` còn trong repo
- [ ] `README.md` còn trong repo
- [ ] `netlify.toml` còn trong repo
- [ ] `wrangler.toml` còn trong repo
- [ ] `DATABASE_URL` đã set trên môi trường deploy
- [ ] `CRON_SECRET` đã set trên môi trường deploy

---

## 9) Commit nhanh

```bash
git add . && git commit -m "update dashboard" && git push
```
