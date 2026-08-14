// ============================================================
// Script kiểm tra tổng tiền BK và HD từ file Excel gốc
// So sánh: tự tính từ dòng chi tiết vs dòng tổng cộng trong file
// ============================================================
const XLSX = require('xlsx');
const path = require('path');

// ==================== UTILS (copy từ utils.js) ====================
function removeAccents(str) {
    if (!str) return '';
    const accents = 'ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯưẠạẢảẤấẦầẨẩẪẫẬậẮắẰằẲẳẴẵẶặẸẹẺẻẼẽẾếỀềỂểỄễỆệỈỉỊịỌọỎỏỐốỒồỔổỖỗỘộỚớỜờỞởỠỡỢợỤụỦủỨứỪừỬửỮữỰựỲỳỴỵỶỷỸỹ';
    const noAccents = 'AAAAEEEIIOOOOUUYaaaaeeeiiiooouuyAaDdIiUuOoUuAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaOoOoOoOoOoOoOoOoOoOoOoOoOoOoOoOoUuUuUuUuUuUuUuYyYyYyYyYy';
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const idx = accents.indexOf(char);
        result += idx >= 0 ? noAccents[idx] : char;
    }
    return result;
}

function normalizeStr(s) {
    if (!s) return '';
    return String(s).trim().toUpperCase().replace(/\s+/g, ' ');
}

function normalizeTen(s) {
    if (!s) return '';
    return removeAccents(normalizeStr(s));
}

function parseNumber(v) {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return v;
    let s = String(v).trim();
    let lastDot = s.lastIndexOf('.');
    let lastComma = s.lastIndexOf(',');
    if (lastDot > lastComma && lastDot > 0) {
        s = s.replace(/,/g, '');
    } else if (lastComma > lastDot && lastComma > 0) {
        s = s.replace(/\./g, '').replace(',', '.');
    } else {
        s = s.replace(/[,.]/g, '');
    }
    s = s.replace(/[^0-9.\-]/g, '');
    return parseFloat(s) || 0;
}

function normalizeSoHD(soHD) {
    if (!soHD) return '';
    let s = String(soHD).trim();
    s = s.replace(/^0+/, '');
    return s || '0';
}

