/**
 * app.js - Logic chính của tool
 * - Đọc 2 file Excel
 * - So sánh thuế suất
 * - Xác định hóa đơn sai
 * - Tạo file hóa đơn thay thế
 */

// ===== Biến toàn cục =====
let soBanHangData = [];      // Dữ liệu sổ chi tiết bán hàng
let danhSachHangData = [];   // Dữ liệu danh sách hàng hóa
let danhSachHangMap = {};    // Map mã hàng hóa -> thuế suất chuẩn
let hoaDonSaiList = [];      // Danh sách hóa đơn bị sai
let chiTietSaiList = [];     // Chi tiết các dòng hàng sai

// ===== Cấu trúc file mẫu hóa đơn thay thế =====
const MAU_HOA_DON_HEADER = [
    'Số thứ tự hóa đơn (*)',
    'Ngày hóa đơn',
    'Tên đơn vị mua hàng',
    'Mã số thuế',
    'Địa chỉ',
    'Người mua hàng',
    'Email',
    'Số điện thoại',
    'Căn cước công dân',
    'Hình thức thanh toán (*)',
    'HD bị thay thế thuộc hệ thống khác',
    'Ký hiệu HD bị thay thế (*)',
    'Số hóa đơn bị thay thế (*)',
    'Ngày hóa đơn bị thay thế',
    'Mã của CQT trên HD bị thay thế',
    'Tên hàng hóa/dịch vụ (*)',
    'ĐVT',
    'Số lượng',
    'Đơn giá',
    'Thành tiền',
    'Thuế suất GTGT (%)',
    'Tiền thuế GTGT'
];

// ===== Khởi tạo sự kiện =====
document.addEventListener('DOMContentLoaded', function () {
    const fileSoBanHang = document.getElementById('fileSoBanHang');
    const fileDanhSachHang = document.getElementById('fileDanhSachHang');
    const btnChay = document.getElementById('btnChay');
    const btnTaiFile = document.getElementById('btnTaiFile');

    fileSoBanHang.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('statusSoBanHang').textContent = '✓ ' + file.name;
            document.getElementById('statusSoBanHang').classList.add('loaded');
        }
        checkReady();
    });

    fileDanhSachHang.addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            document.getElementById('statusDanhSachHang').textContent = '✓ ' + file.name;
            document.getElementById('statusDanhSachHang').classList.add('loaded');
        }
        checkReady();
    });

    btnChay.addEventListener('click', handleChaySoSanh);
    btnTaiFile.addEventListener('click', handleTaiFile);
});

function checkReady() {
    const fileSoBanHang = document.getElementById('fileSoBanHang').files[0];
    const fileDanhSachHang = document.getElementById('fileDanhSachHang').files[0];
    document.getElementById('btnChay').disabled = !(fileSoBanHang && fileDanhSachHang);
}

// ===== Xử lý chạy so sánh =====
async function handleChaySoSanh() {
    const fileSoBanHang = document.getElementById('fileSoBanHang').files[0];
    const fileDanhSachHang = document.getElementById('fileDanhSachHang').files[0];

    if (!fileSoBanHang || !fileDanhSachHang) {
        alert('Vui lòng chọn đủ 2 file!');
        return;
    }

    try {
        // Đọc 2 file
        soBanHangData = await readExcelFile(fileSoBanHang);
        danhSachHangData = await readExcelFile(fileDanhSachHang);

        // Xây dựng map mã hàng hóa -> thuế suất chuẩn
        buildDanhSachHangMap();

        // So sánh thuế suất
        const result = compareTaxRate();

        // Hiển thị kết quả
        displayResult(result);
    } catch (err) {
        console.error(err);
        alert('Có lỗi khi đọc file: ' + err.message);
    }
}

/**
 * Xây dựng map mã hàng hóa -> thuế suất chuẩn từ danh sách hàng hóa
 * Dữ liệu bắt đầu từ dòng 4 (index 3)
 * Cột 2 (index 1): Mã hàng hóa
 * Cột 8 (index 7): Thuế suất (%)
 */
function buildDanhSachHangMap() {
    danhSachHangMap = {};
    for (let i = 3; i < danhSachHangData.length; i++) {
        const row = danhSachHangData[i];
        if (!row || row.length < 8) continue;
        const maHang = String(row[1] || '').trim();
        const thueSuat = parseTaxRate(row[7]);
        if (maHang) {
            danhSachHangMap[maHang] = thueSuat;
        }
    }
}

/**
 * So sánh thuế suất giữa sổ bán hàng và danh sách hàng hóa
 * Dữ liệu sổ bán hàng bắt đầu từ dòng 4 (index 3)
 * Cột 1 (index 0): Ngày
 * Cột 2 (index 1): Mã đơn hàng eShop
 * Cột 3 (index 2): Số hóa đơn
 * Cột 4 (index 3): Mã hàng hóa
 * Cột 5 (index 4): Tên hàng hóa
 * Cột 6 (index 5): Đơn vị tính
 * Cột 7 (index 6): Số lượng
 * Cột 8 (index 7): Đơn giá trước thuế
 * Cột 9 (index 8): Thành tiền trước thuế
 * Cột 16 (index 15): Thuế GTGT
 */
