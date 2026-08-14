// ============================================================
// ỨNG DỤNG: Chuyển Sao Kê Ngân Hàng → Sổ Doanh Thu Bán Hàng
// Quy tắc mapping:
//  - Chỉ lấy các giao dịch có "Số tiền ghi có / Credit"
//  - Loại bỏ các giao dịch ghi nợ (Debit)
//  - Loại bỏ giao dịch ghi có nhưng là "INTEREST PAYMENT" (lãi)
// ============================================================

let workbook = null;        // Workbook đã đọc
let sheetData = [];         // Dữ liệu sheet dạng mảng
let headers = [];           // Tên cột
let resultRows = [];        // Kết quả sổ doanh thu

// ---------- DOM Elements ----------
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const mappingSection = document.getElementById('mappingSection');
const btnProcess = document.getElementById('btnProcess');
const btnExport = document.getElementById('btnExport');
const resultSummary = document.getElementById('resultSummary');
const previewSection = document.getElementById('previewSection');
const previewBody = document.querySelector('#previewTable tbody');
const cashTotal = document.getElementById('cashTotal');
const cashPeriod = document.getElementById('cashPeriod');
const cashMin = document.getElementById('cashMin');
const cashMax = document.getElementById('cashMax');
const cashRound = document.getElementById('cashRound');
const cashStartDate = document.getElementById('cashStartDate');
const cashMaxPerDay = document.getElementById('cashMaxPerDay');
const cashOffWeek = document.querySelectorAll('.cashOffWeek');
const cashOffDateInput = document.getElementById('cashOffDateInput');
const btnAddOffDate = document.getElementById('btnAddOffDate');
const cashOffDateList = document.getElementById('cashOffDateList');
const cashInfo = document.getElementById('cashInfo');
let cashOffDateSet = new Set();   // Tập hợp các ngày đóng cửa cụ thể (định dạng DD/MM/YYYY)
const gtgtArea = document.getElementById('gtgtArea');
const gtgtInput = document.getElementById('gtgtInput');
const gtgtInfo = document.getElementById('gtgtInfo');

// ---------- Popup cấu hình tiền mặt ----------
const cashModal = document.getElementById('cashModal');
const btnOpenCash = document.getElementById('btnOpenCash');
const btnCloseCash = document.getElementById('btnCloseCash');
const btnSaveCash = document.getElementById('btnSaveCash');

// Mở popup
btnOpenCash.addEventListener('click', () => {
    cashModal.classList.remove('hidden');
});
// Đóng popup (nút X)
btnCloseCash.addEventListener('click', () => {
    cashModal.classList.add('hidden');
});
// Đóng popup khi click ra ngoài overlay
cashModal.addEventListener('click', (e) => {
    if (e.target === cashModal) {
        cashModal.classList.add('hidden');
    }
});
// Lưu cấu hình: đóng popup và cập nhật thông tin
btnSaveCash.addEventListener('click', () => {
    const total = parseAmount(cashTotal.value);
    if (total > 0) {
        cashInfo.textContent = `✅ Đã cấu hình doanh thu tiền mặt: ${formatMoney(total)} VNĐ (phân bổ theo ${cashPeriod.value === 'month' ? 'tháng' : 'quý'}).`;
        cashInfo.classList.remove('hidden');
        btnProcess.disabled = false;
    } else {
        cashInfo.textContent = '';
        cashInfo.classList.add('hidden');
    }
    cashModal.classList.add('hidden');
});

// ---------- Upload file bảng kê GTGT ----------
let gtgtInvoices = [];   // Danh sách hóa đơn đã gom từ bảng kê GTGT

// Kích hoạt nút "Tạo Sổ Doanh Thu" khi nhập tổng tiền mặt > 0
cashTotal.addEventListener('input', () => {
    if (parseAmount(cashTotal.value) > 0) {
        btnProcess.disabled = false;
    }
});

