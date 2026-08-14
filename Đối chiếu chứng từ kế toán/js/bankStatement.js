// ============================================================
// Xử lý Sao kê Ngân hàng
// ============================================================

/**
 * Cấu hình mapping cột cho sao kê ngân hàng Vietcombank
 * Header ở dòng 10 (index 9): Ngày GD, Số tham chiếu, Nợ, Có, Mô tả
 */
const BANK_STATEMENT_CONFIG = {
    // Header search patterns (tìm dòng header trong file)
    headerPatterns: [
        'NGÀY GD', 'NGAY GD',
        'SỐ THAM CHIẾU', 'SO THAM CHIEU', 'SỐ REF', 'SỐ CT',
        'NỢ', 'NO', 'CÓ', 'CO',
        'MÔ TẢ', 'MO TA', 'DIỄN GIẢI', 'DIEN GIAI', 'NỘI DUNG', 'NOI DUNG'
    ],
    // Column indices (sau khi tìm được header)
    columns: {
        ngayGD: 0,        // Ngày giao dịch (serial date)
        soThamChieu: 1,   // Số tham chiếu
        soTienNo: 2,      // Nợ (tiền chi ra)
        soTienCo: 3,      // Có (tiền thu vào)
        moTa: 4           // Mô tả giao dịch
    }
};

/**
 * Tìm dòng header trong sao kê ngân hàng
 * @param {Array} rows - Mảng 2 chiều từ SheetJS
 * @returns {number} - Index của dòng header, hoặc -1 nếu không tìm thấy
 */
function findBankStatementHeaderRow(rows) {
    for (let i = 0; i < Math.min(20, rows.length); i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length < 4) continue;

        const rowStr = row.map(c => String(c || '').toUpperCase()).join(' ');

        const hasNgayGD = rowStr.includes('NGÀY GIAO DỊCH') || rowStr.includes('NGAY GIAO DICH') ||
                          rowStr.includes('NGÀY GD') || rowStr.includes('NGAY GD');
        const hasSoThamChieu = rowStr.includes('SỐ THAM CHIẾU') || rowStr.includes('SO THAM CHIEU') ||
                               rowStr.includes('SỐ REF') || rowStr.includes('SỐ CT') || rowStr.includes('SO CT');
        const hasNoCo = rowStr.includes('NỢ') || rowStr.includes('NO') || rowStr.includes('CÓ') || rowStr.includes('CO') ||
                        rowStr.includes('SỐ TIỀN GHI NỢ') || rowStr.includes('SO TIEN GHI NO') ||
                        rowStr.includes('SỐ TIỀN GHI CÓ') || rowStr.includes('SO TIEN GHI CO') ||
                        rowStr.includes('GHI NỢ') || rowStr.includes('GHI NO') ||
                        rowStr.includes('GHI CÓ') || rowStr.includes('GHI CO');
        const hasMoTa = rowStr.includes('MÔ TẢ') || rowStr.includes('MO TA') ||
                        rowStr.includes('DIỄN GIẢI') || rowStr.includes('DIEN GIAI') ||
                        rowStr.includes('NỘI DUNG') || rowStr.includes('NOI DUNG');

        if (hasNgayGD && hasSoThamChieu && hasNoCo && hasMoTa) {
            return i;
        }
    }
    return -1;
}

/**
 * Parse sao kê ngân hàng thành mảng các giao dịch
 * @param {Array} rows - Mảng 2 chiều từ SheetJS
 * @returns {Object} - { transactions: Array, sourceInfo: Object }
 */
function parseBankStatement(rows) {
    if (!rows || rows.length < 5) {
        return { transactions: [], sourceInfo: { fileName: 'Sao kê NH', rowCount: 0 } };
    }

    const headerRowIndex = findBankStatementHeaderRow(rows);
    if (headerRowIndex < 0) {
        console.warn('Không tìm thấy header sao kê ngân hàng');
        return { transactions: [], sourceInfo: { fileName: 'Sao kê NH', rowCount: rows.length } };
    }

    const transactions = [];
    const col = BANK_STATEMENT_CONFIG.columns;

    // Duyệt từ dòng sau header
    for (let i = headerRowIndex + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !Array.isArray(row) || row.length < 3) continue;

        // Kiểm tra dòng trống
        const ngayRaw = row[col.ngayGD];
        if (ngayRaw === undefined || ngayRaw === null || ngayRaw === '') continue;

        // Bỏ qua dòng tổng kết (có chữ "Tổng số", "Tổng cộng", "Total")
        const ngayStr = String(ngayRaw).trim().toUpperCase();
        if (ngayStr.includes('TỔNG') || ngayStr.includes('TONG') || ngayStr.includes('TOTAL') || ngayStr.includes('SUM')) continue;

        // Parse ngày (serial date)
        let ngay = '';
        if (typeof ngayRaw === 'number' && ngayRaw > 40000 && ngayRaw < 70000) {
            ngay = serialToDate(ngayRaw);
        } else {
            ngay = String(ngayRaw).trim();
        }

        // Số tham chiếu
        const soThamChieu = String(row[col.soThamChieu] || '').trim();

        // Số tiền Nợ (chi)
        const soTienNo = parseFloat(row[col.soTienNo]) || 0;

        // Số tiền Có (thu)
        const soTienCo = parseFloat(row[col.soTienCo]) || 0;

        // Mô tả
        const moTa = String(row[col.moTa] || '').trim();

        // Bỏ qua dòng không có số tiền
        if (soTienNo === 0 && soTienCo === 0) continue;

        // Xác định loại giao dịch
        const loaiGD = soTienCo > 0 ? 'THU' : 'CHI';
        const soTien = soTienCo > 0 ? soTienCo : soTienNo;

        transactions.push({
            ngay,
            soThamChieu,
            soTienNo,
            soTienCo,
            soTien,
            loaiGD,
            moTa,
            // Thông tin bổ sung
            ngayRaw,
            rowIndex: i
        });
    }

    return {
        transactions,
        sourceInfo: {
            fileName: 'Sao kê NH',
            rowCount: transactions.length,
            headerRow: headerRowIndex
        }
    };
}

/**
 * Lọc giao dịch theo loại (THU hoặc CHI)
 * @param {Array} transactions - Mảng giao dịch
 * @param {string} loai - 'THU' hoặc 'CHI'
 * @returns {Array}
 */
function filterTransactionsByType(transactions, loai) {
    return transactions.filter(t => t.loaiGD === loai);
}

/**
 * Tính tổng số tiền theo loại
 * @param {Array} transactions
 * @param {string} loai - 'THU' hoặc 'CHI'
 * @returns {number}
 */
function sumTransactions(transactions, loai) {
    return transactions
        .filter(t => t.loaiGD === loai)
        .reduce((sum, t) => sum + t.soTien, 0);
}
