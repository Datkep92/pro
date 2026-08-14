// ============================================================
// Matching Engine - Đối chiếu Sao kê với Khách hàng/Nhà cung cấp
// ============================================================

/**
 * Đối chiếu giao dịch sao kê với danh sách khách hàng/nhà cung cấp
 * 
 * Logic:
 * 1. Giao dịch THU (Có) → tìm trong danh sách khách hàng
 * 2. Giao dịch CHI (Nợ) → tìm trong danh sách nhà cung cấp
 * 3. Nếu tìm thấy → gán thông tin đối tượng
 * 4. Nếu không tìm thấy → đánh dấu "Chưa xác định"
 * 
 * @param {Array} transactions - Mảng giao dịch từ parseBankStatement()
 * @param {Array} customers - Mảng khách hàng từ parseCustomerList()
 * @param {Array} vendors - Mảng nhà cung cấp từ parseVendorList()
 * @returns {Object} - { matched: Array, unmatched: Array, stats: Object }
 */
function matchTransactions(transactions, customers, vendors) {
    if (!transactions || transactions.length === 0) {
        return { matched: [], unmatched: [], stats: { total: 0, matched: 0, unmatched: 0 } };
    }

    const matched = [];
    const unmatched = [];

    for (const txn of transactions) {
        let matchedObject = null;
        let matchType = '';

        if (txn.loaiGD === 'THU') {
            // Giao dịch thu → tìm khách hàng
            matchedObject = findCustomerByDescription(txn.moTa, customers || []);
            matchType = 'KHACH_HANG';
        } else {
            // Giao dịch chi → tìm nhà cung cấp
            matchedObject = findVendorByDescription(txn.moTa, vendors || []);
            matchType = 'NHA_CUNG_CAP';
        }

        const result = {
            ...txn,
            matchType,
            matchedObject,
            matched: !!matchedObject
        };

        if (matchedObject) {
            matched.push(result);
        } else {
            unmatched.push(result);
        }
    }

    const stats = {
        total: transactions.length,
        matched: matched.length,
        unmatched: unmatched.length,
        tongTienThu: sumTransactions(transactions, 'THU'),
        tongTienChi: sumTransactions(transactions, 'CHI'),
        tongTienThuMatched: matched.filter(t => t.loaiGD === 'THU').reduce((s, t) => s + t.soTien, 0),
        tongTienChiMatched: matched.filter(t => t.loaiGD === 'CHI').reduce((s, t) => s + t.soTien, 0),
        tongTienThuUnmatched: unmatched.filter(t => t.loaiGD === 'THU').reduce((s, t) => s + t.soTien, 0),
        tongTienChiUnmatched: unmatched.filter(t => t.loaiGD === 'CHI').reduce((s, t) => s + t.soTien, 0)
    };

    return { matched, unmatched, stats };
}

/**
 * Tạo dữ liệu để xuất phiếu thu/chi từ tất cả giao dịch
 *
 * Logic:
 * - Giao dịch THU (Có) → tạo phiếu thu (dù có KH hay không)
 * - Giao dịch CHI (Nợ) → tạo phiếu chi (dù có NCC hay không)
 * - Nếu có thông tin đối tượng (KH/NCC) thì điền vào, nếu không thì để trống
 *
 * @param {Array} allTransactions - Mảng TẤT CẢ giao dịch (cả matched và unmatched)
 * @returns {Object} - { phieuThu: Array, phieuChi: Array }
 */
function prepareVoucherData(allTransactions) {
    if (!allTransactions || allTransactions.length === 0) {
        return { phieuThu: [], phieuChi: [] };
    }

    const phieuThu = [];
    const phieuChi = [];

    for (const txn of allTransactions) {
        if (txn.loaiGD === 'THU') {
            phieuThu.push({
                // Thông tin từ sao kê
                ngayGD: txn.ngay,
                soThamChieu: txn.soThamChieu,
                soTien: txn.soTien,
                moTa: txn.moTa,
                // Thông tin đối tượng (khách hàng) - có thể null
                maDT: txn.matchedObject ? (txn.matchedObject.maKH || '') : '',
                tenDT: txn.matchedObject ? (txn.matchedObject.tenKH || '') : '',
                diaChi: txn.matchedObject ? (txn.matchedObject.diaChi || '') : '',
                mst: txn.matchedObject ? (txn.matchedObject.mst || '') : '',
                // Phân loại
                loai: 'THU',
                loaiDT: txn.matchedObject ? 'KHACH_HANG' : 'CHUA_XAC_DINH'
            });
        } else {
            phieuChi.push({
                // Thông tin từ sao kê
                ngayGD: txn.ngay,
                soThamChieu: txn.soThamChieu,
                soTien: txn.soTien,
                moTa: txn.moTa,
                // Thông tin đối tượng (nhà cung cấp) - có thể null
                maDT: txn.matchedObject ? (txn.matchedObject.maNCC || '') : '',
                tenDT: txn.matchedObject ? (txn.matchedObject.tenNCC || '') : '',
                diaChi: txn.matchedObject ? (txn.matchedObject.diaChi || '') : '',
                mst: txn.matchedObject ? (txn.matchedObject.mst || '') : '',
                // Phân loại
                loai: 'CHI',
                loaiDT: txn.matchedObject ? 'NHA_CUNG_CAP' : 'CHUA_XAC_DINH'
            });
        }
    }

    return { phieuThu, phieuChi };
}

