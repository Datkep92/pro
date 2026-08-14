// ============================================================
// Tạo Phiếu Thu/Chi từ dữ liệu Sao kê đã đối chiếu
// ============================================================

/**
 * Mapping cột cho mẫu phiếu thu (25 cột)
 * File mẫu: phieu thu tien gui.xlsx
 * Header: ["Hiển thị trên sổ","Ngày hạch toán (*)","Ngày chứng từ (*)","Số chứng từ (*)","Mã đối tượng","Tên đối tượng","Địa chỉ","Nộp vào TK","Mở tại NH","Lý do thu","Diễn giải lý do thu ","Nhân viên thu","Diễn giải","TK Nợ (*)","TK Có (*)","Số tiền","Đối tượng","Khoản mục CP","Đơn vị","Đối tượng THCP","Công trình","Đơn đặt hàng","Hợp đồng mua","Hợp đồng bán","Mã thống kê"]
 * Row 1 (mẫu): [null,...,1121,131]
 */
const PHIEU_THU_COLUMNS = {
    hienThiTrenSo: 0,
    ngayHachToan: 1,
    ngayChungTu: 2,
    soChungTu: 3,
    maDoiTuong: 4,
    tenDoiTuong: 5,
    diaChi: 6,
    napVaoTK: 7,
    moTaiNH: 8,
    lyDoThu: 9,
    dienGiaiLyDoThu: 10,
    nhanVienThu: 11,
    dienGiai: 12,
    tkNo: 13,
    tkCo: 14,
    soTien: 15,
    doiTuong: 16,
    khoanMucCP: 17,
    donVi: 18,
    doiTuongTHCP: 19,
    congTrinh: 20,
    donDatHang: 21,
    hopDongMua: 22,
    hopDongBan: 23,
    maThongKe: 24
};

/**
 * Mapping cột cho mẫu phiếu chi (47 cột)
 * File mẫu: phieu chi tien gui.xlsx
 * Header: ["Hiển thị trên sổ","Phương thức thanh toán","Ngày hạch toán (*)","Ngày chứng từ (*)","Số chứng từ (*)","Tài khoản chi","Mở tại NH","Nội dung thanh toán","Diễn giải nội dung thanh toán","Mã đối tượng","Tên đối tượng","Địa chỉ","Tài khoản nhận","Tên NH nhận","Người lĩnh tiền","Số CMND","Ngày cấp CMND","Nơi cấp CMND","Nhân viên","Diễn giải","TK Nợ (*)","TK Có (*)","Số tiền","Mã đối tượng (Chi tiết)","Khoản mục chi phí","Đơn vị","ĐT tập hợp chi phí","Công trình","Đơn đặt hàng","Hợp đồng mua","Hợp đồng bán","Chi phí không hợp lý","Mã thống kê","Diễn giải (Thuế)","TK thuế GTGT","Tiền thuế GTGT","% thuế GTGT","Tỷ lệ tính thuế (Thuế suất KHAC)","Giá trị HHDV chưa thuế","Mẫu số hóa đơn","Ký hiệu hóa đơn","Số hóa đơn","Ngày hóa đơn","Nhóm HHDV mua vào","Mã NCC","Tên NCC","Mã số thuế NCC"]
 */
const PHIEU_CHI_COLUMNS = {
    hienThiTrenSo: 0,
    phuongThucTT: 1,
    ngayHachToan: 2,
    ngayChungTu: 3,
    soChungTu: 4,
    taiKhoanChi: 5,
    moTaiNH: 6,
    noiDungTT: 7,
    dienGiaiNoiDungTT: 8,
    maDoiTuong: 9,
    tenDoiTuong: 10,
    diaChi: 11,
    taiKhoanNhan: 12,
    tenNHNhan: 13,
    nguoiLinhTien: 14,
    soCMND: 15,
    ngayCapCMND: 16,
    noiCapCMND: 17,
    nhanVien: 18,
    dienGiai: 19,
    tkNo: 20,
    tkCo: 21,
    soTien: 22,
    maDoiTuongCT: 23,
    khoanMucCP: 24,
    donVi: 25,
    dtTapHopCP: 26,
    congTrinh: 27,
    donDatHang: 28,
    hopDongMua: 29,
    hopDongBan: 30,
    chiPhiKhongHopLy: 31,
    maThongKe: 32,
    dienGiaiThue: 33,
    tkThueGTGT: 34,
    tienThueGTGT: 35,
    phanTramThueGTGT: 36,
    tyLeTinhThue: 37,
    giaTriHHDVChuaThue: 38,
    mauSoHoaDon: 39,
    kyHieuHoaDon: 40,
    soHoaDon: 41,
    ngayHoaDon: 42,
    nhomHHDVMuaVao: 43,
    maNCC: 44,
    tenNCC: 45,
    maSoThueNCC: 46
};

