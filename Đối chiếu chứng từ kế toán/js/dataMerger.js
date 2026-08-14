// ============================================================
// Gộp dữ liệu từ nhiều file Excel cùng loại
// ============================================================

/**
 * Trích xuất thông tin tháng/năm từ tên file
 * @param {string} fileName - Tên file
 * @returns {{ month: number|null, year: number|null, label: string }}
 */
function extractFileInfo(fileName) {
    const name = fileName.replace(/\.xlsx?$/i, '');
    let month = null;
    let year = null;

    // Pattern: T1, T2, T3, ... T12 hoặc thang 1, thang 2, ...
    const monthPatterns = [
        /[Tt](\d{1,2})(?:\s|\.|_|-|$)/,           // T1, T2, T12
        /thang\s*(\d{1,2})/i,                       // thang 1, thang 2
        /tháng\s*(\d{1,2})/i,                       // tháng 1, tháng 2
        /[_-](\d{1,2})[_-](?:202\d|20\d{2})/,       // _1_2026
        /(?:202\d|20\d{2})[_-](\d{1,2})/            // 2026_1
    ];

    for (const pattern of monthPatterns) {
        const match = name.match(pattern);
        if (match) {
            const m = parseInt(match[1]);
            if (m >= 1 && m <= 12) {
                month = m;
                break;
            }
        }
    }

    // Pattern năm: 2024, 2025, 2026...
    const yearPatterns = [
        /(202\d|20\d{2})/
    ];

    for (const pattern of yearPatterns) {
        const match = name.match(pattern);
        if (match) {
            const y = parseInt(match[1]);
            if (y >= 2020 && y <= 2099) {
                year = y;
                break;
            }
        }
    }

    // Tạo label hiển thị
    let label = fileName;
    if (month && year) {
        label = `T${month}/${year}`;
    } else if (month) {
        label = `Tháng ${month}`;
    } else if (year) {
        label = `Năm ${year}`;
    }

    return { month, year, label };
}

/**
 * Gộp dữ liệu từ nhiều file cùng loại
 * @param {Array<{fileName: string, rows: Array}>} filesData - Mảng các file data
 * @returns {{ rows: Array, sourceInfo: Array<{fileName, label, month, year, rowCount}> }}
 */
function mergeFiles(filesData) {
    if (!filesData || filesData.length === 0) {
        return { rows: [], sourceInfo: [] };
    }

    const allRows = [];
    const sourceInfo = [];

    for (const file of filesData) {
        const info = extractFileInfo(file.fileName);
        const dataRows = file.rows || [];

        // Thêm thông tin nguồn
        sourceInfo.push({
            fileName: file.fileName,
            label: info.label,
            month: info.month,
            year: info.year,
            rowCount: dataRows.length
        });

        // Gộp rows (giữ nguyên header row từ file đầu tiên)
        if (allRows.length === 0) {
            allRows.push(...dataRows);
        } else {
            // Bỏ qua header row của các file sau (dòng đầu tiên)
            allRows.push(...dataRows.slice(1));
        }
    }

    return { rows: allRows, sourceInfo };
}

/**
 * Tạo chuỗi hiển thị nguồn dữ liệu
 * @param {Array} sourceInfo - Thông tin các file đã gộp
 * @returns {string}
 */
function formatSourceInfo(sourceInfo) {
    if (!sourceInfo || sourceInfo.length === 0) return '';

    const labels = sourceInfo.map(s => s.label);
    // Loại bỏ trùng lặp
    const uniqueLabels = [...new Set(labels)];

    if (uniqueLabels.length === 1) {
        return `📁 ${uniqueLabels[0]}`;
    }

    // Sắp xếp theo tháng
    const sorted = sourceInfo
        .filter(s => s.month !== null)
        .sort((a, b) => (a.year || 0) - (b.year || 0) || (a.month || 0) - (b.month || 0));

    if (sorted.length > 0) {
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        if (first.month && last.month && first.year === last.year) {
            return `📅 T${first.month}/${first.year} - T${last.month}/${last.year}`;
        }
        return `📅 ${first.label} - ${last.label}`;
    }

    return `📁 ${uniqueLabels.join(', ')}`;
}