function compareTaxRate() {
    chiTietSaiList = [];
    const hoaDonMap = {}; // Map key hóa đơn -> { info, dongHang: [], sai: bool }

    for (let i = 3; i < soBanHangData.length; i++) {
        const row = soBanHangData[i];
        if (!row || row.length < 16) continue;

        const ngay = String(row[0] || '').trim();
        const maDonHang = String(row[1] || '').trim();
        const soHoaDon = String(row[2] || '').trim();
        const maHang = String(row[3] || '').trim();
        const tenHang = String(row[4] || '').trim();
        const donViTinh = String(row[5] || '').trim();
        const soLuong = parseNumber(row[6]);
        const donGia = parseNumber(row[7]);
        const thanhTien = parseNumber(row[8]);
        const thueGTGT = parseNumber(row[15]);

        // Bỏ qua dòng trống
        if (!soHoaDon && !maHang) continue;

        // Tính thuế suất từ sổ bán hàng
        let thueSuatTinhDuoc = 0;
        if (thanhTien > 0) {
            thueSuatTinhDuoc = (thueGTGT / thanhTien) * 100;
        }

        // Lấy thuế suất chuẩn từ danh sách hàng hóa
        const thueSuatChuan = danhSachHangMap[maHang] !== undefined ? danhSachHangMap[maHang] : null;

        // So sánh (làm tròn 1 chữ số thập phân)
        let sai = false;
        let trangThai = 'Không có trong danh sách';
        if (thueSuatChuan !== null) {
            const diff = Math.abs(thueSuatTinhDuoc - thueSuatChuan);
            if (diff > 0.5) {
                sai = true;
                trangThai = 'SAI THUẾ SUẤT';
            } else {
                trangThai = 'Đúng';
            }
        }

        // Tạo key hóa đơn (Số hóa đơn + Ngày + Mã đơn hàng)
        const key = soHoaDon + '|' + ngay + '|' + maDonHang;

        if (!hoaDonMap[key]) {
            hoaDonMap[key] = {
                soHoaDon: soHoaDon,
                ngay: ngay,
                maDonHang: maDonHang,
                dongHang: [],
                sai: false
            };
        }

        hoaDonMap[key].dongHang.push({
            maHang: maHang,
            tenHang: tenHang,
            donViTinh: donViTinh,
            soLuong: soLuong,
            donGia: donGia,
            thanhTien: thanhTien,
            thueGTGT: thueGTGT,
            thueSuatTinhDuoc: thueSuatTinhDuoc,
            thueSuatChuan: thueSuatChuan,
            sai: sai,
            trangThai: trangThai
        });

        if (sai) {
            hoaDonMap[key].sai = true;
            chiTietSaiList.push({
                soHoaDon: soHoaDon,
                ngay: ngay,
                maDonHang: maDonHang,
                maHang: maHang,
                tenHang: tenHang,
                thueSuatTinhDuoc: thueSuatTinhDuoc,
                thueSuatChuan: thueSuatChuan
            });
        }
    }

    // Lọc ra các hóa đơn bị sai
    hoaDonSaiList = Object.values(hoaDonMap).filter(hd => hd.sai);

    return {
        tongHoaDon: Object.keys(hoaDonMap).length,
        tongHoaDonSai: hoaDonSaiList.length,
        tongDongSai: chiTietSaiList.length
    };
}