/**
 * Tạo dữ liệu phiếu thu từ giao dịch đã đối chiếu
 * Giữ NGUYÊN cấu trúc file mẫu (25 cột)
 * 
 * @param {Array} phieuThuData - Mảng dữ liệu từ prepareVoucherData().phieuThu
 * @param {Array} templateRows - Mảng rows từ file mẫu phiếu thu
 * @returns {Array} - Mảng rows để xuất Excel
 */
function generatePhieuThu(phieuThuData, templateRows) {
    if (!phieuThuData || phieuThuData.length === 0) {
        return templateRows || [];
    }

    // Nếu có template, giữ nguyên header và thêm dòng data
    if (templateRows && templateRows.length > 0) {
        const result = [templateRows[0]]; // Header gốc - giữ nguyên 100%
        const col = PHIEU_THU_COLUMNS;

        for (const item of phieuThuData) {
            // Tạo row với độ dài đúng 25 cột, copy giá trị từ template row mẫu (nếu có)
            const row = new Array(25).fill(null);
            if (templateRows.length > 1 && templateRows[1]) {
                for (let c = 0; c < Math.min(templateRows[1].length, 25); c++) {
                    row[c] = templateRows[1][c] !== undefined ? templateRows[1][c] : null;
                }
            }

            // Điền dữ liệu vào đúng cột
            row[col.hienThiTrenSo] = null;          // Cột 0: để trống
            row[col.ngayHachToan] = item.ngayGD;     // Cột 1: Ngày hạch toán
            row[col.ngayChungTu] = item.ngayGD;      // Cột 2: Ngày chứng từ
            row[col.soChungTu] = item.soThamChieu;   // Cột 3: Số chứng từ
            row[col.maDoiTuong] = item.maDT || null; // Cột 4: Mã đối tượng
            row[col.tenDoiTuong] = item.tenDT || null; // Cột 5: Tên đối tượng
            row[col.diaChi] = item.diaChi || null;   // Cột 6: Địa chỉ
            // Cột 7-12: để trống (Nộp vào TK, Mở tại NH, Lý do thu, Diễn giải lý do thu, Nhân viên thu)
            // Cột 12: Diễn giải
            row[col.dienGiai] = item.moTa || null;
            // Cột 13-14: TK Nợ, TK Có - giữ nguyên từ template mẫu (1121, 131)
            // Cột 15: Số tiền
            row[col.soTien] = item.soTien;
            // Cột 16-24: để trống (Đối tượng, Khoản mục CP, Đơn vị, Đối tượng THCP, Công trình, Đơn đặt hàng, Hợp đồng mua, Hợp đồng bán, Mã thống kê)

            result.push(row);
        }

        return result;
    }

    // Không có template - vẫn tạo đúng 25 cột
    const result = [];
    result.push([
        'Hiển thị trên sổ', 'Ngày hạch toán (*)', 'Ngày chứng từ (*)', 'Số chứng từ (*)',
        'Mã đối tượng', 'Tên đối tượng', 'Địa chỉ', 'Nộp vào TK', 'Mở tại NH',
        'Lý do thu', 'Diễn giải lý do thu', 'Nhân viên thu', 'Diễn giải',
        'TK Nợ (*)', 'TK Có (*)', 'Số tiền', 'Đối tượng', 'Khoản mục CP',
        'Đơn vị', 'Đối tượng THCP', 'Công trình', 'Đơn đặt hàng',
        'Hợp đồng mua', 'Hợp đồng bán', 'Mã thống kê'
    ]);

    for (const item of phieuThuData) {
        const row = new Array(25).fill(null);
        row[1] = item.ngayGD;
        row[2] = item.ngayGD;
        row[3] = item.soThamChieu;
        row[4] = item.maDT || null;
        row[5] = item.tenDT || null;
        row[6] = item.diaChi || null;
        row[12] = item.moTa || null;
        row[13] = 1121;
        row[14] = 131;
        row[15] = item.soTien;
        result.push(row);
    }

    return result;
}

