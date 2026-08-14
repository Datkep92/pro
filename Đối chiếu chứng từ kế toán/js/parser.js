// ============================================================
// Parse dữ liệu từ rows Excel
// ============================================================

/**
 * Tự động tìm dòng header trong bảng kê
 * Header là dòng có chứa "Số hóa đơn", "Ngày hóa đơn", "Tên người mua" (bán ra)
 * hoặc "Số hóa đơn", "Ngày hóa đơn", "Tên người bán" (mua vào)
 * @param {Array} rows - Mảng 2 chiều từ SheetJS
 * @param {number} defaultRow - Dòng header mặc định từ config
 * @returns {number} - Index của dòng header tìm được
 */
function findBangKeHeaderRow(rows, defaultRow) {
    // Thử dòng mặc định trước
    if (defaultRow >= 0 && defaultRow < rows.length) {
        const row = rows[defaultRow];
        if (row && Array.isArray(row) && row.length >= 6) {
            const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
            if (rowStr.includes('số hóa đơn') && rowStr.includes('ngày hóa đơn')) {
                return defaultRow;
            }
        }
    }
    
    // Nếu không tìm thấy ở dòng mặc định, tìm trong 15 dòng đầu
    for (let i = 0; i < Math.min(15, rows.length); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length < 6) continue;
        const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ');
        if (rowStr.includes('số hóa đơn') && rowStr.includes('ngày hóa đơn')) {
            return i;
        }
    }
    
    return defaultRow; // fallback
}

/**
 * Parse bảng kê
 * @param {Array} rows - Mảng 2 chiều từ SheetJS
 * @param {Object} config - Cấu hình từ FILE_CONFIG
 * @returns {Array} - Mảng items đã parse
 */
function parseBangKe(rows, config) {
    // Tự động tìm dòng header (hỗ trợ file có title ở đầu)
    const headerRow = findBangKeHeaderRow(rows, config.headerRow);
    const col = config.columns;
    const items = [];
    let lastSoHD = '';
    let lastNgay = '';
    let lastTen = '';
    let lastMST = '';

    for (let r = headerRow + 1; r < rows.length; r++) {
        const row = rows[r];
        let soHD = String(row[col.soHD] || '').trim();

        // Bỏ qua dòng nhóm (bắt đầu bằng "Nhóm")
        if (soHD.startsWith('Nhóm')) continue;
        // Bỏ qua dòng tổng cộng (kiểm tra cả cột số HĐ và cột tên)
        if (normalizeStr(soHD) === 'TỔNG CỘNG') continue;
        const tenRaw = String(row[col.ten] || '').trim();
        if (normalizeStr(tenRaw) === 'TỔNG CỘNG') continue;

        // Fill số hóa đơn nếu cần
        if (config.fillSoHD) {
            if (soHD) {
                lastSoHD = soHD;
                lastNgay = row[col.ngay];
                lastTen = row[col.ten];
                lastMST = row[col.mst];
            }
            soHD = lastSoHD;
            // Không continue nếu chưa có số HĐ - vẫn lấy dữ liệu để so sánh bằng chi tiết
        } else {
            if (!soHD) continue;
        }

        const ngayRaw = config.fillSoHD ? (lastNgay || row[col.ngay]) : row[col.ngay];
        const ngay = typeof ngayRaw === 'number' ? serialToDate(ngayRaw) : String(ngayRaw || '').trim();

        const ten = config.fillSoHD ? (lastTen || row[col.ten]) : row[col.ten];
        const mst = config.fillSoHD ? (lastMST || row[col.mst]) : row[col.mst];

        const tenStr = normalizeStr(ten);
        items.push({
            soHD: soHD ? normalizeSoHD(soHD) : '', // giữ trống nếu ko có số HĐ
            ngay: ngay,
            ten: tenStr,
            tenNorm: normalizeTen(tenStr), // tên đã chuẩn hóa (không dấu) để so sánh
            mst: String(mst || '').trim(),
            matHang: String(row[col.matHang] || '').trim(),
            tienChuaThue: parseNumber(row[col.tienChuaThue]),
            thueSuat: String(row[col.thueSuat] || '').trim(),
            thueGTGT: parseNumber(row[col.thueGTGT])
        });
    }
    return items;
}

/**
 * Gộp bảng kê theo (số hóa đơn + ngày) vì 1 hóa đơn có thể nhiều mặt hàng
 * Cùng số HĐ nhưng khác ngày là 2 hóa đơn khác nhau!
 * Nếu không có số HĐ, gộp theo (ngày + tên) để tổng hợp tiền
 * @param {Array} items - Mảng items từ parseBangKe
 * @returns {Array} - Mảng items đã gộp
 */
