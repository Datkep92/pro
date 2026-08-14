/**
 * excel.js - Các hàm xử lý file Excel bằng SheetJS
 */

/**
 * Đọc file Excel và trả về mảng 2 chiều (rows x cols) của sheet đầu tiên
 * @param {File} file - File Excel cần đọc
 * @returns {Promise<Array<Array>>} Mảng 2 chiều dữ liệu
 */
async function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[firstSheetName];
                // Chuyển sheet thành mảng 2 chiều (header:1 để lấy cả dòng đầu)
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                resolve(rows);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = function (err) {
            reject(err);
        };
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Chuyển đổi giá trị ô Excel thành số, xử lý dấu phẩy phân cách hàng nghìn
 * Ví dụ: "46,297" -> 46297, "1,000,000" -> 1000000
 * @param {any} value - Giá trị cần chuyển
 * @returns {number} Giá trị số
 */
function parseNumber(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    // Xử lý chuỗi có dấu phẩy phân cách hàng nghìn
    let str = String(value).trim();
    // Loại bỏ dấu chấm phân cách hàng nghìn (nếu có) - tùy định dạng
    // Ưu tiên: nếu có cả dấu phẩy và dấu chấm, dấu phẩy là phân cách hàng nghìn
    if (str.includes(',') && str.includes('.')) {
        // Dạng "1,000,000.00" hoặc "1.000.000,00"
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
            // Dạng "1.000.000,00" - dấu phẩy là thập phân
            str = str.replace(/\./g, '').replace(',', '.');
        } else {
            // Dạng "1,000,000.00" - dấu phẩy là hàng nghìn
            str = str.replace(/,/g, '');
        }
    } else if (str.includes(',')) {
        // Chỉ có dấu phẩy - coi là phân cách hàng nghìn (dữ liệu VN)
        str = str.replace(/,/g, '');
    }
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

/**
 * Chuyển đổi chuỗi thuế suất "10%" hoặc "8%" thành số 10, 8
 * @param {any} value - Giá trị thuế suất
 * @returns {number} Thuế suất dạng số
 */
function parseTaxRate(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    let str = String(value).trim().replace('%', '').replace('%', '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

/**
 * Định dạng số thành chuỗi có dấu phẩy phân cách hàng nghìn (kiểu VN)
 * @param {number} num - Số cần định dạng
 * @returns {string} Chuỗi đã định dạng
 */
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '';
    return num.toLocaleString('vi-VN');
}

/**
 * Tạo file Excel mới từ mảng 2 chiều và tải xuống
 * @param {Array<Array>} data - Mảng 2 chiều dữ liệu
 * @param {string} filename - Tên file xuất ra
 */
function downloadExcel(data, filename) {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Hóa đơn GTGT');
    XLSX.writeFile(wb, filename);
}