// ---------- Ngày đóng cửa cụ thể (chips) ----------
// Chuyển định dạng YYYY-MM-DD (từ input date) sang DD/MM/YYYY
function toDDMMYYYY(iso) {
    if (!iso) return '';
    const m = String(iso).match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
        return `${String(parseInt(m[3], 10)).padStart(2, '0')}/${String(parseInt(m[2], 10)).padStart(2, '0')}/${m[1]}`;
    }
    return iso;
}

// Hiển thị danh sách ngày đóng cửa dạng chip
function renderOffDateChips() {
    cashOffDateList.innerHTML = '';
    const sorted = Array.from(cashOffDateSet).sort();
    sorted.forEach(dateStr => {
        const chip = document.createElement('span');
        chip.className = 'offday-chip';
        chip.innerHTML = `${dateStr} <button type="button" title="Xóa ngày" data-date="${dateStr}">✕</button>`;
        cashOffDateList.appendChild(chip);
    });
    // Gắn sự kiện xóa cho từng chip
    cashOffDateList.querySelectorAll('button[data-date]').forEach(btn => {
        btn.addEventListener('click', () => {
            cashOffDateSet.delete(btn.dataset.date);
            renderOffDateChips();
        });
    });
}

// Thêm ngày đóng cửa từ date picker
btnAddOffDate.addEventListener('click', () => {
    const val = cashOffDateInput.value;
    if (!val) {
        alert('Vui lòng chọn một ngày để thêm vào danh sách đóng cửa.');
        return;
    }
    const dateStr = toDDMMYYYY(val);
    cashOffDateSet.add(dateStr);
    renderOffDateChips();
    cashOffDateInput.value = '';
});

gtgtArea.addEventListener('click', () => gtgtInput.click());
gtgtArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    gtgtArea.classList.add('dragover');
});
gtgtArea.addEventListener('dragleave', () => gtgtArea.classList.remove('dragover'));
gtgtArea.addEventListener('drop', (e) => {
    e.preventDefault();
    gtgtArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleGTGTFile(file);
});
gtgtInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleGTGTFile(file);
});

function handleGTGTFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const wb = XLSX.read(data, { type: 'array' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
            gtgtInvoices = parseGTGTInvoices(rows);
            if (!gtgtInvoices.length) {
                alert('Không tìm thấy dữ liệu hóa đơn trong file bảng kê GTGT. Vui lòng kiểm tra lại file.');
                return;
            }
            const total = gtgtInvoices.reduce((s, inv) => s + inv.tongTien, 0);
            gtgtInfo.textContent = `✅ Đã đọc file bảng kê: ${file.name} — ${gtgtInvoices.length} hóa đơn, tổng ${formatMoney(total)} VNĐ`;
            gtgtInfo.classList.remove('hidden');
            btnProcess.disabled = false;
        } catch (err) {
            console.error(err);
            alert('Lỗi khi đọc file bảng kê GTGT: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// Gom tổng tiền theo từng hóa đơn từ bảng kê GTGT
// Cấu trúc cột: [5]=Số hoá đơn, [6]=Ngày phát hành, [12]=Doanh số, [14]=Ghi chú
function parseGTGTInvoices(rows) {
    const map = new Map();
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (!Array.isArray(r)) continue;
        const soHD = r[5];
        const ngay = r[6];
        if (soHD === '' || soHD === undefined || soHD === null) continue;
        if (ngay === '' || ngay === undefined || ngay === null) continue;
        // Bỏ qua dòng tiêu đề (chứa "Số hoá đơn" hoặc "[5]")
        const s = String(soHD).trim();
        if (/số hoá đơn|số hóa đơn|\[5\]/i.test(s)) continue;
        const ghichu = r[14] ? String(r[14]) : '';
        // Bỏ qua hóa đơn "bị thay thế" (doanh số = 0)
        const doanhSo = parseAmount(r[12]);
        if (doanhSo === 0 && /bị thay thế|bi thay the/i.test(ghichu)) continue;
        const key = s;
        if (!map.has(key)) {
            map.set(key, { soHD: s, ngay: formatDate(ngay), tongTien: 0 });
        }
        const inv = map.get(key);
        inv.tongTien += doanhSo;
    }
    // Chuyển thành mảng, bỏ hóa đơn có tổng = 0 (hóa đơn bị thay thế)
    const result = [];
    for (const inv of map.values()) {
        if (inv.tongTien > 0) result.push(inv);
    }
    return result;
}

// ---------- Upload ----------
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
});
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

