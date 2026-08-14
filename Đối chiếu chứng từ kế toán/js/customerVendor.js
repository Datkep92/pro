// ============================================================
// Xử lý Danh sách Khách hàng & Nhà cung cấp
// ============================================================

// Tên công ty chủ tài khoản (cần loại bỏ khỏi mô tả khi tìm kiếm)
const COMPANY_NAME = 'CONG TY TNHH DV TM THUAT CHIEU';

/**
 * Cấu hình mapping cột cho danh sách khách hàng
 * File mẫu: Khach_hang (1).xlsx
 * Header R1: [Mã KH, Tên KH, Địa chỉ, Nhóm, MST, Điện thoại, Ngừng theo dõi]
 */
const CUSTOMER_CONFIG = {
    headerPatterns: ['MÃ KH', 'MA KH', 'MÃ KHÁCH HÀNG', 'MA KHACH HANG'],
    columns: {
        maKH: 0,
        tenKH: 1,
        diaChi: 2,
        nhom: 3,
        mst: 4,
        dienThoai: 5,
        ngungTheoDoi: 6
    }
};

/**
 * Cấu hình mapping cột cho danh sách nhà cung cấp
 * File mẫu: nha cung cap.xlsx
 * Header R1: [Mã NCC, Tên NCC, Địa chỉ, Nhóm, MST, Điện thoại, Ngừng theo dõi]
 */
const VENDOR_CONFIG = {
    headerPatterns: ['MÃ NCC', 'MA NCC', 'MÃ NHÀ CUNG CẤP', 'MA NHA CUNG CAP'],
    columns: {
        maNCC: 0,
        tenNCC: 1,
        diaChi: 2,
        nhom: 3,
        mst: 4,
        dienThoai: 5,
        ngungTheoDoi: 6
    }
};

/**
 * Tìm dòng header trong danh sách
 * @param {Array} rows - Mảng 2 chiều từ SheetJS
 * @param {Array} patterns - Mảng các pattern cần tìm
 * @returns {number} - Index của dòng header, hoặc -1
 */
function findListHeaderRow(rows, patterns) {
    for (let i = 0; i < Math.min(5, rows.length); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length < 2) continue;

        const rowStr = row.map(c => String(c || '').toUpperCase()).join(' ');
        for (const pattern of patterns) {
            if (rowStr.includes(pattern)) {
                return i;
            }
        }
    }
    return -1;
}

/**
 * Parse danh sách khách hàng
 * @param {Array} rows - Mảng 2 chiều từ SheetJS
 * @returns {Object} - { customers: Array, sourceInfo: Object }
 */
function parseCustomerList(rows) {
    if (!rows || rows.length < 2) {
        return { customers: [], sourceInfo: { fileName: 'DS Khách hàng', rowCount: 0 } };
    }

    const headerRowIndex = findListHeaderRow(rows, CUSTOMER_CONFIG.headerPatterns);
    if (headerRowIndex < 0) {
        console.warn('Không tìm thấy header danh sách khách hàng');
        return { customers: [], sourceInfo: { fileName: 'DS Khách hàng', rowCount: rows.length } };
    }

    const customers = [];
    const col = CUSTOMER_CONFIG.columns;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;

        const maKH = String(row[col.maKH] || '').trim();
        const tenKH = String(row[col.tenKH] || '').trim();

        // Bỏ qua dòng trống
        if (!maKH && !tenKH) continue;

        customers.push({
            maKH,
            tenKH,
            tenKHSearch: removeAccents(tenKH).toUpperCase(), // Để tìm kiếm
            diaChi: String(row[col.diaChi] || '').trim(),
            nhom: String(row[col.nhom] || '').trim(),
            mst: String(row[col.mst] || '').trim(),
            dienThoai: String(row[col.dienThoai] || '').trim(),
            ngungTheoDoi: String(row[col.ngungTheoDoi] || '').trim(),
            rowIndex: i
        });
    }

    return {
        customers,
        sourceInfo: {
            fileName: 'DS Khách hàng',
            rowCount: customers.length,
            headerRow: headerRowIndex
        }
    };
}

/**
 * Parse danh sách nhà cung cấp
 * @param {Array} rows - Mảng 2 chiều từ SheetJS
 * @returns {Object} - { vendors: Array, sourceInfo: Object }
 */
function parseVendorList(rows) {
    if (!rows || rows.length < 2) {
        return { vendors: [], sourceInfo: { fileName: 'DS Nhà cung cấp', rowCount: 0 } };
    }

    const headerRowIndex = findListHeaderRow(rows, VENDOR_CONFIG.headerPatterns);
    if (headerRowIndex < 0) {
        console.warn('Không tìm thấy header danh sách nhà cung cấp');
        return { vendors: [], sourceInfo: { fileName: 'DS Nhà cung cấp', rowCount: rows.length } };
    }

    const vendors = [];
    const col = VENDOR_CONFIG.columns;

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row)) continue;

        const maNCC = String(row[col.maNCC] || '').trim();
        const tenNCC = String(row[col.tenNCC] || '').trim();

        // Bỏ qua dòng trống
        if (!maNCC && !tenNCC) continue;

        vendors.push({
            maNCC,
            tenNCC,
            tenNCCSearch: removeAccents(tenNCC).toUpperCase(), // Để tìm kiếm
            diaChi: String(row[col.diaChi] || '').trim(),
            nhom: String(row[col.nhom] || '').trim(),
            mst: String(row[col.mst] || '').trim(),
            dienThoai: String(row[col.dienThoai] || '').trim(),
            ngungTheoDoi: String(row[col.ngungTheoDoi] || '').trim(),
            rowIndex: i
        });
    }

    return {
        vendors,
        sourceInfo: {
            fileName: 'DS Nhà cung cấp',
            rowCount: vendors.length,
            headerRow: headerRowIndex
        }
    };
}