/**
 * Tạo dữ liệu phiếu chi từ giao dịch đã đối chiếu
 * Giữ NGUYÊN cấu trúc file mẫu (47 cột)
 * 
 * @param {Array} phieuChiData - Mảng dữ liệu từ prepareVoucherData().phieuChi
 * @param {Array} templateRows - Mảng rows từ file mẫu phiếu chi
 * @returns {Array} - Mảng rows để xuất Excel
 */
function generatePhieuChi(phieuChiData, templateRows) {
    if (!phieuChiData || phieuChiData.length === 0) {
        return templateRows || [];
    }

    // Nếu có template, giữ nguyên header và thêm dòng data
    if (templateRows && templateRows.length > 0) {
        const result = [templateRows[0]]; // Header gốc - giữ nguyên 100%
        const col = PHIEU_CHI_COLUMNS;

        for (const item of phieuChiData) {
            // Tạo row với độ dài đúng 47 cột
            const row = new Array(47).fill(null);
            if (templateRows.length > 1 && templateRows[1]) {
                for (let c = 0; c < Math.min(templateRows[1].length, 47); c++) {
                    row[c] = templateRows[1][c] !== undefined ? templateRows[1][c] : null;
                }
            }

            // Điền dữ liệu vào đúng cột
            row[col.hienThiTrenSo] = null;              // Cột 0: để trống
            row[col.phuongThucTT] = 'Chuyển khoản';     // Cột 1: Phương thức thanh toán
            row[col.ngayHachToan] = item.ngayGD;        // Cột 2: Ngày hạch toán
            row[col.ngayChungTu] = item.ngayGD;         // Cột 3: Ngày chứng từ
            row[col.soChungTu] = item.soThamChieu;      // Cột 4: Số chứng từ
            row[col.taiKhoanChi] = null;                // Cột 5: Tài khoản chi
            row[col.moTaiNH] = null;                    // Cột 6: Mở tại NH
            row[col.noiDungTT] = item.moTa || null;     // Cột 7: Nội dung thanh toán
            row[col.dienGiaiNoiDungTT] = null;          // Cột 8: Diễn giải nội dung thanh toán
            row[col.maDoiTuong] = item.maDT || null;    // Cột 9: Mã đối tượng
            row[col.tenDoiTuong] = item.tenDT || null;  // Cột 10: Tên đối tượng
            row[col.diaChi] = item.diaChi || null;      // Cột 11: Địa chỉ
            // Cột 12-18: để trống (Tài khoản nhận, Tên NH nhận, Người lĩnh tiền, Số CMND, Ngày cấp CMND, Nơi cấp CMND, Nhân viên)
            row[col.dienGiai] = item.moTa || null;      // Cột 19: Diễn giải
            // Cột 20-21: TK Nợ, TK Có - giữ nguyên từ template mẫu
            // Cột 22: Số tiền
            row[col.soTien] = item.soTien;
            // Cột 23-32: để trống (Mã đối tượng CT, Khoản mục CP, Đơn vị, ĐT tập hợp CP, Công trình, Đơn đặt hàng, Hợp đồng mua, Hợp đồng bán, Chi phí không hợp lý, Mã thống kê)
            // Cột 33-38: để trống (Diễn giải thuế, TK thuế GTGT, Tiền thuế GTGT, % thuế GTGT, Tỷ lệ tính thuế, Giá trị HHDV chưa thuế)
            // Cột 39-43: để trống (Mẫu số HĐ, Ký hiệu HĐ, Số HĐ, Ngày HĐ, Nhóm HHDV)
            row[col.maNCC] = item.maDT || null;         // Cột 44: Mã NCC
            row[col.tenNCC] = item.tenDT || null;       // Cột 45: Tên NCC
            row[col.maSoThueNCC] = item.mst || null;    // Cột 46: Mã số thuế NCC

            result.push(row);
        }

        return result;
    }

    // Không có template - vẫn tạo đúng 47 cột
    const result = [];
    result.push([
        'Hiển thị trên sổ', 'Phương thức thanh toán', 'Ngày hạch toán (*)', 'Ngày chứng từ (*)',
        'Số chứng từ (*)', 'Tài khoản chi', 'Mở tại NH', 'Nội dung thanh toán',
        'Diễn giải nội dung thanh toán', 'Mã đối tượng', 'Tên đối tượng', 'Địa chỉ',
        'Tài khoản nhận', 'Tên NH nhận', 'Người lĩnh tiền', 'Số CMND', 'Ngày cấp CMND',
        'Nơi cấp CMND', 'Nhân viên', 'Diễn giải', 'TK Nợ (*)', 'TK Có (*)', 'Số tiền',
        'Mã đối tượng (Chi tiết)', 'Khoản mục chi phí', 'Đơn vị', 'ĐT tập hợp chi phí',
        'Công trình', 'Đơn đặt hàng', 'Hợp đồng mua', 'Hợp đồng bán',
        'Chi phí không hợp lý', 'Mã thống kê', 'Diễn giải (Thuế)', 'TK thuế GTGT',
        'Tiền thuế GTGT', '% thuế GTGT', 'Tỷ lệ tính thuế (Thuế suất KHAC)',
        'Giá trị HHDV chưa thuế', 'Mẫu số hóa đơn', 'Ký hiệu hóa đơn', 'Số hóa đơn',
        'Ngày hóa đơn', 'Nhóm HHDV mua vào', 'Mã NCC', 'Tên NCC', 'Mã số thuế NCC'
    ]);

    for (const item of phieuChiData) {
        const row = new Array(47).fill(null);
        row[1] = 'Chuyển khoản';
        row[2] = item.ngayGD;
        row[3] = item.ngayGD;
        row[4] = item.soThamChieu;
        row[7] = item.moTa || null;
        row[9] = item.maDT || null;
        row[10] = item.tenDT || null;
        row[11] = item.diaChi || null;
        row[19] = item.moTa || null;
        row[22] = item.soTien;
        row[44] = item.maDT || null;
        row[45] = item.tenDT || null;
        row[46] = item.mst || null;
        result.push(row);
    }

    return result;
}