// ---------- Xử lý file ----------
function handleFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            workbook = XLSX.read(data, { type: 'array' });

            // Lấy sheet đầu tiên
            const firstSheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[firstSheetName];
            sheetData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

            // Tìm dòng tiêu đề (dòng có chứa "Ngày giao dịch" hoặc "Số tiền ghi có")
            const headerRowIndex = findHeaderRow(sheetData);
            if (headerRowIndex === -1) {
                alert('Không tìm thấy dòng tiêu đề cột trong file. Vui lòng kiểm tra lại file sao kê.');
                return;
            }

            headers = sheetData[headerRowIndex].map(h => String(h).trim());
            // Dữ liệu bắt đầu từ dòng sau tiêu đề
            const dataRows = sheetData.slice(headerRowIndex + 1);

            // Hiển thị thông tin file
            fileInfo.textContent = `✅ Đã đọc file: ${file.name} (${workbook.SheetNames.length} sheet, ${dataRows.length} dòng dữ liệu)`;
            fileInfo.classList.remove('hidden');

            // Tự động điền các cột mapping
            autoMapColumns();
            mappingSection.classList.remove('hidden');
            btnProcess.disabled = false;

            // Lưu dữ liệu gốc để xử lý
            window._dataRows = dataRows;
        } catch (err) {
            console.error(err);
            alert('Lỗi khi đọc file: ' + err.message);
        }
    };
    reader.readAsArrayBuffer(file);
}