// ===== Hiển thị kết quả =====
function displayResult(result) {
    const resultSection = document.getElementById('resultSection');
    const detailSection = document.getElementById('detailSection');
    const summaryBox = document.getElementById('summaryBox');
    const resultBody = document.getElementById('resultBody');
    const detailBody = document.getElementById('detailBody');

    // Hiển thị section
    resultSection.style.display = 'block';
    detailSection.style.display = 'block';

    // Tóm tắt
    if (result.tongHoaDonSai === 0) {
        summaryBox.className = 'summary-box';
        summaryBox.innerHTML = `<strong>✅ Không phát hiện hóa đơn nào sai thuế suất!</strong><br>
            Tổng số hóa đơn: <strong>${result.tongHoaDon}</strong> | Hóa đơn sai: <strong>0</strong>`;
    } else {
        summaryBox.className = 'summary-box warning';
        summaryBox.innerHTML = `<strong>⚠️ Phát hiện ${result.tongHoaDonSai} hóa đơn sai thuế suất!</strong><br>
            Tổng số hóa đơn: <strong>${result.tongHoaDon}</strong> | Hóa đơn sai: <strong>${result.tongHoaDonSai}</strong> | Số dòng hàng sai: <strong>${result.tongDongSai}</strong>`;
    }

    // Bảng hóa đơn sai
    resultBody.innerHTML = '';
    hoaDonSaiList.forEach((hd, index) => {
        const soDongSai = hd.dongHang.filter(d => d.sai).length;
        const chiTiet = hd.dongHang
            .filter(d => d.sai)
            .map(d => `${d.maHang} - ${d.tenHang} (tính: ${d.thueSuatTinhDuoc.toFixed(1)}%, chuẩn: ${d.thueSuatChuan}%)`)
            .join('<br>');

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${hd.soHoaDon}</td>
            <td>${hd.ngay}</td>
            <td>${hd.maDonHang}</td>
            <td><span class="badge badge-sai">${soDongSai} dòng</span></td>
            <td style="white-space: normal; min-width: 300px;">${chiTiet}</td>
        `;
        resultBody.appendChild(tr);
    });

    // Bảng chi tiết dòng sai
    detailBody.innerHTML = '';
    chiTietSaiList.forEach((d, index) => {
        const tr = document.createElement('tr');
        tr.className = 'sai';
        tr.innerHTML = `
            <td>${d.soHoaDon}</td>
            <td>${d.maHang}</td>
            <td>${d.tenHang}</td>
            <td>${d.thueSuatTinhDuoc.toFixed(1)}%</td>
            <td>${d.thueSuatChuan}%</td>
            <td><span class="badge badge-sai">SAI</span></td>
        `;
        detailBody.appendChild(tr);
    });

    // Cuộn tới kết quả
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// ===== Tạo file hóa đơn thay thế =====
function handleTaiFile() {
    if (hoaDonSaiList.length === 0) {
        alert('Không có hóa đơn sai để tạo file thay thế!');
        return;
    }

    // Tạo dữ liệu file theo mẫu
    const data = buildHoaDonThayTheData();

    // Xuất file
    downloadExcel(data, 'Hoa_don_thay_the.xlsx');
    alert(`Đã tạo file hóa đơn thay thế cho ${hoaDonSaiList.length} hóa đơn!`);
}

/**
 * Xây dựng dữ liệu file hóa đơn thay thế theo cấu trúc mẫu
 * Hàng 1-8: Hướng dẫn
 * Hàng 9: Tiêu đề cột
 * Hàng 10+: Dữ liệu
 */
function buildHoaDonThayTheData() {
    const data = [];

    // Hàng 1-8: Hướng dẫn (giữ nguyên như mẫu)
    data.push(['File mẫu danh sách hóa đơn để nhập vào phần mềm']);
    data.push(['Hướng dẫn:']);
    data.push(['- Điền dữ liệu hóa đơn cần lập trên phần mềm vào các cột tương ứng trên file này']);
    data.push(['- Các cột có dấu (*) là những cột bắt buộc']);
    data.push(['- Nếu muốn nhập thêm thông tin khác, người dùng có thể tự thêm cột trên file này (VD: Mã khách hàng, Mã hàng, Tỷ lệ chiết khấu, Tiền chiết khấu,...)']);
    data.push(['- Các dòng dữ liệu phía dưới chỉ là ví dụ minh họa']);
    data.push([]);
    data.push([]);

    // Hàng 9: Tiêu đề cột
    data.push(MAU_HOA_DON_HEADER);

    // Hàng 10+: Dữ liệu hóa đơn thay thế
    let stt = 1;
    hoaDonSaiList.forEach(hd => {
        hd.dongHang.forEach((d, idx) => {
            const row = new Array(22).fill('');

            // Cột 1: Số thứ tự hóa đơn
            row[0] = stt;

            // Dòng đầu tiên của hóa đơn: điền thông tin hóa đơn
            if (idx === 0) {
                // Cột 2: Ngày hóa đơn
                row[1] = hd.ngay;
                // Cột 13: Số hóa đơn bị thay thế
                row[12] = hd.soHoaDon;
                // Cột 14: Ngày hóa đơn bị thay thế
                row[13] = hd.ngay;
                // Các cột 3-9, 10, 11, 12, 15 để trống (người dùng tự nhập)
            }

            // Cột 16: Tên hàng hóa/dịch vụ
            row[15] = d.tenHang;
            // Cột 17: ĐVT
            row[16] = d.donViTinh;
            // Cột 18: Số lượng
            row[17] = d.soLuong;
            // Cột 19: Đơn giá
            row[18] = d.donGia;
            // Cột 20: Thành tiền
            row[19] = d.thanhTien;
            // Cột 21: Thuế suất GTGT (%) - dùng thuế suất chuẩn
            row[20] = d.thueSuatChuan !== null ? d.thueSuatChuan : '';
            // Cột 22: Tiền thuế GTGT - tính lại theo thuế suất chuẩn
            if (d.thueSuatChuan !== null) {
                row[21] = Math.round(d.thanhTien * d.thueSuatChuan / 100);
            }

            data.push(row);
        });
        stt++;
    });

    return data;
}
