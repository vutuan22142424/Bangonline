# BANG! Online

Bản online của board game **BANG!** (miền Viễn Tây), xây bằng Next.js, chơi
nhiều người nhiều thiết bị theo thời gian thực (Supabase Realtime), deploy
trên Vercel.

## Đã làm được (trong bộ khung này)

- Đầy đủ 16 nhân vật gốc + bộ 80 lá bài chuẩn (Bang!, Missed!, Beer, Panic,
  Cat Balou, Duel, Indians!, Gatling, Saloon, Stagecoach, Wells Fargo,
  General Store, Barrel, Scope, Mustang, Jail, Dynamite, và 5 loại súng).
- Chia vai trò (Sheriff/Deputy/Outlaw/Renegade) đúng theo số người chơi.
- Luồng chơi: rút bài đầu lượt (kể cả check Dynamite/Jail), ra bài, target,
  trả lời Bang!/Duel/Indians!/General Store, bỏ bài dư cuối lượt, qua lượt.
- Tính khoảng cách theo vòng ghế + điều chỉnh Mustang/Scope, tầm bắn theo
  vũ khí trang bị.
- Kiểm tra thắng thua sau mỗi lần có người chết.
- Phòng chờ (lobby), tạo/tham gia bằng mã phòng, đồng bộ real-time qua
  Supabase.
- Ẩn thông tin đúng luật: mỗi người chỉ thấy bài của chính mình; state đầy đủ
  không bao giờ lộ ra browser (xem phần Kiến trúc bên dưới).

## Còn cần bạn tự làm/tinh chỉnh (rất hợp để đưa vào đồ án)

- Khả năng nhân vật đặc biệt chưa cài đủ 100%: Kit Carlson (xem 3 lá chọn 2),
  Black Jack (rút thêm khi lật Cơ/Rô), Jesse Jones / Pedro Ramirez (chọn
  nguồn rút lá đầu lượt), Sid Ketchum (bỏ 2 lá hồi máu bất kỳ lúc nào), Suzy
  Lafayette, Slab the Killer (cần 2 Missed!), Lucky Duke (lật 2 chọn 1) —
  đều đã có trong `lib/data/characters.ts` nhưng logic thật cần thêm vào
  `lib/gameEngine.ts` / `lib/actions.ts`.
- Gatling hiện xử lý luôn sát thương (chưa cho từng người trả lời Missed!
  riêng) — có TODO trong code.
- Race condition: route `action` đọc rồi ghi state không có khoá — với đồ án
  demo (vài người chơi test) sẽ ổn, nhưng nếu làm kỹ hơn nên chuyển logic vào
  1 Postgres function (`plpgsql`) để lock theo `room_id`.
- Chưa có UI xác nhận trước khi đánh bài (confirm dialog), chưa có
  animation, chưa có âm thanh.

## Kiến trúc

```
Browser (Next.js client) ──┬─> Supabase Realtime (chỉ nhận "version đã đổi")
                            │
                            └─> Next.js API routes (server, dùng service key)
                                   │
                                   └─> Supabase Postgres (state đầy đủ, có bài úp)
```

- `game_states` (chứa bài úp, vai trò...) **không** có RLS policy nào cho
  client đọc trực tiếp → chỉ server (service role key) đọc/ghi được.
- `room_state_version` là bảng công khai nhỏ, chỉ chứa số version. Mỗi lần
  server cập nhật state, nó cũng cập nhật bảng này. Client subscribe
  Realtime vào bảng này, thấy đổi thì gọi API `/state?playerId=...` để lấy
  view đã được ẩn thông tin phù hợp (bài người khác chỉ trả về số lượng, vai
  trò ẩn nếu chưa lộ).
- Toàn bộ logic luật chơi nằm trong `lib/gameEngine.ts` (turn flow, sát
  thương, thắng thua) và `lib/actions.ts` (xử lý từng loại hành động).

## Setup

### 1. Cài đặt

```bash
npm install
```

### 2. Tạo project Supabase

1. Vào https://supabase.com → New Project.
2. Vào **SQL Editor**, dán nội dung file `supabase/schema.sql` và chạy.
3. Vào **Project Settings → API**, lấy:
   - `Project URL` → dùng cho `SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ giữ bí mật, không
     commit, không thêm tiền tố `NEXT_PUBLIC_`)

### 3. Tạo file `.env.local`

```bash
cp .env.example .env.local
# rồi điền 4 giá trị ở trên
```

### 4. Chạy thử local

```bash
npm run dev
```

Mở nhiều tab/trình duyệt khác nhau (hoặc điện thoại) để test nhiều người
chơi — mỗi tab là 1 người chơi khác nhau.

## Deploy lên Vercel

1. Đẩy code lên GitHub.
2. Vào https://vercel.com → New Project → chọn repo này.
3. Trong **Environment Variables**, thêm đúng 4 biến ở bước 3 phía trên.
4. Deploy. Xong — chia sẻ link + mã phòng cho bạn bè là chơi được.

## Cấu trúc thư mục

```
app/
  page.tsx                 # Lobby: tạo phòng / vào phòng
  room/[roomId]/page.tsx   # Bàn chơi chính
  api/rooms/                       # tạo phòng
  api/rooms/[roomId]/join/         # vào phòng
  api/rooms/[roomId]/start/        # bắt đầu ván (chia bài, vai trò)
  api/rooms/[roomId]/state/        # lấy state đã ẩn thông tin
  api/rooms/[roomId]/action/       # thực hiện 1 hành động trong game
lib/
  types.ts             # Định nghĩa kiểu dữ liệu
  data/cards.ts         # Bộ 80 lá bài + tra loại bài theo id
  data/characters.ts    # 16 nhân vật + vai trò theo số người chơi
  gameEngine.ts         # Setup ván, turn flow, sát thương, thắng thua
  actions.ts            # Xử lý từng action người chơi gửi lên
  redact.ts             # Ẩn thông tin riêng trước khi trả về client
  supabaseServer.ts     # Supabase client (service role, server-only)
  supabaseClient.ts     # Supabase client (anon key, browser)
supabase/schema.sql    # Schema + RLS policies
components/
  CardView.tsx, PlayerSeat.tsx
```