// Tìm dòng tiêu đề: dòng chứa nhiều từ khóa cột nhất
function findHeaderRow(data) {
    const keywords = ['ngay', 'date', 'so tien', 'amount', 'ghi co', 'credit', 'ghi no', 'debit', 'noi dung', 'content', 'diễn giải', 'so du', 'balance'];
    let bestRow = -1;
    let bestScore = 0;
    for (let i = 0; i < Math.min(data.length, 30); i++) {
        const row = data[i];
        if (!Array.isArray(row)) continue;
        let score = 0;
        for (const cell of row) {
            const s = String(cell).toLowerCase();
            for (const kw of keywords) {
                if (s.includes(kw)) score++;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestRow = i;
        }
    }
    return bestRow;
}

// Tự động gán cột mapping dựa trên tên cột
function autoMapColumns() {
    const colDate = document.getElementById('colDate');
    const colCredit = document.getElementById('colCredit');
    const colDebit = document.getElementById('colDebit');
    const colContent = document.getElementById('colContent');

    // Điền các lựa chọn cột
    [colDate, colCredit, colDebit, colContent].forEach(sel => {
        sel.innerHTML = '';
        headers.forEach((h, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = `${h} (Cột ${idx + 1})`;
            sel.appendChild(opt);
        });
    });

    // Tự động chọn cột phù hợp
    headers.forEach((h, idx) => {
        const s = h.toLowerCase();
        if (s.includes('ngay') || s.includes('date') || s.includes('ngày')) colDate.value = idx;
        if ((s.includes('ghi co') || s.includes('credit') || s.includes('ghi có')) && !s.includes('no')) colCredit.value = idx;
        if ((s.includes('ghi no') || s.includes('debit') || s.includes('ghi nợ')) && !s.includes('co')) colDebit.value = idx;
        if (s.includes('noi dung') || s.includes('content') || s.includes('nội dung') || s.includes('diễn giải') || s.includes('dien giai')) colContent.value = idx;
    });
}

// ---------- Xử lý tạo sổ doanh thu ----------
btnProcess.addEventListener('click', () => {
    const dataRows = window._dataRows || [];
    const soHieu = document.getElementById('soHieu').value.trim() || '2C26MKJ';
    const hasCash = parseAmount(cashTotal.value) > 0;

    // Nếu không có sao kê, không có tiền mặt và không có bảng kê GTGT -> báo lỗi
    if (!dataRows.length && !hasCash && !gtgtInvoices.length) {
        alert('Vui lòng upload file sao kê, nhập doanh thu tiền mặt, hoặc upload file bảng kê GTGT để tạo sổ.');
        return;
    }

    resultRows = [];
    let stt = 1;

    // Nếu có file bảng kê GTGT -> gom tổng tiền theo hóa đơn, xuất sổ map chính xác với số hóa đơn thật
    if (gtgtInvoices.length) {
        gtgtInvoices.forEach(inv => {
            resultRows.push({
                soHieu: soHieu,
                hoaDon: inv.soHD,
                ngay: inv.ngay,
                dienGiai: `Doanh thu bán hàng theo số hóa đơn ${inv.soHD}`,
                soTien: inv.tongTien
            });
        });
        stt = resultRows.length + 1;
    } else {
        // Logic cũ: HKD không xuất hóa đơn, chỉ lấy Credit từ sao kê
        if (dataRows.length) {
            const colDate = parseInt(document.getElementById('colDate').value);
            const colCredit = parseInt(document.getElementById('colCredit').value);
            const colDebit = parseInt(document.getElementById('colDebit').value);
            const colContent = parseInt(document.getElementById('colContent').value);
            const filterDebit = document.getElementById('filterDebit').checked;
            const filterInterest = document.getElementById('filterInterest').checked;

            for (const row of dataRows) {
            if (!Array.isArray(row)) continue;

            const credit = parseAmount(row[colCredit]);
            const debit = parseAmount(row[colDebit]);
            const content = cleanContent(row[colContent]);
            const date = formatDate(row[colDate]);

            // Bỏ qua dòng không có số tiền
            if (credit === 0 && debit === 0) continue;

            // Loại bỏ giao dịch ghi nợ (Debit)
            if (filterDebit && debit > 0) continue;

            // Chỉ lấy giao dịch ghi có (Credit)
            if (credit <= 0) continue;

            // Loại bỏ INTEREST PAYMENT (lãi ngân hàng)
            if (filterInterest && /interest|payment|la[ii]|lãi/i.test(content)) continue;

            // Tạo dòng sổ doanh thu
            resultRows.push({
                soHieu: soHieu,
                hoaDon: stt,
                ngay: date,
                dienGiai: `Doanh thu bán hàng theo số hóa đơn ${stt}`,
                soTien: credit
            });
            stt++;
            }
        }
    }

    // Thêm doanh thu tiền mặt (nếu nhập tổng > 0) — chỉ khi KHÔNG có bảng kê GTGT
    if (hasCash && !gtgtInvoices.length) {
        const cashRows = generateCashRows(soHieu, stt);
        if (cashRows) {
            resultRows = resultRows.concat(cashRows);
            stt += cashRows.length;
        }
    }

    // Hiển thị kết quả
    renderPreview();
    showSummary();
    btnExport.classList.remove('hidden');
});

// ---------- Tạo doanh thu tiền mặt ----------
// Phân bổ tổng số tiền mặt ra các ngày trong tháng/quý.
// Mỗi ngày có thể có NHIỀU giao dịch (số lượng ngẫu nhiên 1..maxPerDay).
// Mỗi giao dịch có số tiền ngẫu nhiên trong [min, max], làm tròn theo bước,
// và đảm bảo tổng đúng bằng tổng đã nhập.
function generateCashRows(soHieu, startStt) {
    const total = parseAmount(cashTotal.value);
    const min = parseAmount(cashMin.value);
    const max = parseAmount(cashMax.value);
    const round = Math.max(1, parseInt(cashRound.value) || 1000);
    const period = cashPeriod.value;
    const maxPerDay = Math.max(1, parseInt(cashMaxPerDay.value) || 3);

    if (total <= 0) {
        alert('Vui lòng nhập tổng số tiền mặt hợp lệ (> 0).');
        return null;
    }
    if (min <= 0 || max < min) {
        alert('Vui lòng nhập khoảng số tiền/giao dịch hợp lệ (min > 0 và max >= min).');
        return null;
    }
    if (total < min) {
        alert('Tổng số tiền mặt nhỏ hơn số tiền tối thiểu/giao dịch. Vui lòng kiểm tra lại.');
        return null;
    }

    // Xác định số ngày tối đa trong kỳ
    let numDays;
    if (period === 'month') {
        numDays = 30;
    } else {
        numDays = 90;
    }

    // Xác định ngày bắt đầu (hỗ trợ định dạng YYYY-MM-DD từ date picker hoặc DD/MM/YYYY)
    let startDate = new Date();
    if (cashStartDate.value) {
        const iso = String(cashStartDate.value).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        const dmy = String(cashStartDate.value).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
        if (iso) {
            startDate = new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
        } else if (dmy) {
            startDate = new Date(parseInt(dmy[3], 10), parseInt(dmy[2], 10) - 1, parseInt(dmy[1], 10));
        } else {
            startDate = new Date(cashStartDate.value + 'T00:00:00');
        }
    }
    if (isNaN(startDate.getTime())) startDate = new Date();

    // ---- Xác định các ngày đóng cửa (off day) ----
    // 1) Các thứ trong tuần đóng cửa cố định
    const offWeekSet = new Set();
    cashOffWeek.forEach(cb => {
        if (cb.checked) offWeekSet.add(parseInt(cb.value, 10));
    });
    // 2) Các ngày cụ thể (đã chọn bằng date picker, lưu trong cashOffDateSet dạng DD/MM/YYYY)
    const offDateSet = new Set(cashOffDateSet);

    // Xây danh sách các ngày CÓ doanh thu (loại bỏ ngày đóng cửa) trong kỳ
    const availableDates = [];
    for (let i = 0; i < numDays; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dow = d.getDay(); // 0=CN, 1=T2, ..., 6=T7
        const key = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        if (offWeekSet.has(dow)) continue;      // đóng cửa theo thứ
        if (offDateSet.has(key)) continue;      // đóng cửa ngày cụ thể
        availableDates.push(d);
    }
    if (availableDates.length === 0) {
        alert('Tất cả các ngày trong kỳ đều là ngày đóng cửa. Vui lòng bỏ bớt ngày đóng cửa.');
        return null;
    }
    numDays = availableDates.length; // số ngày thực tế có doanh thu

    // ---- Xác định số lượng giao dịch N sao cho khả thi ----
    // Điều kiện: N*min <= total <= N*max  =>  ceil(total/max) <= N <= floor(total/min)
    const Nmin = Math.ceil(total / max);   // số giao dịch tối thiểu cần để chứa total
    const Nmax = Math.floor(total / min);  // số giao dịch tối đa có thể (mỗi giao dịch >= min)
    const maxTxInPeriod = numDays * maxPerDay; // số giao dịch tối đa trong kỳ

    if (Nmin > Nmax) {
        alert('Không thể phân bổ tổng số tiền mặt với khoảng tiền hiện tại (min-max). Vui lòng điều chỉnh khoảng tiền.');
        return null;
    }
    if (Nmin > maxTxInPeriod) {
        alert('Tổng số tiền mặt quá lớn so với số giao dịch tối đa trong kỳ (' + maxTxInPeriod + ' giao dịch). Vui lòng tăng số giao dịch/ngày hoặc tăng khoảng tiền tối đa.');
        return null;
    }

    // Chọn ngẫu nhiên số giao dịch N trong [Nmin, min(Nmax, maxTxInPeriod)]
    const N = Nmin + Math.floor(Math.random() * (Math.min(Nmax, maxTxInPeriod) - Nmin + 1));

    // ---- Xác định số ngày sử dụng (numDaysUsed) ----
    // Cần: numDaysUsed <= N (mỗi ngày ít nhất 1 giao dịch)
    // và:  N <= numDaysUsed * maxPerDay  =>  numDaysUsed >= ceil(N / maxPerDay)
    const minDays = Math.ceil(N / maxPerDay);
    const maxDays = Math.min(numDays, N);
    const numDaysUsed = minDays + Math.floor(Math.random() * (maxDays - minDays + 1));

    // ---- Phân bổ N giao dịch vào numDaysUsed ngày, mỗi ngày 1..maxPerDay ----
    let perDay = new Array(numDaysUsed).fill(1); // mỗi ngày ít nhất 1
    let extra = N - numDaysUsed;                 // số giao dịch thêm cần phân bổ
    let guard = 0;
    while (extra > 0 && guard < 1000000) {
        guard++;
        const d = Math.floor(Math.random() * numDaysUsed);
        if (perDay[d] < maxPerDay) {
            perDay[d]++;
            extra--;
        }
    }

    // Xây danh sách giao dịch: { dayIndex, amount }
    let txList = [];
    for (let d = 0; d < numDaysUsed; d++) {
        for (let k = 0; k < perDay[d]; k++) {
            txList.push({ dayIndex: d, amount: 0 });
        }
    }

    // ---- Phân bổ tổng tiền vào N giao dịch, mỗi giao dịch trong [min, max] ----
    // Phương pháp: mỗi giao dịch nhận tối thiểu `min`, phần còn lại phân bổ
    // thành các bước `round`, mỗi giao dịch tối đa thêm (max - min).
    const baseTotal = N * min;
    const remaining = total - baseTotal;      // phần còn lại cần phân bổ thêm
    const cap = max - min;                    // mức tối đa thêm mỗi giao dịch
    const capSteps = Math.floor(cap / round); // số bước tối đa mỗi giao dịch

    // Số bước cần phân bổ và phần dư
    const numSteps = Math.floor(remaining / round);
    const remainder = remaining % round;

    // Phân bổ numSteps bước vào N giao dịch, mỗi giao dịch tối đa capSteps bước
    let steps = new Array(N).fill(0);
    // Phân bổ ngẫu nhiên: mỗi giao dịch nhận ngẫu nhiên 0..capSteps, rồi điều chỉnh
    for (let i = 0; i < N; i++) {
        steps[i] = Math.floor(Math.random() * (capSteps + 1));
    }
    let sumSteps = steps.reduce((a, b) => a + b, 0);
    let diffSteps = numSteps - sumSteps;
    guard = 0;
    while (diffSteps !== 0 && guard < 1000000) {
        guard++;
        const idx = Math.floor(Math.random() * N);
        if (diffSteps > 0 && steps[idx] < capSteps) {
            steps[idx]++;
            diffSteps--;
        } else if (diffSteps < 0 && steps[idx] > 0) {
            steps[idx]--;
            diffSteps++;
        }
    }
    // Nếu vẫn còn chênh lệch (hiếm khi xảy ra), cộng vào giao dịch đầu tiên
    if (diffSteps !== 0) {
        steps[0] += diffSteps;
    }

    // Phân bổ phần dư (remainder) cho các giao dịch còn chỗ, tránh vượt max
    let extras = new Array(N).fill(0);
    if (remainder > 0) {
        let placed = false;
        for (let i = 0; i < N; i++) {
            if (steps[i] < capSteps) {
                extras[i] = remainder; // giao dịch này còn chỗ nhận tối đa round-1
                placed = true;
                break;
            }
        }
        if (!placed) {
            // Tất cả đều ở mức tối đa: remainder = N*maxExtra, chia đều
            const maxExtra = (max - min) % round;
            for (let i = 0; i < N; i++) {
                extras[i] = maxExtra;
            }
        }
    }

    // Gán số tiền cho từng giao dịch
    for (let i = 0; i < N; i++) {
        txList[i].amount = min + steps[i] * round + extras[i];
    }

    // ---- Sắp xếp giao dịch theo ngày và tạo dòng sổ ----
    // Sắp xếp theo dayIndex để các giao dịch cùng ngày liền nhau
    txList.sort((a, b) => a.dayIndex - b.dayIndex);

    const rows = [];
    let stt = startStt;
    for (const tx of txList) {
        // Lấy ngày thực tế từ danh sách ngày có doanh thu (đã loại ngày đóng cửa)
        const d = availableDates[tx.dayIndex];
        const ngay = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        rows.push({
            soHieu: soHieu,
            hoaDon: stt,
            ngay: ngay,
            dienGiai: `Doanh thu bán hàng theo số hóa đơn ${stt}`,
            soTien: tx.amount
        });
        stt++;
    }

    // Kiểm tra tổng
    const finalSum = rows.reduce((a, r) => a + r.soTien, 0);
    const offCount = numDays - availableDates.length;
    cashInfo.textContent = `✅ Đã tạo ${rows.length} giao dịch tiền mặt (phân bổ đều trong ${period === 'month' ? 'tháng' : 'quý'} trên ${availableDates.length} ngày có doanh thu${offCount > 0 ? `, đã loại ${offCount} ngày đóng cửa` : ''}, mỗi ngày 1-${maxPerDay} giao dịch). Tổng: ${formatMoney(finalSum)} VNĐ (đúng bằng số đã nhập).`;
    cashInfo.classList.remove('hidden');

    return rows;
}

// Chuyển đổi giá trị thành số
function parseAmount(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return val;
    let s = String(val).replace(/[^\d.-]/g, '');
    if (s === '' || s === '-' || s === '.') return 0;
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

// Định dạng ngày
function formatDate(val) {
    if (val === null || val === undefined || val === '') return '';
    // Nếu là số (Excel date serial)
    if (typeof val === 'number') {
        const d = XLSX.SSF.parse_date_code(val);
        if (d) {
            return `${String(d.d).padStart(2, '0')}/${String(d.m).padStart(2, '0')}/${d.y}`;
        }
    }
    let s = String(val).trim();
    // Ưu tiên định dạng ISO: YYYY-MM-DD hoặc YYYY/MM/DD
    const isoMatch = s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
    if (isoMatch) {
        return `${isoMatch[3].padStart(2, '0')}/${isoMatch[2].padStart(2, '0')}/${isoMatch[1]}`;
    }
    // Định dạng DD/MM/YYYY hoặc DD-MM-YYYY
    const match = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (match) {
        return `${match[1].padStart(2, '0')}/${match[2].padStart(2, '0')}/${match[3]}`;
    }
    return s;
}

// Làm sạch nội dung diễn giải: trích xuất phần mô tả chính, bỏ các mã kỹ thuật dài
function cleanContent(val) {
    if (val === null || val === undefined) return '';
    let s = String(val).trim();
    if (!s) return '';

    // Bỏ các chuỗi mã kỹ thuật dài (chứa nhiều dấu chấm liên tiếp, số dài)
    // Ví dụ: "MBVCB.13599430566.NGUYEN THI PHAN chuyen tien.CT tu 1018244040..."
    // -> "NGUYEN THI PHAN chuyen tien"

    // Tìm phần "TÊN chuyen tien" hoặc "TÊN chuyen khoan"
    const chuyenTienMatch = s.match(/([A-ZÀ-Ỹ][A-ZÀ-Ỹ ]{2,})\s+chuyen\s+(?:tien|khoan)/i);
    if (chuyenTienMatch) {
        return chuyenTienMatch[0].trim();
    }

    // Nếu có "QR" thì lấy phần trước dấu chấm đầu tiên sau QR
    if (/QR/i.test(s)) {
        const qrIdx = s.search(/QR/i);
        const before = s.slice(0, qrIdx).trim();
        if (before) return before;
    }

    // Cắt bỏ phần mã kỹ thuật bắt đầu bằng #SP# hoặc #CT#
    const hashIdx = s.search(/#(?:SP|CT|MB|QR)/i);
    if (hashIdx > 0) {
        s = s.slice(0, hashIdx).trim();
    }

    // Nếu quá dài, cắt bớt
    if (s.length > 100) {
        return s.slice(0, 100) + '...';
    }
    return s;
}

// Định dạng số tiền
function formatMoney(n) {
    return n.toLocaleString('vi-VN');
}

// Hiển thị bảng xem trước
function renderPreview() {
    previewBody.innerHTML = '';
    resultRows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.soHieu}</td>
            <td>${r.hoaDon}</td>
            <td>${r.ngay}</td>
            <td>${r.dienGiai}</td>
            <td>${formatMoney(r.soTien)}</td>
        `;
        previewBody.appendChild(tr);
    });
    previewSection.classList.remove('hidden');
}

// Hiển thị tổng kết
function showSummary() {
    const total = resultRows.reduce((sum, r) => sum + r.soTien, 0);
    if (gtgtInvoices.length) {
        resultSummary.innerHTML = `
            ✅ Đã tạo <strong>${resultRows.length}</strong> dòng doanh thu từ bảng kê GTGT (mỗi hóa đơn một dòng, gán đúng số hóa đơn thật).<br>
            💰 Tổng doanh thu: <strong>${formatMoney(total)} VNĐ</strong><br>
            🧾 Số hóa đơn từ bảng kê GTGT: <strong>${gtgtInvoices.length}</strong>
        `;
    } else {
        resultSummary.innerHTML = `
            ✅ Đã tạo <strong>${resultRows.length}</strong> dòng doanh thu từ sao kê ngân hàng.<br>
            💰 Tổng doanh thu: <strong>${formatMoney(total)} VNĐ</strong>
        `;
    }
    resultSummary.classList.remove('hidden');
}

// ---------- Xuất file Excel ----------
btnExport.addEventListener('click', () => {
    if (!resultRows.length) {
        alert('Không có dữ liệu để xuất.');
        return;
    }

    const tenHKD = document.getElementById('tenHKD').value.trim() || 'HỘ KINH DOANH';
    const maSoThue = document.getElementById('maSoThue').value.trim();
    const diaChi = document.getElementById('diaChi').value.trim();
    const kyKeKhai = document.getElementById('kyKeKhai').value.trim();

    // Tạo dữ liệu Excel theo mẫu S2a-HKD
    const aoa = [];
    aoa.push(['HỘ KINH DOANH: ' + tenHKD]);
    aoa.push(['Mã số thuế: ' + maSoThue]);
    aoa.push(['Địa chỉ: ' + diaChi]);
    aoa.push(['Kỳ kê khai: ' + kyKeKhai]);
    aoa.push(['SỔ DOANH THU BÁN HÀNG HÓA, DỊCH VỤ']);
    aoa.push(['Đơn vị tính: VNĐ']);
    aoa.push([]);
    aoa.push(['Số hiệu', 'Hóa đơn', 'Ngày, tháng', 'Diễn giải', 'Số tiền']);

    resultRows.forEach(r => {
        aoa.push([r.soHieu, r.hoaDon, r.ngay, r.dienGiai, r.soTien]);
    });

    // Dòng tổng
    const total = resultRows.reduce((sum, r) => sum + r.soTien, 0);
    aoa.push([]);
    aoa.push(['TỔNG', '', '', '', total]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Đặt độ rộng cột
    ws['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 50 }, { wch: 15 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sổ doanh thu');

    const fileName = `So_Doanh_Thu_${tenHKD.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
});

