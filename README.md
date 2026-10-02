# MoneyMate — Quản lý chi tiêu cá nhân

Ứng dụng di động (Android + iOS) viết bằng **Expo / React Native + TypeScript**.
Dữ liệu lưu **ngay trên điện thoại** (SQLite) — không có server, không cần deploy.

## Tính năng (MVP theo spec)

| Màn hình | Nội dung |
|---|---|
| Tổng quan | Tổng số dư, thu/chi tháng này, chênh lệch, số dư từng tài khoản, ngân sách sắp hết, giao dịch gần đây |
| Giao dịch | Tìm kiếm (không dấu: "an trua" khớp "Ăn trưa", tìm theo số tiền), lọc theo loại / tài khoản / danh mục / ngày / số tiền, sắp xếp |
| **+** | Thêm Thu / Chi / Chuyển khoản. Gõ số tiền → chạm danh mục → Lưu. Nút nhanh `000`, `+50K`… Ghi chú không bắt buộc |
| Ngân sách | Hạn mức tháng theo danh mục, thanh tiến độ, cảnh báo ≥80%, vượt ≥100% (chỉ cảnh báo, không chặn) |
| Báo cáo | Thu vs chi, tỷ lệ tiết kiệm, biểu đồ tròn theo danh mục, xu hướng theo tuần / tháng / năm |
| Cài đặt | Tài khoản, danh mục (tạo / sửa / đổi icon, màu / lưu trữ), **tuỳ chỉnh màu**, chế độ tối, sao lưu / khôi phục JSON |

**Tuỳ chỉnh giao diện** (Cài đặt → Màu sắc & chế độ tối): màu chủ đạo (16 màu có sẵn hoặc nhập mã HEX bất kỳ),
màu khoản thu, màu khoản chi, chế độ Sáng / Tối / Theo máy. Màu chữ trên nền tự động chọn đen/trắng để luôn đọc được.

## Chạy thử nhanh trên điện thoại (không cần build)

1. Cài app **Expo Go** từ Google Play / App Store.
2. Trên máy tính (cùng mạng Wi-Fi với điện thoại):
   ```bash
   npm install
   npx expo start
   ```
3. Quét mã QR (Android: bằng Expo Go; iPhone: bằng Camera).

> Cách này cần máy tính đang chạy `expo start`. Để có app cài cố định, build file cài đặt như dưới.

## Build file APK cho Android (cài trực tiếp, không lên Store)

### Cách 1 — Build trên cloud của Expo (khuyên dùng, không cần cài Android Studio)

Cần một tài khoản Expo miễn phí (https://expo.dev/signup).

```bash
npx eas-cli login
npx eas-cli build -p android --profile preview
```

Khi xong (~10–15 phút) sẽ có link tải file `.apk`. Mở link trên điện thoại → tải → cài
(cho phép "Cài ứng dụng không rõ nguồn gốc" nếu được hỏi). Gửi file APK qua Zalo / Drive cho người khác cũng được.

### Cách 2 — Build trên máy (cần Android Studio / Android SDK + JDK 17)

```bash
npx expo prebuild -p android
cd android
./gradlew assembleRelease
```

File nằm ở `android/app/build/outputs/apk/release/app-release.apk`.

## iOS — lưu ý quan trọng

iPhone **không cho cài file kiểu APK**. Các lựa chọn:

| Cách | Yêu cầu | Ghi chú |
|---|---|---|
| Expo Go (ở trên) | Miễn phí | Cần máy tính chạy `expo start` khi dùng |
| `npx eas-cli build -p ios --profile preview` | Apple Developer **99 USD/năm** | Cài qua link cho tối đa 100 thiết bị đã đăng ký, dùng 1 năm |
| Sideload bằng Apple ID miễn phí (Xcode trên Mac, hoặc AltStore / Sideloadly trên Windows) | Miễn phí | App hết hạn sau **7 ngày**, phải ký lại |

## Sao lưu dữ liệu

Dữ liệu nằm trong điện thoại, **gỡ app là mất**. Vào Cài đặt → *Xuất bản sao lưu* định kỳ và lưu file `.json`
(Drive, Zalo, email…). Khi đổi máy: cài app → Cài đặt → *Khôi phục từ bản sao lưu*.

## Phát triển

```bash
npm test            # unit test cho toàn bộ logic tính tiền
npm run typecheck   # kiểm tra TypeScript
npx expo start --web --port 19006   # xem nhanh trên trình duyệt
```

### Cấu trúc

```
src/
  app/            Màn hình (Expo Router — mỗi file là một route)
    (tabs)/       Tổng quan, Giao dịch, Ngân sách, Báo cáo
    transaction.tsx, budget-edit.tsx, accounts/, categories/, settings.tsx, appearance.tsx
  domain/         Logic nghiệp vụ thuần (không phụ thuộc UI) + test
    calc.ts         số dư, tổng hợp thu/chi, ngân sách, xu hướng
    validation.ts   kiểm tra dữ liệu giao dịch
    filter.ts       tìm kiếm / lọc / sắp xếp
  db/             SQLite: schema + migration, repository (mọi thao tác ghi đều validate và chạy trong transaction)
  state/          DataProvider — nạp dữ liệu, tính số dư, hiển thị thông báo
  theme/          Bảng màu, tuỳ chỉnh màu người dùng, chế độ tối
  components/     UI dùng chung, biểu đồ (react-native-svg)
```

### Quy tắc tiền tệ (theo spec)

- Số tiền là **số nguyên** (VND), luôn > 0. Không dùng số thực.
- **Số dư không được lưu** — luôn tính lại = số dư ban đầu + thu − chi − chuyển đi + chuyển đến, nên không bao giờ lệch.
- Chuyển khoản không tính vào thu, chi hay ngân sách.
- Tài khoản / danh mục đã có giao dịch không xoá được → lưu trữ. Ràng buộc này được enforce cả ở tầng code và bằng
  `FOREIGN KEY` + `CHECK` trong SQLite.
- Ngân sách chỉ cảnh báo, không chặn giao dịch.

### Chưa làm (để giai đoạn sau, theo spec)

Giao dịch định kỳ, mục tiêu tiết kiệm, "Có thể chi tiêu" (cần giao dịch định kỳ + mục tiêu), lịch, thông báo,
nhập nhanh bằng câu ("ăn trưa 50k"), nhiều loại tiền tệ.