function serialToDate(serial) {
    if (!serial || isNaN(serial)) return '';
    const d = new Date((serial - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0];
}

function formatMoney(amount) {
    if (amount === undefined || amount === null) return '0';
    return Number(amount).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ==================== ĐỌC FILE ====================
function readExcel(filePath) {
    const wb = XLSX.readFile(filePath, { cellDates: false });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    return rows;
}

// ==================== KIỂM TRA BẢNG KÊ BÁN RA ====================
function checkBangKeBanRa(rows) {
    console.log('\n========== KIỂM TRA BẢNG KÊ BÁN RA ==========');
    console.log(`Tổng số dòng: ${rows.length}`);

    // Config: headerRow=0, fillSoHD=true
    // Columns: soHD=0, ngay=1, ten=2, mst=3, matHang=4, tienChuaThue=5, thueSuat=6, thueGTGT=7
    const headerRow = 0;
    const col = { soHD: 0, ngay: 1, ten: 2, mst: 3, matHang: 4, tienChuaThue: 5, thueSuat: 6, thueGTGT: 7 };

    // In dòng header
    console.log(`\n--- Dòng header (dòng ${headerRow + 1}) ---`);
    console.log(rows[headerRow]);

    // Parse từng dòng
    let items = [];
    let lastSoHD = '';
    let lastNgay = '';
    let lastTen = '';
    let lastMST = '';
    let tongCongRow = null; // Dòng tổng cộng

    for (let r = headerRow + 1; r < rows.length; r++) {
        const row = rows[r];
        let soHD = String(row[col.soHD] || '').trim();

        // Bỏ qua dòng nhóm
        if (soHD.startsWith('Nhóm')) continue;
        // Bỏ qua dòng tổng cộng
        if (normalizeStr(soHD) === 'TỔNG CỘNG') {
            tongCongRow = { row: r + 1, data: row };
            continue;
        }
        const tenRaw = String(row[col.ten] || '').trim();
        if (normalizeStr(tenRaw) === 'TỔNG CỘNG') {
            tongCongRow = { row: r + 1, data: row };
            continue;
        }

        // Fill số HĐ
        if (soHD) {
            lastSoHD = soHD;
            lastNgay = row[col.ngay];
            lastTen = row[col.ten];
            lastMST = row[col.mst];
        }
        soHD = lastSoHD;

        const ngayRaw = lastNgay || row[col.ngay];
        const ngay = typeof ngayRaw === 'number' ? serialToDate(ngayRaw) : String(ngayRaw || '').trim();
        const ten = lastTen || row[col.ten];
        const mst = lastMST || row[col.mst];

        const tienChuaThue = parseNumber(row[col.tienChuaThue]);
        const thueGTGT = parseNumber(row[col.thueGTGT]);

        items.push({
            row: r + 1,
            soHD: normalizeSoHD(soHD),
            ngay: ngay,
            ten: normalizeStr(ten),
            tienChuaThue: tienChuaThue,
            thueGTGT: thueGTGT
        });
    }

    console.log(`\n--- Tổng số dòng dữ liệu (chi tiết): ${items.length} ---`);

    // Tính tổng từ chi tiết
    let tongTienTuChiTiet = 0;
    let tongThueTuChiTiet = 0;
    for (const item of items) {
        tongTienTuChiTiet += item.tienChuaThue;
        tongThueTuChiTiet += item.thueGTGT;
    }

    console.log(`\n>>> TỰ TÍNH TỪ DÒNG CHI TIẾT:`);
    console.log(`   Tổng tiền trước thuế: ${formatMoney(tongTienTuChiTiet)} đ`);
    console.log(`   Tổng tiền thuế:       ${formatMoney(tongThueTuChiTiet)} đ`);

    // In dòng tổng cộng nếu có
    if (tongCongRow) {
        console.log(`\n>>> DÒNG TỔNG CỘNG TRONG FILE (dòng ${tongCongRow.row}):`);
        console.log(`   Raw data:`, tongCongRow.data);
        const tongTienFile = parseNumber(tongCongRow.data[col.tienChuaThue]);
        const tongThueFile = parseNumber(tongCongRow.data[col.thueGTGT]);
        console.log(`   Tiền trước thuế: ${formatMoney(tongTienFile)} đ`);
        console.log(`   Tiền thuế:       ${formatMoney(tongThueFile)} đ`);

        // So sánh
        const tienDiff = Math.abs(tongTienTuChiTiet - tongTienFile);
        const thueDiff = Math.abs(tongThueTuChiTiet - tongThueFile);
        console.log(`\n>>> SO SÁNH:`);
        console.log(`   Tiền trước thuế: ${tienDiff < 1 ? '✅ KHỚP' : '❌ LỆCH ' + formatMoney(tienDiff) + ' đ'}`);
        console.log(`   Tiền thuế:       ${thueDiff < 1 ? '✅ KHỚP' : '❌ LỆCH ' + formatMoney(thueDiff) + ' đ'}`);
    } else {
        console.log(`\n>>> KHÔNG CÓ dòng tổng cộng trong file`);
    }

    // Gộp theo (số HĐ + ngày) để kiểm tra
    console.log(`\n--- GỘP THEO (SỐ HĐ + NGÀY) ---`);
    const grouped = {};
    for (const item of items) {
        const key = item.soHD + '|' + item.ngay;
        if (!grouped[key]) {
            grouped[key] = { soHD: item.soHD, ngay: item.ngay, ten: item.ten, tongTien: 0, tongThue: 0, count: 0 };
        }
        grouped[key].tongTien += item.tienChuaThue;
        grouped[key].tongThue += item.thueGTGT;
        grouped[key].count++;
    }
    const groups = Object.values(grouped);
    console.log(`   Số nhóm (số HĐ + ngày): ${groups.length}`);

    let tongTienGrouped = 0;
    let tongThueGrouped = 0;
    for (const g of groups) {
        tongTienGrouped += g.tongTien;
        tongThueGrouped += g.tongThue;
    }
    console.log(`   Tổng tiền sau gộp: ${formatMoney(tongTienGrouped)} đ`);
    console.log(`   Tổng thuế sau gộp: ${formatMoney(tongThueGrouped)} đ`);

    const groupTienDiff = Math.abs(tongTienTuChiTiet - tongTienGrouped);
    const groupThueDiff = Math.abs(tongThueTuChiTiet - tongThueGrouped);
    console.log(`   Tiền: ${groupTienDiff < 1 ? '✅ KHỚP' : '❌ LỆCH ' + formatMoney(groupTienDiff) + ' đ'}`);
    console.log(`   Thuế: ${groupThueDiff < 1 ? '✅ KHỚP' : '❌ LỆCH ' + formatMoney(groupThueDiff) + ' đ'}`);

    return { items, groups, tongTienTuChiTiet, tongThueTuChiTiet, tongCongRow };
}

// ==================== KIỂM TRA HÓA ĐƠN BÁN RA ====================
function detectHDColumns(headerRow) {
    // Auto-detect column indices based on header content
    const col = { soHD: -1, ngay: -1, tenMua: -1, tienChuaThue: -1, tienThue: -1, tongTT: -1, trangThai: -1 };
    for (let i = 0; i < headerRow.length; i++) {
        const h = normalizeStr(String(headerRow[i]));
        if (h === 'SỐ HÓA ĐƠN') col.soHD = i;
        if (h === 'NGÀY LẬP') col.ngay = i;
        if (h === 'TÊN NGƯỜI MUA/TÊN NGƯỜI NHẬN HÀNG') col.tenMua = i;
        if (h === 'TỔNG TIỀN CHƯA THUẾ') col.tienChuaThue = i;
        if (h === 'TỔNG TIỀN THUẾ') col.tienThue = i;
        if (h === 'TỔNG TIỀN THANH TOÁN') col.tongTT = i;
        if (h.includes('TRẠNG THÁI')) col.trangThai = i;
    }
    return col;
}

function checkHoaDonBanRa(rows, fileLabel) {
    console.log(`\n========== KIỂM TRA HÓA ĐƠN BÁN RA (${fileLabel}) ==========`);
    console.log(`Tổng số dòng: ${rows.length}`);

    // Auto-detect header row and columns
    let headerRow = -1;
    let col = null;
    for (let r = 0; r < Math.min(10, rows.length); r++) {
        const row = rows[r];
        const testCol = detectHDColumns(row);
        if (testCol.soHD >= 0 && testCol.tienChuaThue >= 0) {
            headerRow = r;
            col = testCol;
            break;
        }
    }
    if (headerRow < 0) {
        console.log(`   ❌ Không tìm thấy header row! Dùng mặc định headerRow=3`);
        headerRow = 3;
        col = { soHD: 3, ngay: 4, tenMua: 8, tienChuaThue: 10, tienThue: 11, tongTT: 14, trangThai: 17 };
    }

    // In dòng header
    console.log(`\n--- Dòng header (dòng ${headerRow + 1}) ---`);
    console.log(rows[headerRow]);

    let items = [];
    let skippedThayThe = 0;
    let tongCongRow = null;

    for (let r = headerRow + 1; r < rows.length; r++) {
        const row = rows[r];
        const soHD = String(row[col.soHD] || '').trim();
        if (!soHD) continue;

        // Kiểm tra trạng thái
        if (col.trangThai !== undefined) {
            const trangThai = String(row[col.trangThai] || '').trim().toLowerCase();
            if (trangThai.includes('bị thay thế')) {
                skippedThayThe++;
                continue;
            }
        }

        // Kiểm tra dòng tổng cộng
        if (normalizeStr(soHD) === 'TỔNG CỘNG') {
            tongCongRow = { row: r + 1, data: row };
            continue;
        }

        const ngayRaw = String(row[col.ngay] || '').trim();
        let ngay = ngayRaw;
        if (ngayRaw.includes('/')) {
            const parts = ngayRaw.split('/');
            if (parts.length === 3) {
                ngay = parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
            }
        }

        const ten = normalizeStr(row[col.tenMua]);
        const tienChuaThue = parseNumber(row[col.tienChuaThue]);
        const tienThue = parseNumber(row[col.tienThue]);
        const tongTT = parseNumber(row[col.tongTT]);

        items.push({
            row: r + 1,
            soHD: normalizeSoHD(soHD),
            ngay: ngay,
            ten: ten,
            tienChuaThue: tienChuaThue,
            tienThue: tienThue,
            tongTT: tongTT
        });
    }

    console.log(`\n--- Tổng số hóa đơn (sau khi bỏ qua bị thay thế): ${items.length} ---`);
    console.log(`   Số HĐ bị thay thế đã bỏ qua: ${skippedThayThe}`);

    // Tính tổng từ chi tiết
    let tongTienTuChiTiet = 0;
    let tongThueTuChiTiet = 0;
    let tongTTTuChiTiet = 0;
    for (const item of items) {
        tongTienTuChiTiet += item.tienChuaThue;
        tongThueTuChiTiet += item.tienThue;
        tongTTTuChiTiet += item.tongTT;
    }

    console.log(`\n>>> TỰ TÍNH TỪ DÒNG CHI TIẾT:`);
    console.log(`   Tổng tiền trước thuế: ${formatMoney(tongTienTuChiTiet)} đ`);
    console.log(`   Tổng tiền thuế:       ${formatMoney(tongThueTuChiTiet)} đ`);
    console.log(`   Tổng thanh toán:      ${formatMoney(tongTTTuChiTiet)} đ`);

    // Kiểm tra: tienChuaThue + tienThue = tongTT ?
    let tongTTDiffCount = 0;
    for (const item of items) {
        const expected = item.tienChuaThue + item.tienThue;
        if (Math.abs(expected - item.tongTT) > 1) {
            tongTTDiffCount++;
            if (tongTTDiffCount <= 3) {
                console.log(`   ❌ Dòng ${item.row}: ${item.soHD} - ${item.ten}: ${formatMoney(item.tienChuaThue)} + ${formatMoney(item.tienThue)} = ${formatMoney(expected)} != ${formatMoney(item.tongTT)} (tongTT)`);
            }
        }
    }
    if (tongTTDiffCount === 0) {
        console.log(`\n✅ Tất cả các dòng: tienChuaThue + tienThue = tongTT`);
    } else {
        console.log(`\n❌ Có ${tongTTDiffCount} dòng không khớp tienChuaThue + tienThue != tongTT`);
    }

    // In dòng tổng cộng nếu có
    if (tongCongRow) {
        console.log(`\n>>> DÒNG TỔNG CỘNG TRONG FILE (dòng ${tongCongRow.row}):`);
        console.log(`   Raw data:`, tongCongRow.data);
        const tongTienFile = parseNumber(tongCongRow.data[col.tienChuaThue]);
        const tongThueFile = parseNumber(tongCongRow.data[col.tienThue]);
        const tongTTFile = parseNumber(tongCongRow.data[col.tongTT]);
        console.log(`   Tiền trước thuế: ${formatMoney(tongTienFile)} đ`);
        console.log(`   Tiền thuế:       ${formatMoney(tongThueFile)} đ`);
        console.log(`   Tổng thanh toán: ${formatMoney(tongTTFile)} đ`);

        const tienDiff = Math.abs(tongTienTuChiTiet - tongTienFile);
        const thueDiff = Math.abs(tongThueTuChiTiet - tongThueFile);
        const ttDiff = Math.abs(tongTTTuChiTiet - tongTTFile);
        console.log(`\n>>> SO SÁNH VỚI DÒNG TỔNG CỘNG:`);
        console.log(`   Tiền trước thuế: ${tienDiff < 1 ? '✅ KHỚP' : '❌ LỆCH ' + formatMoney(tienDiff) + ' đ'}`);
        console.log(`   Tiền thuế:       ${thueDiff < 1 ? '✅ KHỚP' : '❌ LỆCH ' + formatMoney(thueDiff) + ' đ'}`);
        console.log(`   Tổng thanh toán: ${ttDiff < 1 ? '✅ KHỚP' : '❌ LỆCH ' + formatMoney(ttDiff) + ' đ'}`);
    } else {
        console.log(`\n>>> KHÔNG CÓ dòng tổng cộng trong file`);
    }

    return { items, tongTienTuChiTiet, tongThueTuChiTiet, tongTTTuChiTiet };
}

// ==================== MAIN ====================
const baseDir = path.join(__dirname);
const fs = require('fs');

// Tìm file BK
const bkFiles = fs.readdirSync(baseDir).filter(f => f.includes('Bang_ke') && f.endsWith('.xlsx'));
const bkFile = path.join(baseDir, bkFiles[0]);
console.log(`Base dir: ${baseDir}`);
console.log(`BK file: ${bkFiles[0]}`);

// Tìm file HD - dùng dynamic lookup, chuẩn hóa tên file (bỏ dấu) để so sánh
const allFiles = fs.readdirSync(baseDir);
console.log(`\nTất cả file trong thư mục:`);
allFiles.forEach(f => console.log(`   - ${f}`));

const hdFiles = allFiles.filter(f => {
    if (!f.endsWith('.xlsx')) return false;
    if (f.includes('Bang_ke')) return false;
    const normalized = removeAccents(f.toUpperCase());
    return normalized.includes('DANH SACH') && normalized.includes('HOA DON');
});
console.log(`\nHD files tìm thấy: ${hdFiles.length}`);
hdFiles.forEach(f => console.log(`   - ${f}`));

if (hdFiles.length === 0) {
    console.log(`\n❌ KHÔNG TÌM THẤY file hóa đơn nào! Kiểm tra lại tên file.`);
    console.log(`Thử tìm với pattern khác...`);
    const altHdFiles = allFiles.filter(f => f.endsWith('.xlsx') && !f.includes('Bang_ke'));
    console.log(`Các file .xlsx không phải BK:`);
    altHdFiles.forEach(f => console.log(`   - ${f}`));
    process.exit(1);
}

console.log(`\n=== ĐỌC FILE: ${path.basename(bkFile)} ===`);
const bkRows = readExcel(bkFile);
const bkResult = checkBangKeBanRa(bkRows);

let allHDItems = [];
for (const f of hdFiles) {
    const hdPath = path.join(baseDir, f);
    console.log(`\n=== ĐỌC FILE: ${f} ===`);
    try {
        const hdRows = readExcel(hdPath);
        const hdResult = checkHoaDonBanRa(hdRows, f);
        allHDItems.push(...hdResult.items);
    } catch (err) {
        console.log(`   ❌ LỖI đọc file: ${err.message}`);
    }
}

// Tổng hợp tất cả HD
console.log(`\n========== TỔNG HỢP TẤT CẢ HÓA ĐƠN ==========`);
console.log(`   Tổng số hóa đơn: ${allHDItems.length}`);

let tongTienAllHD = 0;
let tongThueAllHD = 0;
let tongTTAllHD = 0;
for (const item of allHDItems) {
    tongTienAllHD += item.tienChuaThue;
    tongThueAllHD += item.tienThue;
    tongTTAllHD += item.tongTT;
}
console.log(`   Tổng tiền trước thuế: ${formatMoney(tongTienAllHD)} đ`);
console.log(`   Tổng tiền thuế:       ${formatMoney(tongThueAllHD)} đ`);
console.log(`   Tổng thanh toán:      ${formatMoney(tongTTAllHD)} đ`);

// ==================== SO SÁNH BK VS HD ====================
console.log(`\n========== SO SÁNH BẢNG KÊ VS HÓA ĐƠN ==========`);
console.log(`\n--- BẢNG KÊ (đã gộp theo số HĐ + ngày) ---`);
console.log(`   Số nhóm: ${bkResult.groups.length}`);
console.log(`   Tổng tiền trước thuế: ${formatMoney(bkResult.tongTienTuChiTiet)} đ`);
console.log(`   Tổng tiền thuế:       ${formatMoney(bkResult.tongThueTuChiTiet)} đ`);

console.log(`\n--- HÓA ĐƠN (tất cả file) ---`);
console.log(`   Số hóa đơn: ${allHDItems.length}`);
console.log(`   Tổng tiền trước thuế: ${formatMoney(tongTienAllHD)} đ`);
console.log(`   Tổng tiền thuế:       ${formatMoney(tongThueAllHD)} đ`);

const bkVsHDTien = Math.abs(bkResult.tongTienTuChiTiet - tongTienAllHD);
const bkVsHDThue = Math.abs(bkResult.tongThueTuChiTiet - tongThueAllHD);
console.log(`\n--- SO SÁNH BK VS HD ---`);
console.log(`   Tiền trước thuế: ${bkVsHDTien < 1 ? '✅ KHỚP' : '❌ LỆCH ' + formatMoney(bkVsHDTien) + ' đ'}`);
console.log(`   Tiền thuế:       ${bkVsHDThue < 1 ? '✅ KHỚP' : '❌ LỆCH ' + formatMoney(bkVsHDThue) + ' đ'}`);

// ==================== KIỂM TRA TỪNG NHÓM BK ====================
console.log(`\n========== KIỂM TRA TỪNG NHÓM BẢNG KÊ ==========`);
let bkMatchCount = 0;
let bkMismatchCount = 0;
let bkMissingHDCount = 0;

for (const bk of bkResult.groups) {
    // Tìm HD tương ứng (cùng số HĐ + ngày)
    const matchingHD = allHDItems.filter(hd => hd.soHD === bk.soHD && hd.ngay === bk.ngay);
    
    if (matchingHD.length === 0) {
        bkMissingHDCount++;
        if (bkMissingHDCount <= 5) {
            console.log(`   ❌ THIẾU HĐ: ${bk.soHD} | ${bk.ngay} | ${bk.ten} | ${formatMoney(bk.tongTien)} đ`);
        }
        continue;
    }

    // Tính tổng tiền HD matching
    let tongTienHD = 0;
    let tongThueHD = 0;
    for (const hd of matchingHD) {
        tongTienHD += hd.tienChuaThue;
        tongThueHD += hd.tienThue;
    }

    const tienDiff = Math.abs(bk.tongTien - tongTienHD);
    const thueDiff = Math.abs(bk.tongThue - tongThueHD);
    
    if (tienDiff < 1 && thueDiff < 1) {
        bkMatchCount++;
    } else {
        bkMismatchCount++;
        if (bkMismatchCount <= 5) {
            console.log(`   ⚠️ LỆCH: ${bk.soHD} | ${bk.ngay} | ${bk.ten}`);
            console.log(`      BK: ${formatMoney(bk.tongTien)} đ (thuế: ${formatMoney(bk.tongThue)} đ)`);
            console.log(`      HD: ${formatMoney(tongTienHD)} đ (thuế: ${formatMoney(tongThueHD)} đ)`);
            console.log(`      Chênh lệch tiền: ${formatMoney(bk.tongTien - tongTienHD)} đ`);
            console.log(`      Chênh lệch thuế: ${formatMoney(bk.tongThue - tongThueHD)} đ`);
        }
    }
}

console.log(`\n--- KẾT QUẢ SO SÁNH TỪNG NHÓM ---`);
console.log(`   ✅ Khớp: ${bkMatchCount}`);
console.log(`   ⚠️ Lệch: ${bkMismatchCount}`);
console.log(`   ❌ Thiếu HĐ: ${bkMissingHDCount}`);
console.log(`   Tổng: ${bkMatchCount + bkMismatchCount + bkMissingHDCount} (BK groups: ${bkResult.groups.length})`);

console.log(`\n========== KẾT THÚC KIỂM TRA ==========`);