/**
 * Tạo báo cáo tổng hợp đối chiếu
 * @param {Object} matchResult - Kết quả từ matchTransactions()
 * @returns {string} - HTML report
 */
function generateMatchReport(matchResult) {
    const { matched, unmatched, stats } = matchResult;

    if (stats.total === 0) {
        return '<p style="text-align:center;color:#888;padding:20px;">Không có dữ liệu giao dịch</p>';
    }

    const matchRate = ((stats.matched / stats.total) * 100).toFixed(1);

    let html = `
        <div class="summary-info">
            <span class="summary-info-item">📊 Tổng giao dịch: <strong>${stats.total}</strong></span>
            <span class="summary-info-item">✅ Đã đối chiếu: <strong>${stats.matched}</strong> (${matchRate}%)</span>
            <span class="summary-info-item">❌ Chưa đối chiếu: <strong>${stats.unmatched}</strong></span>
        </div>
        <div class="summary-totals">
            <div class="summary-totals-row">
                <div class="summary-total-item">
                    <span class="total-label">💰 Tổng tiền thu:</span>
                    <span class="total-value">${formatMoney(Math.round(stats.tongTienThu))} đ</span>
                </div>
                <div class="summary-total-item">
                    <span class="total-label">✅ Đã đối chiếu thu:</span>
                    <span class="total-value">${formatMoney(Math.round(stats.tongTienThuMatched))} đ</span>
                </div>
                <div class="summary-total-item">
                    <span class="total-label">❌ Chưa đối chiếu thu:</span>
                    <span class="total-value amount-diff">${formatMoney(Math.round(stats.tongTienThuUnmatched))} đ</span>
                </div>
            </div>
            <div class="summary-totals-row">
                <div class="summary-total-item">
                    <span class="total-label">💰 Tổng tiền chi:</span>
                    <span class="total-value">${formatMoney(Math.round(stats.tongTienChi))} đ</span>
                </div>
                <div class="summary-total-item">
                    <span class="total-label">✅ Đã đối chiếu chi:</span>
                    <span class="total-value">${formatMoney(Math.round(stats.tongTienChiMatched))} đ</span>
                </div>
                <div class="summary-total-item">
                    <span class="total-label">❌ Chưa đối chiếu chi:</span>
                    <span class="total-value amount-diff">${formatMoney(Math.round(stats.tongTienChiUnmatched))} đ</span>
                </div>
            </div>
        </div>
        <div class="summary-items">
            <div class="summary-item match" onclick="showModalMatched()" style="cursor:pointer">✅ Đã đối chiếu: ${stats.matched}</div>
            <div class="summary-item missing" onclick="showModalUnmatched()" style="cursor:pointer">❌ Chưa đối chiếu: ${stats.unmatched}</div>
        </div>
    `;

    return html;
}

/**
 * Tạo bảng chi tiết kết quả đối chiếu
 * @param {Array} items - Mảng giao dịch (matched hoặc unmatched)
 * @param {boolean} showMatched - true nếu hiển thị matched, false nếu unmatched
 * @returns {string} - HTML table
 */
function generateMatchDetailTable(items, showMatched) {
    if (!items || items.length === 0) {
        return '<p style="text-align:center;color:#888;padding:20px;">Không có dữ liệu</p>';
    }

    let html = `<table>
        <thead>
            <tr>
                <th>STT</th>
                <th>Ngày GD</th>
                <th>Số tham chiếu</th>
                <th>Loại</th>
                <th>Số tiền (đ)</th>
                <th>Đối tượng</th>
                <th>Mã số thuế</th>
                <th>Mô tả</th>
            </tr>
        </thead>
        <tbody>`;

    items.forEach((item, i) => {
        const loaiLabel = item.loaiGD === 'THU' ? '📥 Thu' : '📤 Chi';
        const loaiClass = item.loaiGD === 'THU' ? 'match' : 'mismatch';
        const tenDT = item.matchedObject
            ? (item.matchedObject.tenKH || item.matchedObject.tenNCC || '—')
            : '❓ Chưa xác định';
        const mst = item.matchedObject ? (item.matchedObject.mst || '—') : '—';

        html += `<tr class="${showMatched ? 'match' : 'missing-in-hoadon'}">
            <td>${i + 1}</td>
            <td>${item.ngay}</td>
            <td>${item.soThamChieu || '—'}</td>
            <td><span class="status-badge ${loaiClass}">${loaiLabel}</span></td>
            <td style="text-align:right">${formatMoney(Math.round(item.soTien))}</td>
            <td>${escapeHtml(tenDT)}</td>
            <td>${mst}</td>
            <td style="max-width:300px;white-space:normal;word-break:break-word;">${escapeHtml(item.moTa || '')}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    return html;
}