/**
 * Xuất dữ liệu phiếu thu/chi ra file Excel
 * @param {Array} phieuThuRows - Mảng rows phiếu thu
 * @param {Array} phieuChiRows - Mảng rows phiếu chi
 * @param {string} fileName - Tên file xuất
 */
function exportVouchersToExcel(phieuThuRows, phieuChiRows, fileName) {
    const wb = XLSX.utils.book_new();

    if (phieuThuRows && phieuThuRows.length > 0) {
        const ws = XLSX.utils.aoa_to_sheet(phieuThuRows);
        // Set độ rộng cột tự động
        ws['!cols'] = phieuThuRows[0].map((_, i) => ({ wch: 20 }));
        XLSX.utils.book_append_sheet(wb, ws, 'Phiếu thu');
    }

    if (phieuChiRows && phieuChiRows.length > 0) {
        const ws = XLSX.utils.aoa_to_sheet(phieuChiRows);
        ws['!cols'] = phieuChiRows[0].map((_, i) => ({ wch: 20 }));
        XLSX.utils.book_append_sheet(wb, ws, 'Phiếu chi');
    }

    if (wb.SheetNames.length === 0) return;

    XLSX.writeFile(wb, fileName || 'Phieu_Thu_Chi.xlsx');
}

/**
 * Tạo HTML báo cáo phiếu thu/chi
 * @param {Object} voucherData - Kết quả từ prepareVoucherData()
 * @returns {string} - HTML
 */
