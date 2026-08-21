# 🧾 Tool Phát Hiện Hóa Đơn Sai Thuế Suất & Tạo Hóa Đơn Thay Thế

Tool chạy hoàn toàn trên trình duyệt, giúp tự động so sánh thuế suất giữa **Sổ chi tiết bán hàng** và **Danh sách hàng hóa**, phát hiện các hóa đơn bị sai thuế suất và tạo file hóa đơn thay thế theo mẫu.

## ✨ Tính năng

- 📁 Upload 3 file: **Sổ chi tiết bán hàng**, **Danh sách hàng hóa** và **File mẫu hóa đơn thay thế**
- 🔍 Tự động tính thuế suất từng dòng hàng: `Thuế GTGT / Thành tiền trước thuế × 100`
- ⚖️ So sánh với thuế suất chuẩn theo mã hàng hóa trong danh sách hàng hóa
- 🚨 Phát hiện hóa đơn bị sai thuế suất (hóa đơn có ≥ 1 dòng hàng sai)
- 📊 Hiển thị chi tiết các dòng hàng sai (thuế suất tính được vs thuế suất chuẩn)
- ⬇️ Tạo file hóa đơn thay thế `.xlsx` **dựa trên chính file mẫu gốc** (giữ nguyên định dạng, cấu trúc 22 cột) để úp trực tiếp vào hệ thống
- 👤 Tự động điền **"BÁN CHO NGƯỜI TIÊU DÙNG"** vào cột Người mua hàng

## 🚀 Cách sử dụng

1. **Mở tool**: Nhấp đúp vào file `index.html` (mở bằng trình duyệt Chrome/Edge/Firefox).
   > ⚠️ Cần có internet lần đầu để tải thư viện SheetJS từ CDN.

2. **Chọn file**:
   - **Sổ chi tiết bán hàng**: file `.xlsx` chứa dữ liệu bán hàng.
   - **Danh sách hàng hóa**: file `.xlsx` chứa danh mục hàng hóa và thuế suất chuẩn.
   - **File mẫu hóa đơn thay thế**: file `Mau_hoa_don_GTGT_MTT_Thay_the.xls` (để xuất đúng định dạng mẫu gốc).

3. **Bấm nút "🔍 Chạy so sánh thuế suất"**.

4. **Xem kết quả**:
   - Bảng tóm tắt: tổng số hóa đơn, số hóa đơn sai, số dòng hàng sai.
   - Bảng danh sách hóa đơn sai.
   - Bảng chi tiết từng dòng hàng sai (thuế suất tính được vs thuế suất chuẩn).

5. **Tải file hóa đơn thay thế**: Bấm nút "⬇️ Tải file hóa đơn thay thế (.xlsx)".

## 📄 Cấu trúc file kết quả

File kết quả được tạo **dựa trên chính file mẫu gốc** `Mau_hoa_don_GTGT_MTT_Thay_the.xls` (giữ nguyên định dạng, cấu trúc 22 cột, phần hướng dẫn và tiêu đề) và điền dữ liệu hóa đơn thay thế vào từ dòng 10:

| Cột | Nội dung | Ghi chú |
|-----|----------|---------|
| 1 | Số thứ tự hóa đơn (*) | Đánh số tự động 1, 2, 3... |
| 2 | Ngày hóa đơn | Lấy từ sổ bán hàng |
| 3-5 | Tên đơn vị, MST, Địa chỉ | **Để trống** - tự nhập tay |
| 6 | Người mua hàng | **"BÁN CHO NGƯỜI TIÊU DÙNG"** (tự động điền) |
| 7-9 | Email, SĐT, CCCD | **Để trống** - tự nhập tay |
| 10 | Hình thức thanh toán (*) | **Để trống** - tự nhập tay |
| 11 | HD bị thay thế thuộc hệ thống khác | Để trống |
| 12 | Ký hiệu HD bị thay thế (*) | **Để trống** - tự nhập tay |
| 13 | Số hóa đơn bị thay thế (*) | Lấy từ sổ bán hàng |
| 14 | Ngày hóa đơn bị thay thế | Lấy từ sổ bán hàng |
| 15 | Mã của CQT trên HD bị thay thế | Để trống |
| 16 | Tên hàng hóa/dịch vụ (*) | Lấy từ sổ bán hàng |
| 17 | ĐVT | Lấy từ sổ bán hàng |
| 18 | Số lượng | Lấy từ sổ bán hàng |
| 19 | Đơn giá | **Điều chỉnh** theo thuế suất chuẩn (làm tròn 2 chữ số thập phân) |
| 20 | Thành tiền | **Điều chỉnh** theo thuế suất chuẩn |
| 21 | Thuế suất GTGT (%) | **Thuế suất chuẩn** từ danh sách hàng hóa |
| 22 | Tiền thuế GTGT | **Điều chỉnh** theo thuế suất chuẩn |

### 🧮 Logic tính toán giá bán (giữ giá bán đã có thuế cố định)

Khi phát hiện hóa đơn sai thuế suất, tool **giữ nguyên giá bán đã có thuế (tổng tiền = Thành tiền + Tiền thuế)** như trong bảng kê, và điều chỉnh lại đơn giá + thành tiền trước thuế theo thuế suất chuẩn (8% hoặc 10%):

```
Tổng tiền gốc = Thành tiền gốc + Thuế GTGT gốc   (giữ nguyên)
Thành tiền mới = Tổng tiền gốc / (1 + Thuế suất chuẩn/100)
Tiền thuế mới = Tổng tiền gốc - Thành tiền mới    (đảm bảo tổng khớp chính xác)
Đơn giá mới = Thành tiền mới / Số lượng            (làm tròn 2 chữ số thập phân)
```

- **Thuế giảm** (ví dụ 10% → 8%): **tăng giá bán** để bù lại phần thuế giảm, giữ tổng tiền.
- **Thuế tăng** (ví dụ 8% → 10%): **giảm giá bán** để tổng tiền không đổi.
- Nếu thuế suất không đổi (hoặc không có trong danh sách hàng hóa): giữ nguyên đơn giá, thành tiền, tiền thuế.

## 📁 Cấu trúc dự án

```
thay-the-hoa-don-tool/
├── index.html          # Giao diện chính
├── css/
│   └── style.css       # Style giao diện
├── js/
│   ├── app.js          # Logic chính (so sánh, hiển thị, tạo file)
│   └── excel.js        # Hàm xử lý Excel bằng SheetJS
└── README.md           # Hướng dẫn sử dụng
```

## ⚙️ Yêu cầu

- Trình duyệt hiện đại (Chrome, Edge, Firefox).
- Internet (lần đầu tải SheetJS từ CDN).
- Không cần cài đặt thêm gì khác.

## 📝 Lưu ý

- File kết quả xuất ra định dạng `.xlsx` (mở được bằng Excel), dựa trên file mẫu gốc nên giữ nguyên định dạng để úp trực tiếp vào hệ thống.
- Cần chọn **file mẫu hóa đơn thay thế** (`Mau_hoa_don_GTGT_MTT_Thay_the.xls`) khi chạy tool.
- Các trường bắt buộc (*) chưa điền (tên đơn vị, MST, địa chỉ, ký hiệu HD, hình thức thanh toán) cần được nhập tay trước khi sử dụng file.
- Cột **Người mua hàng** tự động điền **"BÁN CHO NGƯỜI TIÊU DÙNG"**.
- Nếu một hóa đơn có nhiều dòng hàng mà chỉ 1 dòng sai thuế suất, toàn bộ hóa đơn sẽ được tạo lại (gồm tất cả các dòng hàng).