function groupBangKe(items) {
    const map = {};
    for (const item of items) {
        // Nếu có số HĐ: gộp theo (số HĐ + ngày) - QUAN TRỌNG: cùng số HĐ nhưng khác ngày là khác hóa đơn
        // Nếu không có số HĐ: gộp theo (ngày + tên) vì cùng ngày + cùng tên là cùng 1 hóa đơn
        const key = item.soHD ? (item.soHD + '|' + item.ngay) : (item.ngay + '|' + item.ten);
        if (!map[key]) {
            map[key] = {
                soHD: item.soHD,
                ngay: item.ngay,
                ten: item.ten,
                tenNorm: normalizeTen(item.ten), // tên đã chuẩn hóa (không dấu)
                mst: item.mst,
                tongTien: 0,
                tongThue: 0,
                matHangs: [],
                hasSoHD: !!item.soHD // đánh dấu có số HĐ hay không
            };
        }
        map[key].tongTien += item.tienChuaThue;
        map[key].tongThue += item.thueGTGT;
        map[key].matHangs.push(item.matHang);
        if (!map[key].ten && item.ten) map[key].ten = item.ten;
        if (!map[key].mst && item.mst) map[key].mst = item.mst;
    }
    return Object.values(map);
}

/**
 * Parse hóa đơn
 * @param {Array} rows - Mảng 2 chiều từ SheetJS
 * @param {Object} config - Cấu hình từ FILE_CONFIG
 * @returns {Array} - Mảng items đã parse
 */
function parseHoaDon(rows, config) {
    const headerRow = config.headerRow;
    const col = config.columns;
    const items = [];
    let skippedThayThe = 0; // Đếm số hóa đơn thay thế đã bỏ qua
    const thayTheItems = []; // Danh sách hóa đơn thay thế

    for (let r = headerRow + 1; r < rows.length; r++) {
        const row = rows[r];
        const soHD = String(row[col.soHD] || '').trim();
        if (!soHD) continue;

        // Kiểm tra trạng thái hóa đơn - chỉ bỏ qua hóa đơn ĐÃ BỊ thay thế (bị hủy)
        // Hóa đơn thay thế (thay thế cho hóa đơn cũ) VẪN phải được so sánh
        if (col.trangThai !== undefined) {
            const trangThai = String(row[col.trangThai] || '').trim().toLowerCase();
            // Chỉ bỏ qua nếu trạng thái có chứa "bị thay thế" (hóa đơn cũ bị thay thế)
            // Không bỏ qua "Hóa đơn thay thế" (hóa đơn mới thay thế cho hóa đơn cũ)
            if (trangThai.includes('bị thay thế')) {
                skippedThayThe++; // Đếm số hóa đơn bị thay thế đã bỏ qua
                // Lưu thông tin hóa đơn bị thay thế để hiển thị trong modal
                const ngayRaw = String(row[col.ngay] || '').trim();
                let ngay = ngayRaw;
                if (ngayRaw.includes('/')) {
                    const parts = ngayRaw.split('/');
                    if (parts.length === 3) {
                        ngay = parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
                    }
                }
                const tenField = col.tenMua !== undefined ? 'tenMua' : 'tenBan';
                const ten = normalizeStr(row[col[tenField]]);
                thayTheItems.push({
                    soHD: normalizeSoHD(soHD),
                    ngay: ngay,
                    ten: ten,
                    tienChuaThue: parseNumber(row[col.tienChuaThue]),
                    trangThai: String(row[col.trangThai] || '').trim()
                });
                continue;
            }
        }

        const ngayRaw = String(row[col.ngay] || '').trim();
        // Chuẩn hóa ngày về yyyy-MM-dd
        let ngay = ngayRaw;
        if (ngayRaw.includes('/')) {
            const parts = ngayRaw.split('/');
            if (parts.length === 3) {
                ngay = parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
            }
        }

        const tenField = col.tenMua !== undefined ? 'tenMua' : 'tenBan';
        const ten = normalizeStr(row[col[tenField]]);

        items.push({
            soHD: normalizeSoHD(soHD),
            ngay: ngay,
            ten: ten,
            tenNorm: normalizeTen(ten), // tên đã chuẩn hóa (không dấu) để so sánh
            tienChuaThue: parseNumber(row[col.tienChuaThue]),
            tienThue: parseNumber(row[col.tienThue]),
            tongTT: parseNumber(row[col.tongTT]),
            thueGTGT: parseNumber(row[col.tienThue]) // tiền thuế = tienThue
        });
    }
    return { items, skippedThayThe, thayTheItems };
}