function generateVoucherReport(voucherData) {
    const { phieuThu, phieuChi } = voucherData;

    if (phieuThu.length === 0 && phieuChi.length === 0) {
        return '<p style="text-align:center;color:#888;padding:20px;">Không có dữ liệu để tạo phiếu</p>';
    }

    const tongThu = phieuThu.reduce((s, p) => s + p.soTien, 0);
    const tongChi = phieuChi.reduce((s, p) => s + p.soTien, 0);

    let html = `
        <div class="summary-info">
            <span class="summary-info-item">📥 Phiếu thu: <strong>${phieuThu.length}</strong></span>
            <span class="summary-info-item">📤 Phiếu chi: <strong>${phieuChi.length}</strong></span>
            <span class="summary-info-item">💰 Tổng thu: <strong>${formatMoney(Math.round(tongThu))} đ</strong></span>
            <span class="summary-info-item">💰 Tổng chi: <strong>${formatMoney(Math.round(tongChi))} đ</strong></span>
        </div>
        <div style="margin-top:16px;">
            <button class="btn-compare" onclick="exportVouchers()" style="margin-right:8px;">
                📥 Xuất Excel
            </button>
        </div>
    `;

    return html;
}

/**
 * Tạo bảng chi tiết phiếu thu
 * @param {Array} phieuThu - Mảng phiếu thu
 * @returns {string} - HTML table
 */
function generatePhieuThuTable(phieuThu) {
    if (!phieuThu || phieuThu.length === 0) {
        return '<p style="text-align:center;color:#888;padding:20px;">Không có phiếu thu</p>';
    }

    let html = `<h3 style="margin:16px 0 8px;color:#34a853;">📥 Phiếu thu (${phieuThu.length})</h3>
    <table>
        <thead>
            <tr>
                <th>STT</th>
                <th>Ngày GD</th>
                <th>Số CT</th>
                <th>Mã KH</th>
                <th>Tên khách hàng</th>
                <th>MST</th>
                <th>Số tiền (đ)</th>
                <th>Nội dung</th>
            </tr>
        </thead>
        <tbody>`;

    phieuThu.forEach((p, i) => {
        html += `<tr>
            <td>${i + 1}</td>
            <td>${p.ngayGD}</td>
            <td>${p.soThamChieu || '—'}</td>
            <td>${p.maDT || '—'}</td>
            <td>${escapeHtml(p.tenDT || '—')}</td>
            <td>${p.mst || '—'}</td>
            <td style="text-align:right">${formatMoney(Math.round(p.soTien))}</td>
            <td style="max-width:250px;white-space:normal;word-break:break-word;">${escapeHtml(p.moTa || '')}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    return html;
}

/**
 * Tạo bảng chi tiết phiếu chi
 * @param {Array} phieuChi - Mảng phiếu chi
 * @returns {string} - HTML table
 */
function generatePhieuChiTable(phieuChi) {
    if (!phieuChi || phieuChi.length === 0) {
        return '<p style="text-align:center;color:#888;padding:20px;">Không có phiếu chi</p>';
    }

    let html = `<h3 style="margin:16px 0 8px;color:#ea4335;">📤 Phiếu chi (${phieuChi.length})</h3>
    <table>
        <thead>
            <tr>
                <th>STT</th>
                <th>Ngày GD</th>
                <th>Số CT</th>
                <th>Mã NCC</th>
                <th>Tên NCC</th>
                <th>MST</th>
                <th>Số tiền (đ)</th>
                <th>Nội dung</th>
            </tr>
        </thead>
        <tbody>`;

    phieuChi.forEach((p, i) => {
        html += `<tr>
            <td>${i + 1}</td>
            <td>${p.ngayGD}</td>
            <td>${p.soThamChieu || '—'}</td>
            <td>${p.maDT || '—'}</td>
            <td>${escapeHtml(p.tenDT || '—')}</td>
            <td>${p.mst || '—'}</td>
            <td style="text-align:right">${formatMoney(Math.round(p.soTien))}</td>
            <td style="max-width:250px;white-space:normal;word-break:break-word;">${escapeHtml(p.moTa || '')}</td>
        </tr>`;
    });

    html += '</tbody></table>';
    return html;
}