/**
 * Làm sạch mô tả giao dịch: loại bỏ tên công ty chủ tài khoản,
 * các tiền tố MBBIZ, MBVCB, SHGD, REF, v.v.
 * @param {string} moTa - Mô tả gốc từ sao kê
 * @returns {string} - Mô tả đã làm sạch
 */
function cleanDescription(moTa) {
    if (!moTa) return '';
    let s = removeAccents(moTa).toUpperCase();
    
    // Loại bỏ tên công ty chủ tài khoản
    s = s.replace(new RegExp(removeAccents(COMPANY_NAME).toUpperCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    
    // Loại bỏ các tiền tố giao dịch
    s = s.replace(/MBBIZ\d+\./g, '');
    s = s.replace(/MBVCB\.\d+\./g, '');
    s = s.replace(/SHGD:\d+\./g, '');
    s = s.replace(/DD:\d+\./g, '');
    s = s.replace(/BO:/g, '');
    s = s.replace(/\/REF:[^/]+\//g, '');
    s = s.replace(/MID:[^\s]+\s*/g, '');
    s = s.replace(/\d{6,}\.\d+\.[^\s]+\s*/g, ''); // 020097042201292111592026O8PH606279.30880.211200.
    s = s.replace(/CT TU [\d\s]+[A-Z]+ [\w\s]+ TOI [\d\s]+[A-Z]+ [\w\s]+/g, '');
    s = s.replace(/CHUYEN TIEN/g, '');
    s = s.replace(/THANH TOAN/g, '');
    s = s.replace(/REMARK:/g, '');
    s = s.replace(/\./g, ' '); // Thay dấu chấm bằng khoảng trắng
    s = s.replace(/\s+/g, ' ').trim();
    
    return s;
}

/**
 * Tìm khách hàng từ mô tả giao dịch
 * @param {string} moTa - Mô tả giao dịch từ sao kê
 * @param {Array} customers - Danh sách khách hàng
 * @returns {Object|null} - Khách hàng tìm thấy hoặc null
 */
function findCustomerByDescription(moTa, customers) {
    if (!moTa || !customers || customers.length === 0) return null;

    // Làm sạch mô tả trước khi tìm kiếm
    const moTaSearch = cleanDescription(moTa);
    if (!moTaSearch) return null;

    // Tìm chính xác tên trong mô tả đã làm sạch
    for (const c of customers) {
        if (!c.tenKHSearch) continue;
        if (moTaSearch.includes(c.tenKHSearch)) {
            return c;
        }
    }

    // Tìm theo từ khóa (nếu tên dài, tìm phần đầu)
    for (const c of customers) {
        if (!c.tenKHSearch || c.tenKHSearch.length < 5) continue;
        const words = c.tenKHSearch.split(/\s+/);
        // Lấy 3 từ đầu tiên
        const shortName = words.slice(0, 3).join(' ');
        if (shortName.length >= 5 && moTaSearch.includes(shortName)) {
            return c;
        }
    }

    // Tìm theo từng từ riêng lẻ (từ có độ dài >= 5 ký tự)
    for (const c of customers) {
        if (!c.tenKHSearch || c.tenKHSearch.length < 5) continue;
        const nameWords = c.tenKHSearch.split(/\s+/).filter(w => w.length >= 5);
        let matchCount = 0;
        for (const w of nameWords) {
            if (moTaSearch.includes(w)) matchCount++;
        }
        // Nếu match được ít nhất 2 từ có độ dài >= 5
        if (matchCount >= 2) {
            return c;
        }
    }

    return null;
}

/**
 * Tìm nhà cung cấp từ mô tả giao dịch
 * @param {string} moTa - Mô tả giao dịch từ sao kê
 * @param {Array} vendors - Danh sách nhà cung cấp
 * @returns {Object|null} - Nhà cung cấp tìm thấy hoặc null
 */
function findVendorByDescription(moTa, vendors) {
    if (!moTa || !vendors || vendors.length === 0) return null;

    // Làm sạch mô tả trước khi tìm kiếm
    const moTaSearch = cleanDescription(moTa);
    if (!moTaSearch) return null;

    // Tìm chính xác tên trong mô tả đã làm sạch
    for (const v of vendors) {
        if (!v.tenNCCSearch) continue;
        if (moTaSearch.includes(v.tenNCCSearch)) {
            return v;
        }
    }

    // Tìm theo từ khóa
    for (const v of vendors) {
        if (!v.tenNCCSearch || v.tenNCCSearch.length < 5) continue;
        const words = v.tenNCCSearch.split(/\s+/);
        const shortName = words.slice(0, 3).join(' ');
        if (shortName.length >= 5 && moTaSearch.includes(shortName)) {
            return v;
        }
    }

    // Tìm theo từng từ riêng lẻ
    for (const v of vendors) {
        if (!v.tenNCCSearch || v.tenNCCSearch.length < 5) continue;
        const nameWords = v.tenNCCSearch.split(/\s+/).filter(w => w.length >= 5);
        let matchCount = 0;
        for (const w of nameWords) {
            if (moTaSearch.includes(w)) matchCount++;
        }
        if (matchCount >= 2) {
            return v;
        }
    }

    return null;
}
