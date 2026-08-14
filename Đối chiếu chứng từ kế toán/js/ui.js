// ============================================================
// Giao diện người dùng
// ============================================================

// State management
const AppState = {
    banRa: {
        files: [],          // Danh sách File objects đã chọn
        detected: {},       // Map: fileName -> fileType
        fileRows: {},       // Map: fileName -> rows (đã đọc)
        sourceInfo: null,   // Thông tin nguồn sau khi gộp
        results: null,      // Kết quả so sánh
        stats: null,        // Thống kê
        biThayTheItems: [],
        bkGrouped: [],
        hdItems: []
    },
    muaVao: {
        files: [],
        detected: {},
        fileRows: {},
        sourceInfo: null,
        results: null,
        stats: null,
        biThayTheItems: [],
        bkGrouped: [],
        hdItems: []
    },
    doiChieu: {
        files: [],
        detected: {},
        fileRows: {},
        sourceInfo: null,
        results: null,
        stats: null
    },
    taoPhieu: {
        files: [],
        detected: {},
        fileRows: {},
        sourceInfo: null,
        results: null,
        stats: null
    }
};

// ============================================================
// Main Tab switching (3 tabs chính)
// ============================================================

function switchMainTab(mainTab) {
    // Cập nhật active cho main tabs
    document.querySelectorAll('.main-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Active tab hiện tại
    const tabButtons = document.querySelectorAll('.main-tabs .tab-btn');
    const tabIndex = { soSanh: 0, doiChieu: 1, taoPhieu: 2 };
    const idx = tabIndex[mainTab];
    if (idx !== undefined && tabButtons[idx]) {
        tabButtons[idx].classList.add('active');
    }

    const tabEl = document.getElementById('tab-' + mainTab);
    if (tabEl) tabEl.classList.add('active');
}

// ============================================================
// Sub Tab switching (Bán ra / Mua vào trong tab So sánh)
// ============================================================

function switchSubTab(mainTab, subTab) {
    // Cập nhật active cho sub-tabs trong mainTab
    const parent = document.getElementById('tab-' + mainTab);
    if (!parent) return;

    const subTabBtns = parent.querySelectorAll('.sub-tabs .tab-btn');
    subTabBtns.forEach(b => b.classList.remove('active'));

    const subTabContents = parent.querySelectorAll('.tab-content');
    subTabContents.forEach(c => c.classList.remove('active'));

    // Active sub-tab
    const subTabId = 'subtab-' + mainTab + '-' + subTab;
    const subTabEl = document.getElementById(subTabId);
    if (subTabEl) subTabEl.classList.add('active');

    // Active sub-tab button
    const subIdx = { banRa: 0, muaVao: 1 };
    const idx = subIdx[subTab];
    if (idx !== undefined && subTabBtns[idx]) {
        subTabBtns[idx].classList.add('active');
    }
}

// ============================================================
// File selection handling
// ============================================================

/**
 * Xử lý khi user chọn file cho 1 tab
 * @param {string} tab - 'banRa', 'muaVao', 'doiChieu', hoặc 'taoPhieu'
 */
async function handleFileSelect(tab) {
    const inputMap = {
        banRa: 'fileInputBanRa',
        muaVao: 'fileInputMuaVao',
        doiChieu: 'fileInputDoiChieu',
        taoPhieu: 'fileInputTaoPhieu'
    };
    const inputId = inputMap[tab];
    if (!inputId) return;
    const input = document.getElementById(inputId);
    const files = input.files;

    if (!files || files.length === 0) return;

    const state = AppState[tab];

    for (const file of files) {
        // Kiểm tra file đã được thêm chưa
        if (state.detected[file.name]) continue;

        try {
            // Đọc file
            const rows = await readFile(file);
            state.fileRows[file.name] = rows;

            // Phân loại (truyền thêm tên file để fallback khi nội dung không đủ)
            const fileType = detectFileType(rows, file.name);
            state.detected[file.name] = fileType;
            state.files.push(file);

        } catch (err) {
            console.error('Lỗi đọc file:', file.name, err);
            state.detected[file.name] = FILE_TYPES.UNKNOWN;
            state.files.push(file);
        }
    }

    // Reset input để cho phép chọn lại file đã chọn trước đó
    input.value = '';

    renderFileList(tab);
    updateCompareButton(tab);
}

// ============================================================
// Render file list
// ============================================================

/**
 * Hiển thị danh sách file đã chọn
 * @param {string} tab - 'banRa', 'muaVao', 'doiChieu', hoặc 'taoPhieu'
 */
function renderFileList(tab) {
    const containerMap = {
        banRa: 'fileListBanRa',
        muaVao: 'fileListMuaVao',
        doiChieu: 'fileListDoiChieu',
        taoPhieu: 'fileListTaoPhieu'
    };
    const containerId = containerMap[tab];
    if (!containerId) return;
    const container = document.getElementById(containerId);
    const state = AppState[tab];

    if (state.files.length === 0) {
        container.innerHTML = '<div class="file-list-empty">Chưa có file nào được chọn</div>';
        return;
    }

    let html = '';
    for (let i = 0; i < state.files.length; i++) {
        const file = state.files[i];
        const fileType = state.detected[file.name] || FILE_TYPES.UNKNOWN;
        const label = FILE_TYPE_LABELS[fileType] || '❓ Không xác định';
        const isUnknown = fileType === FILE_TYPES.UNKNOWN;
        const icon = isUnknown ? '❌' : '✅';

        html += `
            <div class="file-item ${isUnknown ? 'file-item-unknown' : 'file-item-ok'}" data-file-index="${i}" data-tab="${tab}">
                <span class="file-icon">${icon}</span>
                <span class="file-name">${escapeHtml(file.name)}</span>
                <span class="file-type">${label}</span>
                <button class="file-remove" title="Xóa">✕</button>
            </div>
        `;
    }

    container.innerHTML = html;
}

/**
 * Escape HTML entities để tránh lỗi khi hiển thị tên file
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Cập nhật trạng thái nút So sánh
 * @param {string} tab - 'banRa', 'muaVao', 'doiChieu', hoặc 'taoPhieu'
 */
function updateCompareButton(tab) {
    const btnMap = {
        banRa: 'btnCompareBanRa',
        muaVao: 'btnCompareMuaVao',
        doiChieu: 'btnDoiChieu',
        taoPhieu: 'btnTaoPhieu'
    };
    const btnId = btnMap[tab];
    if (!btnId) return;
    const btn = document.getElementById(btnId);
    const state = AppState[tab];

    // Cần có ít nhất 1 file để bấm nút
    const hasAnyFile = state.files.length > 0;
    btn.disabled = !hasAnyFile;
}

// ============================================================
// Run comparison
// ============================================================

/**
 * Chạy so sánh cho 1 tab
 * @param {string} tab - 'banRa' hoặc 'muaVao'
 */
async function runCompare(tab) {
    const btnId = tab === 'banRa' ? 'btnCompareBanRa' : 'btnCompareMuaVao';
    const btn = document.getElementById(btnId);
    const state = AppState[tab];

    btn.disabled = true;
    btn.textContent = '⏳ Đang xử lý...';

    try {
        // Kiểm tra đầu vào
        const hasUnknown = state.files.some(f => state.detected[f.name] === FILE_TYPES.UNKNOWN);
        if (hasUnknown) {
            alert('Có file không xác định được loại. Vui lòng kiểm tra lại danh sách file.');
            btn.disabled = false;
            btn.textContent = '▶ So sánh';
            return;
        }

        // Phân loại file theo loại
        const bangKeFiles = [];
        const hdDaCapMaFiles = [];
        const hdMayTinhTienFiles = [];
        const hdKhongCapMaFiles = [];

        for (const file of state.files) {
            const type = state.detected[file.name];
            const rows = state.fileRows[file.name];

            if (tab === 'banRa') {
                if (type === FILE_TYPES.BANG_KE_BAN_RA) {
                    bangKeFiles.push({ fileName: file.name, rows });
                } else if (type === FILE_TYPES.HD_BAN_RA_DA_CAP_MA) {
                    hdDaCapMaFiles.push({ fileName: file.name, rows });
                } else if (type === FILE_TYPES.HD_BAN_RA_MAY_TINH_TIEN) {
                    hdMayTinhTienFiles.push({ fileName: file.name, rows });
                }
            } else {
                if (type === FILE_TYPES.BANG_KE_MUA_VAO) {
                    bangKeFiles.push({ fileName: file.name, rows });
                } else if (type === FILE_TYPES.HD_MUA_VAO_DA_CAP_MA) {
                    hdDaCapMaFiles.push({ fileName: file.name, rows });
                } else if (type === FILE_TYPES.HD_MUA_VAO_KHONG_CAP_MA) {
                    hdKhongCapMaFiles.push({ fileName: file.name, rows });
                } else if (type === FILE_TYPES.HD_MUA_VAO_MAY_TINH_TIEN) {
                    hdMayTinhTienFiles.push({ fileName: file.name, rows });
                }
            }
        }

        // Kiểm tra có đủ bảng kê và hóa đơn không
        if (bangKeFiles.length === 0) {
            alert('Thiếu file bảng kê. Vui lòng import file bảng kê trước khi so sánh.');
            btn.disabled = false;
            btn.textContent = '▶ So sánh';
            return;
        }

        const hasHoaDon = hdDaCapMaFiles.length > 0 || hdMayTinhTienFiles.length > 0 || hdKhongCapMaFiles.length > 0;
        if (!hasHoaDon) {
            alert('Thiếu file hóa đơn. Vui lòng import file hóa đơn trước khi so sánh.');
            btn.disabled = false;
            btn.textContent = '▶ So sánh';
            return;
        }

        // Gộp dữ liệu
        const mergedBangKe = mergeFiles(bangKeFiles);
        const mergedHdDaCapMa = mergeFiles(hdDaCapMaFiles);
        const mergedHdMayTinhTien = mergeFiles(hdMayTinhTienFiles);
        const mergedHdKhongCapMa = mergeFiles(hdKhongCapMaFiles);

        // Lưu thông tin nguồn
        const allSourceInfo = [
            ...mergedBangKe.sourceInfo,
            ...mergedHdDaCapMa.sourceInfo,
            ...mergedHdMayTinhTien.sourceInfo,
            ...mergedHdKhongCapMa.sourceInfo
        ];
        state.sourceInfo = allSourceInfo;

        // Chạy so sánh
        let result;
        if (tab === 'banRa') {
            result = processBanRa(
                mergedBangKe.rows,
                mergedHdDaCapMa.rows,
                mergedHdMayTinhTien.rows
            );
        } else {
            result = processMuaVao(
                mergedBangKe.rows,
                mergedHdDaCapMa.rows,
                mergedHdKhongCapMa.rows,
                mergedHdMayTinhTien.rows
            );
        }

        state.results = result.results;
        state.stats = result.stats;
        state.biThayTheItems = result.summary ? result.summary.biThayTheItems : [];
        state.bkGrouped = result.summary ? result.summary.bkGrouped : [];
        state.hdItems = result.summary ? result.summary.hdItems : [];

        // Render
        const summaryId = tab === 'banRa' ? 'summary-banRa' : 'summary-muaVao';
        const detailId = tab === 'banRa' ? 'detail-banRa' : 'detail-muaVao';
        const resultId = tab === 'banRa' ? 'result-banRa' : 'result-muaVao';

        renderSummary(summaryId, result.stats, allSourceInfo, result.summary, result.results);
        renderResults(detailId, result.results);
        document.getElementById(resultId).style.display = 'block';

    } catch (err) {
        alert('Lỗi: ' + err.message);
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.textContent = tab === 'banRa' ? '▶ So sánh Bán ra' : '▶ So sánh Mua vào';
    }
}

// ============================================================
// Run Đối chiếu Sao kê (Tab 2)
// ============================================================

/**
 * Chạy đối chiếu sao kê ngân hàng với danh sách khách hàng/NCC
 */
async function runDoiChieu() {
    const btn = document.getElementById('btnDoiChieu');
    const state = AppState.doiChieu;

    btn.disabled = true;
    btn.textContent = '⏳ Đang xử lý...';

    try {
        // Kiểm tra đầu vào
        const hasUnknown = state.files.some(f => state.detected[f.name] === FILE_TYPES.UNKNOWN);
        if (hasUnknown) {
            alert('Có file không xác định được loại. Vui lòng kiểm tra lại danh sách file.');
            btn.disabled = false;
            btn.textContent = '▶ Đối chiếu Sao kê';
            return;
        }

        // Phân loại file
        let bankRows = null;
        let customerRows = null;
        let vendorRows = null;

        for (const file of state.files) {
            const type = state.detected[file.name];
            const rows = state.fileRows[file.name];

            if (type === FILE_TYPES.SAO_KE_NGAN_HANG) {
                bankRows = rows;
            } else if (type === FILE_TYPES.DANH_SACH_KHACH_HANG) {
                customerRows = rows;
            } else if (type === FILE_TYPES.DANH_SACH_NHA_CUNG_CAP) {
                vendorRows = rows;
            }
        }

        if (!bankRows) {
            alert('Thiếu file sao kê ngân hàng. Vui lòng import file sao kê trước.');
            btn.disabled = false;
            btn.textContent = '▶ Đối chiếu Sao kê';
            return;
        }

        // Parse dữ liệu
        const bankResult = parseBankStatement(bankRows);
        const customerResult = customerRows ? parseCustomerList(customerRows) : { customers: [] };
        const vendorResult = vendorRows ? parseVendorList(vendorRows) : { vendors: [] };

        // Đối chiếu
        const matchResult = matchTransactions(
            bankResult.transactions,
            customerResult.customers,
            vendorResult.vendors
        );

        // Lưu state
        state.results = matchResult;
        state.stats = matchResult.stats;
        state.sourceInfo = [
            bankResult.sourceInfo,
            customerResult.sourceInfo,
            vendorResult.sourceInfo
        ];

        // Render
        const sourceHtml = state.sourceInfo
            ? `<div class="source-info">📂 ${formatSourceInfo(state.sourceInfo)}</div>`
            : '';

        document.getElementById('summary-doiChieu').innerHTML = sourceHtml + generateMatchReport(matchResult);
        document.getElementById('detail-doiChieu').innerHTML = generateMatchDetailTable(matchResult.matched, true) +
            '<hr style="margin:20px 0">' +
            generateMatchDetailTable(matchResult.unmatched, false);
        document.getElementById('result-doiChieu').style.display = 'block';

    } catch (err) {
        alert('Lỗi: ' + err.message);
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.textContent = '▶ Đối chiếu Sao kê';
    }
}

// ============================================================
// Run Tạo Phiếu Thu/Chi (Tab 3)
// ============================================================

/**
 * Chạy tạo phiếu thu/chi từ sao kê đã đối chiếu
 */
async function runTaoPhieu() {
    const btn = document.getElementById('btnTaoPhieu');
    const state = AppState.taoPhieu;

    btn.disabled = true;
    btn.textContent = '⏳ Đang xử lý...';

    try {
        // Kiểm tra đầu vào
        const hasUnknown = state.files.some(f => state.detected[f.name] === FILE_TYPES.UNKNOWN);
        if (hasUnknown) {
            alert('Có file không xác định được loại. Vui lòng kiểm tra lại danh sách file.');
            btn.disabled = false;
            btn.textContent = '▶ Tạo Phiếu Thu/Chi';
            return;
        }

        // Phân loại file
        let bankRows = null;
        let customerRows = null;
        let vendorRows = null;
        let phieuThuRows = null;
        let phieuChiRows = null;

        for (const file of state.files) {
            const type = state.detected[file.name];
            const rows = state.fileRows[file.name];

            if (type === FILE_TYPES.SAO_KE_NGAN_HANG) {
                bankRows = rows;
            } else if (type === FILE_TYPES.DANH_SACH_KHACH_HANG) {
                customerRows = rows;
            } else if (type === FILE_TYPES.DANH_SACH_NHA_CUNG_CAP) {
                vendorRows = rows;
            } else if (type === FILE_TYPES.MAU_PHIEU_THU) {
                phieuThuRows = rows;
            } else if (type === FILE_TYPES.MAU_PHIEU_CHI) {
                phieuChiRows = rows;
            }
        }

        if (!bankRows) {
            alert('Thiếu file sao kê ngân hàng.');
            btn.disabled = false;
            btn.textContent = '▶ Tạo Phiếu Thu/Chi';
            return;
        }

        // Parse dữ liệu
        const bankResult = parseBankStatement(bankRows);
        const customerResult = customerRows ? parseCustomerList(customerRows) : { customers: [] };
        const vendorResult = vendorRows ? parseVendorList(vendorRows) : { vendors: [] };

        // Đối chiếu
        const matchResult = matchTransactions(
            bankResult.transactions,
            customerResult.customers,
            vendorResult.vendors
        );

        // Chuẩn bị dữ liệu phiếu - dùng TẤT CẢ giao dịch (cả matched và unmatched)
        const allTransactions = [...matchResult.matched, ...matchResult.unmatched];
        const voucherData = prepareVoucherData(allTransactions);

        // Tạo rows cho xuất Excel
        const phieuThuExcelRows = generatePhieuThu(voucherData.phieuThu, phieuThuRows);
        const phieuChiExcelRows = generatePhieuChi(voucherData.phieuChi, phieuChiRows);

        // Lưu state để export
        state.results = voucherData;
        state.stats = {
            phieuThu: voucherData.phieuThu.length,
            phieuChi: voucherData.phieuChi.length,
            tongThu: voucherData.phieuThu.reduce((s, p) => s + p.soTien, 0),
            tongChi: voucherData.phieuChi.reduce((s, p) => s + p.soTien, 0)
        };
        state.phieuThuExcelRows = phieuThuExcelRows;
        state.phieuChiExcelRows = phieuChiExcelRows;

        // Render
        const sourceHtml = `<div class="source-info">📂 ${formatSourceInfo([
            bankResult.sourceInfo,
            customerResult.sourceInfo,
            vendorResult.sourceInfo
        ])}</div>`;

        document.getElementById('summary-taoPhieu').innerHTML = sourceHtml + generateVoucherReport(voucherData);
        document.getElementById('detail-taoPhieu').innerHTML =
            generatePhieuThuTable(voucherData.phieuThu) +
            generatePhieuChiTable(voucherData.phieuChi);
        document.getElementById('result-taoPhieu').style.display = 'block';

    } catch (err) {
        alert('Lỗi: ' + err.message);
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.textContent = '▶ Tạo Phiếu Thu/Chi';
    }
}

// ============================================================
// Export vouchers to Excel
// ============================================================

/**
 * Xuất phiếu thu/chi ra file Excel
 */
function exportVouchers() {
    const state = AppState.taoPhieu;
    if (!state.phieuThuExcelRows && !state.phieuChiExcelRows) {
        alert('Không có dữ liệu để xuất');
        return;
    }
    exportVouchersToExcel(state.phieuThuExcelRows, state.phieuChiExcelRows, 'Phieu_Thu_Chi.xlsx');
}

// ============================================================
// Modal functions for Đối chiếu tab
// ============================================================

/**
 * Hiển thị modal danh sách đã đối chiếu
 */
function showModalMatched() {
    const state = AppState.doiChieu;
    if (!state.results || !state.results.matched) return;

    const items = state.results.matched;
    const title = `✅ Đã đối chiếu (${items.length})`;

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = generateMatchDetailTable(items, true);
    document.getElementById('modalOverlay').classList.add('active');
}

/**
 * Hiển thị modal danh sách chưa đối chiếu
 */
function showModalUnmatched() {
    const state = AppState.doiChieu;
    if (!state.results || !state.results.unmatched) return;

    const items = state.results.unmatched;
    const title = `❌ Chưa đối chiếu (${items.length})`;

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = generateMatchDetailTable(items, false);
    document.getElementById('modalOverlay').classList.add('active');
}

// ============================================================
// Render results
// ============================================================

/**
 * Hiển thị thống kê
 * @param {string} containerId - ID container
 * @param {Object} stats - Thống kê
 * @param {Array} sourceInfo - Thông tin nguồn
 * @param {Object} summary - Thông tin tổng quan (tongSoBK, tongSoHD, soHDThayThe)
 * @param {Array} results - Kết quả so sánh (để tính tổng tiền)
 */
function renderSummary(containerId, stats, sourceInfo, summary, results) {
    const container = document.getElementById(containerId);

    if (!stats || stats.total === 0) {
        container.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Không có dữ liệu để so sánh</p>';
        return;
    }

    // Xác định tab từ containerId
    const tab = containerId.includes('banRa') ? 'banRa' : 'muaVao';

    const sourceHtml = sourceInfo && sourceInfo.length > 0
        ? `<div class="source-info">📂 ${formatSourceInfo(sourceInfo)}</div>`
        : '';

    // Tính tổng số tiền
    // Tổng tiền BK: lấy từ bkGrouped gốc (toàn bộ file BK) để hiển thị đúng tổng file
    let tongTienBK = 0;
    let tongThueBK = 0;
    if (summary && summary.bkGrouped && summary.bkGrouped.length > 0) {
        for (const bk of summary.bkGrouped) {
            tongTienBK += bk.tongTien || 0;
            tongThueBK += bk.tongThue || 0;
        }
    }
    // Tổng tiền HD: lấy từ hdItems gốc (toàn bộ file HD)
    let tongTienHD = 0;
    let tongThueHD = 0;
    if (summary && summary.hdItems && summary.hdItems.length > 0) {
        for (const hd of summary.hdItems) {
            tongTienHD += hd.tienChuaThue || 0;
            tongThueHD += hd.tienThue || 0;
        }
    }
    // Tổng chênh lệch tiền: lấy từ results (kết quả so sánh)
    let tongChenhLech = 0;
    let tongChenhLechThue = 0;
    if (results && results.length > 0) {
        for (const r of results) {
            tongChenhLech += r.chenhLech || 0;
            tongChenhLechThue += r.chenhLechThue || 0;
        }
    }

    // Thông tin tổng quan
    let summaryHtml = '';
    if (summary) {
        // Chi tiết số lượng hóa đơn theo loại
        let hdTypeDetailHtml = '';
        if (summary.hdTypeCount) {
            const parts = [];
            for (const [type, count] of Object.entries(summary.hdTypeCount)) {
                parts.push(`${type}: <strong>${count}</strong>`);
            }
            if (parts.length > 0) {
                hdTypeDetailHtml = `<span class="summary-info-item">📄 Hóa đơn: <strong>${summary.tongSoHD}</strong> (${parts.join(', ')})</span>`;
            }
        }
        if (!hdTypeDetailHtml) {
            hdTypeDetailHtml = `<span class="summary-info-item">📄 Hóa đơn: <strong>${summary.tongSoHD}</strong></span>`;
        }

        const hasBiThayThe = summary.soHDBiThayThe > 0;
        summaryHtml = `<div class="summary-info">
            <span class="summary-info-item clickable" onclick="showModalBangKe('${tab}')" style="cursor:pointer">📊 Bảng kê: <strong>${summary.tongSoBK}</strong> 📋</span>
            ${hdTypeDetailHtml}
            <span class="summary-info-item clickable" onclick="showModalHoaDon('${tab}')" style="cursor:pointer">📄 Hóa đơn: <strong>${summary.tongSoHD}</strong> 📋</span>
            <span class="summary-info-item${hasBiThayThe ? ' clickable' : ''}"${hasBiThayThe ? ` onclick="showModalBiThayThe('${tab}')" style="cursor:pointer"` : ''}>🔄 HĐ bị thay thế: <strong>${summary.soHDBiThayThe}</strong></span>
        </div>`;
    }

    // Định dạng tổng tiền
    const tongTienBKStr = formatMoney(Math.round(tongTienBK));
    const tongThueBKStr = formatMoney(Math.round(tongThueBK));
    const tongTienHDStr = formatMoney(Math.round(tongTienHD));
    const tongThueHDStr = formatMoney(Math.round(tongThueHD));
    const tongChenhLechStr = formatMoney(Math.round(tongChenhLech));
    const tongChenhLechThueStr = formatMoney(Math.round(tongChenhLechThue));
    const chenhLechClass = Math.abs(tongChenhLech) > 0 ? 'amount-diff' : '';
    const chenhLechThueClass = Math.abs(tongChenhLechThue) > 0 ? 'amount-diff' : '';

    const hasChenhLech = Math.abs(tongChenhLech) > 0;
    const hasChenhLechThue = Math.abs(tongChenhLechThue) > 0;

    // Tính tổng tiền từ results để so sánh với file gốc
    let tongTienBKResults = 0;
    let tongTienHDResults = 0;
    if (results && results.length > 0) {
        for (const r of results) {
            tongTienBKResults += r.bangKeTien || 0;
            tongTienHDResults += r.hoaDonTien || 0;
        }
    }

    // Kiểm tra sai lệch giữa file gốc và tính toán
    const bkDiff = Math.abs(tongTienBK - tongTienBKResults);
    const hdDiff = Math.abs(tongTienHD - tongTienHDResults);
    const hasFileDiff = bkDiff > 1 || hdDiff > 1;

    container.innerHTML = `
        ${sourceHtml}
        ${summaryHtml}
        <div class="summary-totals">
            <div class="summary-totals-row">
                <div class="summary-total-item">
                    <span class="total-label">💰 Tổng tiền Bảng kê:</span>
                    <span class="total-value">${tongTienBKStr} đ</span>
                </div>
                <div class="summary-total-item">
                    <span class="total-label">🧾 Tổng thuế Bảng kê:</span>
                    <span class="total-value">${tongThueBKStr} đ</span>
                </div>
                <div class="summary-total-item${hasChenhLech ? ' clickable' : ''}"${hasChenhLech ? ` onclick="showModalChenhLech('${tab}')" style="cursor:pointer"` : ''}>
                    <span class="total-label">📊 Chênh lệch tiền:</span>
                    <span class="total-value ${chenhLechClass}">${tongChenhLechStr} đ</span>
                </div>
            </div>
            <div class="summary-totals-row">
                <div class="summary-total-item">
                    <span class="total-label">💰 Tổng tiền Hóa đơn:</span>
                    <span class="total-value">${tongTienHDStr} đ</span>
                </div>
                <div class="summary-total-item">
                    <span class="total-label">🧾 Tổng thuế Hóa đơn:</span>
                    <span class="total-value">${tongThueHDStr} đ</span>
                </div>
                <div class="summary-total-item${hasChenhLechThue ? ' clickable' : ''}"${hasChenhLechThue ? ` onclick="showModalByStatus('${tab}', 'mismatchThue')" style="cursor:pointer"` : ''}>
                    <span class="total-label">📊 Chênh lệch thuế:</span>
                    <span class="total-value ${chenhLechThueClass}">${tongChenhLechThueStr} đ</span>
                </div>
            </div>
        </div>
        ${hasFileDiff ? `<div class="summary-warning">
            ⚠️ <strong>Cảnh báo:</strong> Số tiền tính toán không khớp với số tiền trên file gốc!
            <br>Bảng kê: file gốc <strong>${tongTienBKStr} đ</strong> vs tính toán <strong>${formatMoney(Math.round(tongTienBKResults))} đ</strong>
            <br>Hóa đơn: file gốc <strong>${tongTienHDStr} đ</strong> vs tính toán <strong>${formatMoney(Math.round(tongTienHDResults))} đ</strong>
        </div>` : ''}
        <div class="summary-items">
            <div class="summary-item missing" onclick="showModalByStatus('${tab}', 'missingBK')" style="cursor:pointer">❌ Thiếu Bảng kê: ${stats.missingBK}</div>
            <div class="summary-item missing" onclick="showModalByStatus('${tab}', 'missingHD')" style="cursor:pointer">❌ Thiếu HĐ: ${stats.missingHD}</div>
            <div class="summary-item mismatch" onclick="showModalByStatus('${tab}', 'mismatch')" style="cursor:pointer">⚠️ Lệch: ${stats.mismatch}</div>
            <div class="summary-item mismatch" onclick="showModalByStatus('${tab}', 'mismatchThue')" style="cursor:pointer">🧾 Lệch thuế: ${stats.mismatchThue || 0}</div>
            ${stats.duplicate > 0 ? `<div class="summary-item duplicate" onclick="showModalByStatus('${tab}', 'duplicate')" style="cursor:pointer">🔁 Trùng: ${stats.duplicate}</div>` : ''}
            <div class="summary-item match" onclick="showModalByStatus('${tab}', 'match')" style="cursor:pointer">✅ Khớp: ${stats.match}</div>
        </div>
    `;
}

/**
 * Hiển thị bảng kết quả chi tiết
 * Ẩn các dòng KHỚP có chênh lệch = 0 (đã khớp hoàn toàn, không cần kiểm tra)
 * @param {string} containerId - ID container
 * @param {Array} results - Kết quả so sánh
 */
function renderResults(containerId, results) {
    const container = document.getElementById(containerId);

    if (!results || results.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Không có dữ liệu để so sánh</p>';
        return;
    }

    // Lọc: ẩn các dòng KHỚP có chênh lệch = 0 hoặc |chênh lệch| < 1 (sai số làm tròn)
    let filteredResults = results.filter(r => {
        const isMatch = r.status === 'KHỚP' || r.status === 'KHỚP (chi tiết)';
        if (isMatch && Math.abs(r.chenhLech) < 1) return false;
        return true;
    });

    // Sắp xếp: THIẾU BẢNG KÊ lên đầu, THIẾU HĐ thứ 2, LỆCH (lớn→nhỏ) thứ 3, KHỚP cuối
    const sortOrder = { 'THIẾU BẢNG KÊ': 0, 'THIẾU HĐ': 1, 'LỆCH': 2, 'LỆCH (chi tiết)': 2, 'KHỚP': 3, 'KHỚP (chi tiết)': 3 };
    filteredResults.sort((a, b) => {
        const orderA = sortOrder[a.status] !== undefined ? sortOrder[a.status] : 9;
        const orderB = sortOrder[b.status] !== undefined ? sortOrder[b.status] : 9;
        if (orderA !== orderB) return orderA - orderB;
        // Cùng nhóm LỆCH: sắp xếp theo chênh lệch giảm dần (lớn → nhỏ)
        if (a.status === 'LỆCH' || a.status === 'LỆCH (chi tiết)') {
            return Math.abs(b.chenhLech) - Math.abs(a.chenhLech);
        }
        return 0;
    });

    if (filteredResults.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#888;padding:20px;">Tất cả đều khớp, không có dữ liệu cần kiểm tra</p>';
        return;
    }

    let html = `<table>
        <thead>
            <tr>
                <th>STT</th>
                <th>Số HĐ</th>
                <th>Ngày</th>
                <th>Tên</th>
                <th>BK Tiền (đ)</th>
                <th>BK Thuế (đ)</th>
                <th>HD Tiền (đ)</th>
                <th>HD Thuế (đ)</th>
                <th>Loại HĐ</th>
                <th>Chênh lệch (đ)</th>
                <th>Trạng thái</th>
            </tr>
        </thead>
        <tbody>`;

    filteredResults.forEach((r, i) => {
        let rowClass = '';
        let badgeClass = '';
        let statusText = r.status;

        if (r.status === 'KHỚP' || r.status === 'KHỚP (chi tiết)') {
            rowClass = 'match';
            badgeClass = 'ok';
            statusText = '✅ KHỚP';
        } else if (r.status === 'LỆCH' || r.status === 'LỆCH (chi tiết)') {
            rowClass = 'mismatch';
            badgeClass = 'warning';
            statusText = '⚠️ LỆCH';
        } else if (r.status === 'THIẾU HĐ') {
            rowClass = 'missing-in-hoadon';
            badgeClass = 'missing';
            statusText = '❌ THIẾU HĐ';
        } else if (r.status === 'THIẾU BẢNG KÊ') {
            rowClass = 'missing-in-bangke';
            badgeClass = 'missing';
            statusText = '❌ THIẾU BẢNG KÊ';
        }

        const diffClass = r.chenhLech !== 0 ? 'amount-diff' : '';
        const hdTypeLabel = r.hdType || '—';
        const duplicateIcon = r.duplicate ? '🔁 ' : '';

        html += `<tr class="${rowClass}">
            <td>${i + 1}</td>
            <td>${duplicateIcon}${r.soHD}</td>
            <td>${r.ngay}</td>
            <td>${r.ten}</td>
            <td style="text-align:right">${formatMoney(r.bangKeTien)}</td>
            <td style="text-align:right">${formatMoney(r.bangKeThue || 0)}</td>
            <td style="text-align:right">${formatMoney(r.hoaDonTien)}</td>
            <td style="text-align:right">${formatMoney(r.hoaDonThue || 0)}</td>
            <td style="text-align:center"><span class="hd-type-badge">${hdTypeLabel}</span></td>
            <td style="text-align:right" class="${diffClass}">${formatMoney(r.chenhLech)}</td>
            <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
        </tr>`;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ============================================================
// Drag & Drop support
// ============================================================

function setupDragDrop(tab) {
    const dropZoneMap = {
        banRa: 'dropZoneBanRa',
        muaVao: 'dropZoneMuaVao',
        doiChieu: 'dropZoneDoiChieu',
        taoPhieu: 'dropZoneTaoPhieu'
    };
    const inputMap = {
        banRa: 'fileInputBanRa',
        muaVao: 'fileInputMuaVao',
        doiChieu: 'fileInputDoiChieu',
        taoPhieu: 'fileInputTaoPhieu'
    };
    const dropZoneId = dropZoneMap[tab];
    const inputId = inputMap[tab];
    if (!dropZoneId || !inputId) return;
    const dropZone = document.getElementById(dropZoneId);
    const input = document.getElementById(inputId);

    if (!dropZone) return;

    // Click to open file dialog
    dropZone.addEventListener('click', () => input.click());

    // Drag events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            // Gán file vào input để trigger event change
            input.files = files;
            handleFileSelect(tab);
        }
    });

    // File input change
    input.addEventListener('change', () => handleFileSelect(tab));
}

// ============================================================
// Event delegation for remove buttons
// ============================================================

document.addEventListener('click', (e) => {
    const btn = e.target.closest('.file-remove');
    if (!btn) return;

    const fileItem = btn.closest('.file-item');
    if (!fileItem) return;

    const index = parseInt(fileItem.dataset.fileIndex);
    const tab = fileItem.dataset.tab;

    if (!isNaN(index) && tab) {
        removeFileByIndex(index, tab);
    }
});

/**
 * Xóa file theo index (dùng với event delegation)
 */
function removeFileByIndex(index, tab) {
    const state = AppState[tab];
    if (index < 0 || index >= state.files.length) return;

    const file = state.files[index];
    delete state.detected[file.name];
    delete state.fileRows[file.name];
    state.files.splice(index, 1);

    // Reset kết quả nếu có
    state.results = null;
    state.stats = null;
    state.sourceInfo = null;
    if (state.biThayTheItems !== undefined) state.biThayTheItems = [];
    if (state.bkGrouped !== undefined) state.bkGrouped = [];
    if (state.hdItems !== undefined) state.hdItems = [];

    renderFileList(tab);
    updateCompareButton(tab);

    // Ẩn kết quả nếu không còn file
    const resultMap = {
        banRa: 'result-banRa',
        muaVao: 'result-muaVao',
        doiChieu: 'result-doiChieu',
        taoPhieu: 'result-taoPhieu'
    };
    const resultId = resultMap[tab];
    if (resultId) {
        const el = document.getElementById(resultId);
        if (el) el.style.display = 'none';
    }
}

// ============================================================
// Modal functions
// ============================================================

/**
 * Mở modal hiển thị các dòng theo trạng thái
 * @param {string} tab - 'banRa' hoặc 'muaVao'
 * @param {string} statusType - 'match', 'mismatch', 'missingHD', 'missingBK'
 */
function showModalByStatus(tab, statusType) {
    const state = AppState[tab];
    if (!state.results || state.results.length === 0) return;

    // Lọc kết quả theo trạng thái
    let filtered = [];
    let title = '';

    switch (statusType) {
        case 'match':
            filtered = state.results.filter(r => r.status === 'KHỚP' || r.status === 'KHỚP (chi tiết)');
            title = `✅ Khớp (${filtered.length})`;
            break;
        case 'mismatch':
            filtered = state.results.filter(r => r.status === 'LỆCH' || r.status === 'LỆCH (chi tiết)');
            title = `⚠️ Lệch (${filtered.length})`;
            break;
        case 'mismatchThue':
            filtered = state.results.filter(r => {
                const thueDiff = Math.abs(r.chenhLechThue || 0);
                return thueDiff > 1;
            });
            title = `🧾 Lệch thuế (${filtered.length})`;
            break;
        case 'missingHD':
            filtered = state.results.filter(r => r.status === 'THIẾU HĐ');
            title = `❌ Thiếu HĐ (${filtered.length})`;
            break;
        case 'missingBK':
            filtered = state.results.filter(r => r.status === 'THIẾU BẢNG KÊ');
            title = `❌ Thiếu Bảng kê (${filtered.length})`;
            break;
        case 'duplicate':
            filtered = state.results.filter(r => r.duplicate);
            title = `🔁 Trùng (${filtered.length})`;
            break;
        default:
            return;
    }

    if (filtered.length === 0) {
        alert('Không có dữ liệu để hiển thị');
        return;
    }

    // Render bảng trong modal
    let html = `<table>
        <thead>
            <tr>
                <th>STT</th>
                <th>Số HĐ</th>
                <th>Ngày</th>
                <th>Tên</th>
                <th>BK Tiền (đ)</th>
                <th>BK Thuế (đ)</th>
                <th>HD Tiền (đ)</th>
                <th>HD Thuế (đ)</th>
                <th>Loại HĐ</th>
                <th>Chênh lệch (đ)</th>
                <th>Trạng thái</th>
            </tr>
        </thead>
        <tbody>`;

    // Sắp xếp: LỆCH theo chênh lệch lớn → nhỏ
    if (statusType === 'mismatch') {
        filtered.sort((a, b) => Math.abs(b.chenhLech) - Math.abs(a.chenhLech));
    }

    filtered.forEach((r, i) => {
        let badgeClass = '';
        let statusText = r.status;
        if (r.status === 'KHỚP' || r.status === 'KHỚP (chi tiết)') {
            badgeClass = 'ok';
            statusText = '✅ KHỚP';
        } else if (r.status === 'LỆCH' || r.status === 'LỆCH (chi tiết)') {
            badgeClass = 'warning';
            statusText = '⚠️ LỆCH';
        } else if (r.status === 'THIẾU HĐ') {
            badgeClass = 'missing';
            statusText = '❌ THIẾU HĐ';
        } else if (r.status === 'THIẾU BẢNG KÊ') {
            badgeClass = 'missing';
            statusText = '❌ THIẾU BẢNG KÊ';
        }

        const diffClass = r.chenhLech !== 0 ? 'amount-diff' : '';
        const hdTypeLabel = r.hdType || '—';
        const duplicateIcon = r.duplicate ? '🔁 ' : '';

        html += `<tr>
            <td>${i + 1}</td>
            <td>${duplicateIcon}${r.soHD}</td>
            <td>${r.ngay}</td>
            <td>${r.ten}</td>
            <td style="text-align:right">${formatMoney(r.bangKeTien)}</td>
            <td style="text-align:right">${formatMoney(r.bangKeThue || 0)}</td>
            <td style="text-align:right">${formatMoney(r.hoaDonTien)}</td>
            <td style="text-align:right">${formatMoney(r.hoaDonThue || 0)}</td>
            <td style="text-align:center"><span class="hd-type-badge">${hdTypeLabel}</span></td>
            <td style="text-align:right" class="${diffClass}">${formatMoney(r.chenhLech)}</td>
            <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
        </tr>`;
    });

    html += '</tbody></table>';

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('active');
}

/**
 * Đóng modal
 */
function closeModal() {
    document.getElementById('modalOverlay').classList.remove('active');
}

/**
 * Mở modal hiển thị danh sách hóa đơn bị thay thế (đã bỏ qua khi so sánh)
 * @param {string} tab - 'banRa' hoặc 'muaVao'
 */
function showModalBiThayThe(tab) {
    const state = AppState[tab];
    const items = state.biThayTheItems || [];

    if (items.length === 0) {
        alert('Không có hóa đơn bị thay thế nào');
        return;
    }

    const title = `🔄 Hóa đơn bị thay thế (${items.length})`;

    let html = `<table>
        <thead>
            <tr>
                <th>STT</th>
                <th>Số HĐ</th>
                <th>Ngày</th>
                <th>Tên</th>
                <th>Tiền chưa thuế (đ)</th>
                <th>Loại HĐ</th>
                <th>Trạng thái</th>
            </tr>
        </thead>
        <tbody>`;

    items.forEach((item, i) => {
        html += `<tr>
            <td>${i + 1}</td>
            <td>${item.soHD}</td>
            <td>${item.ngay}</td>
            <td>${item.ten}</td>
            <td style="text-align:right">${formatMoney(item.tienChuaThue)}</td>
            <td style="text-align:center"><span class="hd-type-badge">${item.hdType || '—'}</span></td>
            <td><span class="status-badge missing">${item.trangThai || 'Thay thế'}</span></td>
        </tr>`;
    });

    html += '</tbody></table>';

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('active');
}

/**
 * Mở modal hiển thị toàn bộ danh sách bảng kê đã gộp
 * @param {string} tab - 'banRa' hoặc 'muaVao'
 */
function showModalBangKe(tab) {
    const state = AppState[tab];
    const items = state.bkGrouped || [];

    if (items.length === 0) {
        alert('Không có dữ liệu bảng kê');
        return;
    }

    const title = `📊 Danh sách Bảng kê (${items.length} dòng)`;

    let html = `<table>
        <thead>
            <tr>
                <th>STT</th>
                <th>Số HĐ</th>
                <th>Ngày</th>
                <th>Tên</th>
                <th>Tiền (đ)</th>
                <th>Mã số thuế</th>
            </tr>
        </thead>
        <tbody>`;

    items.forEach((item, i) => {
        const soHD = item.soHD || '—';
        html += `<tr>
            <td>${i + 1}</td>
            <td>${soHD}</td>
            <td>${item.ngay}</td>
            <td>${item.ten}</td>
            <td style="text-align:right">${formatMoney(Math.round(item.tongTien))}</td>
            <td>${item.mst || '—'}</td>
        </tr>`;
    });

    html += '</tbody></table>';

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('active');
}

/**
 * Mở modal hiển thị toàn bộ danh sách hóa đơn gốc
 * @param {string} tab - 'banRa' hoặc 'muaVao'
 */
function showModalHoaDon(tab) {
    const state = AppState[tab];
    const items = state.hdItems || [];

    if (items.length === 0) {
        alert('Không có dữ liệu hóa đơn');
        return;
    }

    const title = `📄 Danh sách Hóa đơn (${items.length} dòng)`;

    let html = `<table>
        <thead>
            <tr>
                <th>STT</th>
                <th>Số HĐ</th>
                <th>Ngày</th>
                <th>Tên</th>
                <th>Tiền chưa thuế (đ)</th>
                <th>Loại HĐ</th>
            </tr>
        </thead>
        <tbody>`;

    items.forEach((item, i) => {
        html += `<tr>
            <td>${i + 1}</td>
            <td>${item.soHD}</td>
            <td>${item.ngay}</td>
            <td>${item.ten}</td>
            <td style="text-align:right">${formatMoney(Math.round(item.tienChuaThue))}</td>
            <td style="text-align:center"><span class="hd-type-badge">${item.hdType || '—'}</span></td>
        </tr>`;
    });

    html += '</tbody></table>';

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('active');
}

/**
 * Mở modal hiển thị các dòng có chênh lệch ≠ 0
 * @param {string} tab - 'banRa' hoặc 'muaVao'
 */
function showModalChenhLech(tab) {
    const state = AppState[tab];
    if (!state.results || state.results.length === 0) return;

    // Lọc các dòng có chênh lệch ≠ 0
    const filtered = state.results.filter(r => r.chenhLech !== 0);

    if (filtered.length === 0) {
        alert('Không có dòng nào có chênh lệch');
        return;
    }

    const title = `📊 Chênh lệch (${filtered.length} dòng)`;

    let html = `<table>
        <thead>
            <tr>
                <th>STT</th>
                <th>Số HĐ</th>
                <th>Ngày</th>
                <th>Tên</th>
                <th>BK Tiền (đ)</th>
                <th>BK Thuế (đ)</th>
                <th>HD Tiền (đ)</th>
                <th>HD Thuế (đ)</th>
                <th>Loại HĐ</th>
                <th>Chênh lệch (đ)</th>
                <th>Trạng thái</th>
            </tr>
        </thead>
        <tbody>`;

    filtered.forEach((r, i) => {
        let badgeClass = '';
        let statusText = r.status;
        if (r.status === 'KHỚP' || r.status === 'KHỚP (chi tiết)') {
            badgeClass = 'ok';
            statusText = '✅ KHỚP';
        } else if (r.status === 'LỆCH' || r.status === 'LỆCH (chi tiết)') {
            badgeClass = 'warning';
            statusText = '⚠️ LỆCH';
        } else if (r.status === 'THIẾU HĐ') {
            badgeClass = 'missing';
            statusText = '❌ THIẾU HĐ';
        } else if (r.status === 'THIẾU BẢNG KÊ') {
            badgeClass = 'missing';
            statusText = '❌ THIẾU BẢNG KÊ';
        }

        const diffClass = r.chenhLech !== 0 ? 'amount-diff' : '';
        const hdTypeLabel = r.hdType || '—';

        html += `<tr>
            <td>${i + 1}</td>
            <td>${r.soHD}</td>
            <td>${r.ngay}</td>
            <td>${r.ten}</td>
            <td style="text-align:right">${formatMoney(r.bangKeTien)}</td>
            <td style="text-align:right">${formatMoney(r.bangKeThue || 0)}</td>
            <td style="text-align:right">${formatMoney(r.hoaDonTien)}</td>
            <td style="text-align:right">${formatMoney(r.hoaDonThue || 0)}</td>
            <td style="text-align:center"><span class="hd-type-badge">${hdTypeLabel}</span></td>
            <td style="text-align:right" class="${diffClass}">${formatMoney(r.chenhLech)}</td>
            <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
        </tr>`;
    });

    html += '</tbody></table>';

    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = html;
    document.getElementById('modalOverlay').classList.add('active');
}

// Đóng modal khi nhấn Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
});

// ============================================================
// Initialize
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    setupDragDrop('banRa');
    setupDragDrop('muaVao');
    setupDragDrop('doiChieu');
    setupDragDrop('taoPhieu');
});
