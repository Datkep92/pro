// ============================================================
// Utility functions
// ============================================================

// Loại bỏ dấu tiếng Việt để chuẩn hóa tên
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

// Chuyển serial Excel date → yyyy-MM-dd
function serialToDate(serial) {
    if (!serial || isNaN(serial)) return '';
    const d = new Date((serial - 25569) * 86400 * 1000);
    return d.toISOString().split('T')[0]; // yyyy-MM-dd
}

// Chuẩn hóa string: trim, uppercase, collapse spaces
function normalizeStr(s) {
    if (!s) return '';
    return String(s).trim().toUpperCase().replace(/\s+/g, ' ');
}

// Chuẩn hóa tên: loại bỏ dấu, trim, uppercase, collapse spaces
function normalizeTen(s) {
    if (!s) return '';
    return removeAccents(normalizeStr(s));
}

// Parse số từ Excel, xử lý format tiền Việt Nam
function parseNumber(v) {
    if (v === undefined || v === null || v === '') return 0;
    if (typeof v === 'number') return v; // Excel đã trả về số, giữ nguyên
    // Nếu là string, chuẩn hóa: loại bỏ dấu phân cách nghìn, giữ dấu thập phân
    let s = String(v).trim();
    // Xác định dấu thập phân: nếu có cả . và , thì dấu cuối cùng là thập phân
    let lastDot = s.lastIndexOf('.');
    let lastComma = s.lastIndexOf(',');
    if (lastDot > lastComma && lastDot > 0) {
        // Dấu . là thập phân (vd: 1,200,000.50)
        s = s.replace(/,/g, ''); // loại bỏ dấu , (phân cách nghìn)
    } else if (lastComma > lastDot && lastComma > 0) {
        // Dấu , là thập phân (vd: 1.200.000,50)
        s = s.replace(/\./g, '').replace(',', '.'); // loại . và thay , bằng .
    } else {
        // Chỉ có 1 loại dấu hoặc không có
        s = s.replace(/[,.]/g, '');
    }
    // Loại bỏ ký tự không phải số, dấu -, dấu .
    s = s.replace(/[^0-9.\-]/g, '');
    return parseFloat(s) || 0;
}

// Chuẩn hóa số hóa đơn: loại bỏ số 0 ở đầu, trim
function normalizeSoHD(soHD) {
    if (!soHD) return '';
    let s = String(soHD).trim();
    // Loại bỏ số 0 ở đầu
    s = s.replace(/^0+/, '');
    return s || '0'; // nếu toàn số 0 thì giữ 1 số 0
}

// Tạo key để so sánh (số HĐ + ngày)
function makeKey(soHD, ngay) {
    return soHD + '|' + ngay;
}

// Đọc file Excel
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array', cellDates: false });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Format số theo locale vi-VN
function formatMoney(amount) {
    if (amount === undefined || amount === null) return '0';
    return Number(amount).toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
