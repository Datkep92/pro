// ============================================================
// So sánh bảng kê và hóa đơn
// ============================================================

/**
 * So sánh bằng số hóa đơn + ngày (khóa chính)
 * @param {Array} bangKeItems - Items từ groupBangKe (có số HĐ)
 * @param {Array} hoaDonItems - Items từ parseHoaDon
 * @returns {Array} - Kết quả so sánh
 */
function compareLists(bangKeItems, hoaDonItems) {
    const results = [];
    const bkMap = {}; // key: soHD|ngay -> [items] (mảng để phát hiện TRÙNG)
    const usedBK = new Set(); // Theo dõi BK đã được match

    // Xây dựng bkMap: mỗi key có thể có nhiều BK items (phát hiện TRÙNG)
    for (const item of bangKeItems) {
        const key = makeKey(item.soHD, item.ngay);
        if (!bkMap[key]) {
            bkMap[key] = [];
        }
        bkMap[key].push(item);
    }

    // Duyệt theo hóa đơn (làm chuẩn)
    for (const hd of hoaDonItems) {
        const key = makeKey(hd.soHD, hd.ngay);
        const bkList = bkMap[key];

        if (bkList && bkList.length > 0) {
            // Lấy BK đầu tiên để so sánh
            const bk = bkList[0];
            usedBK.add(key + '|0');

            // Nếu có nhiều hơn 1 BK cho cùng key => TRÙNG
            if (bkList.length > 1) {
                // Đánh dấu tất cả BK trùng đã được xử lý
                for (let k = 1; k < bkList.length; k++) {
                    usedBK.add(key + '|' + k);
                }
            }

            const diff = bk.tongTien - hd.tienChuaThue;
            const isMatch = Math.abs(diff) < 1;
            const thueDiff = (bk.tongThue || 0) - (hd.tienThue || 0);
            const resultItem = {
                soHD: hd.soHD,
                ngay: hd.ngay,
                ten: hd.ten,
                bangKeTien: bk.tongTien,
                hoaDonTien: hd.tienChuaThue,
                bangKeThue: bk.tongThue,
                hoaDonThue: hd.tienThue || 0,
                chenhLech: Math.round(diff * 100) / 100,
                chenhLechThue: Math.round(thueDiff * 100) / 100,
                status: isMatch ? 'KHỚP' : 'LỆCH',
                type: 'both',
                hdType: hd.hdType || ''
            };

            // Nếu có TRÙNG, thêm thông tin
            if (bkList.length > 1) {
                resultItem.duplicate = true;
                resultItem.duplicateCount = bkList.length;
                resultItem.duplicateInfo = `BK có ${bkList.length} dòng trùng (số HĐ ${bk.soHD}, ngày ${bk.ngay})`;
            }

            results.push(resultItem);
        } else {
            results.push({
                soHD: hd.soHD,
                ngay: hd.ngay,
                ten: hd.ten,
                bangKeTien: 0,
                hoaDonTien: hd.tienChuaThue,
                bangKeThue: 0,
                hoaDonThue: hd.tienThue || 0,
                chenhLech: -Math.round(hd.tienChuaThue),
                chenhLechThue: -(hd.tienThue || 0),
                status: 'THIẾU BẢNG KÊ',
                type: 'missing-bk',
                hdType: hd.hdType || ''
            });
        }
    }

    // BK có số HĐ nhưng không tìm thấy trong hóa đơn → THIẾU HĐ
    for (const item of bangKeItems) {
        const key = makeKey(item.soHD, item.ngay);
        const bkList = bkMap[key];
        let allUsed = true;
        if (bkList) {
            for (let k = 0; k < bkList.length; k++) {
                if (!usedBK.has(key + '|' + k)) {
                    allUsed = false;
                    break;
                }
            }
        }
        if (!allUsed) {
            // Có BK chưa được dùng
            for (let k = 0; k < (bkList || []).length; k++) {
                if (usedBK.has(key + '|' + k)) continue;
                const bkItem = bkList[k];
                usedBK.add(key + '|' + k);
                results.push({
                    soHD: bkItem.soHD,
                    ngay: bkItem.ngay,
                    ten: bkItem.ten,
                    bangKeTien: bkItem.tongTien,
                    hoaDonTien: 0,
                    bangKeThue: bkItem.tongThue,
                    hoaDonThue: 0,
                    chenhLech: Math.round(bkItem.tongTien),
                    chenhLechThue: bkItem.tongThue || 0,
                    status: 'THIẾU HĐ',
                    type: 'missing-hd',
                    hdType: ''
                });
            }
        }
    }

    // Sắp xếp: LỆCH lên đầu, THIẾU HĐ thứ 2, THIẾU BẢNG KÊ thứ 3, KHỚP cuối cùng
    const order = { 'LỆCH': 0, 'THIẾU HĐ': 1, 'THIẾU BẢNG KÊ': 2, 'KHỚP': 3 };
    results.sort((a, b) => (order[a.status] || 9) - (order[b.status] || 9));

    return results;
}

/**
 * Gộp các hóa đơn trùng (ngày + tên) để so sánh với bảng kê
 * Bảng kê thường gộp nhiều hóa đơn cùng ngày + cùng khách hàng thành 1 dòng
 * @param {Array} hoaDonItems - Items từ parseHoaDon
 * @returns {Array} - Items đã gộp, mỗi item có thêm danh sách số HĐ gốc
 */
function groupHoaDonByDateAndName(hoaDonItems) {
    const groups = {}; // key: ngay|tenNorm -> { items, soHDs, tongTien, tongThue, hdTypes }

    for (const hd of hoaDonItems) {
        const key = hd.ngay + '|' + hd.tenNorm;
        if (!groups[key]) {
            groups[key] = {
                items: [],
                soHDs: [],
                tongTien: 0,
                tongThue: 0,
                hdTypes: new Set()
            };
        }
        groups[key].items.push(hd);
        groups[key].soHDs.push(hd.soHD);
        groups[key].tongTien += hd.tienChuaThue;
        groups[key].tongThue += hd.tienThue || 0;
        if (hd.hdType) groups[key].hdTypes.add(hd.hdType);
    }

    return Object.values(groups).map(g => ({
        soHD: g.soHDs.join(', '),
        ngay: g.items[0].ngay,
        ten: g.items[0].ten,
        tenNorm: g.items[0].tenNorm,
        tienChuaThue: g.tongTien,
        tienThue: g.tongThue,
        hdType: [...g.hdTypes].join(' + '),
        items: g.items
    }));
}

/**
 * So sánh không có số hóa đơn (dùng ngày + tên + tiền)
 * @param {Array} bangKeItems - Items từ groupBangKe (không số HĐ)
 * @param {Array} hoaDonItems - Items từ parseHoaDon
 * @returns {{ results: Array, matchedBKIndices: Set }} - Kết quả so sánh và indices BK đã match
 */
function compareByDetails(bangKeItems, hoaDonItems) {
    const results = [];
    const usedBK = new Set();
    const usedHD = new Set();

    // Gộp hóa đơn trùng (ngày + tên) trước khi so sánh
    // Vì bảng kê thường gộp nhiều hóa đơn cùng ngày + cùng khách thành 1 dòng
    const groupedHD = groupHoaDonByDateAndName(hoaDonItems);

    // Duyệt theo nhóm hóa đơn đã gộp, tìm cặp khớp bằng ngày + tên + tiền
    for (let j = 0; j < groupedHD.length; j++) {
        const hdGroup = groupedHD[j];
        let bestMatch = null;
        let bestDiff = Infinity;
        let matchType = 'exact'; // 'exact' | 'partial'

        // === Bước 1: Tìm match chính xác (cùng ngày + cùng tên + cùng tiền) ===
        for (let i = 0; i < bangKeItems.length; i++) {
            if (usedBK.has(i)) continue;
            const bk = bangKeItems[i];

            // So ngày
            if (bk.ngay !== hdGroup.ngay) continue;
            // So tên (dùng tenNorm - đã loại bỏ dấu để so sánh chính xác)
            if (bk.tenNorm !== hdGroup.tenNorm) continue;

            // Bảng kê lưu số nguyên, hóa đơn lưu số thập phân
            // Chấp nhận sai số < 1 đồng do làm tròn
            const diff = Math.abs(bk.tongTien - hdGroup.tienChuaThue);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestMatch = i;
                matchType = 'exact';
            }
        }

        // === Bước 2: Nếu không tìm thấy match chính xác, thử match 1 phần tên ===
        // Trường hợp: HD ghi "HỘ KINH DOANH DŨNG" còn BK ghi "NGUYỄN THANH DŨNG"
        // => cùng ngày + cùng tiền + chung từ cuối (tên riêng) hoặc chung 1 từ bất kỳ
        if (bestMatch === null) {
            for (let i = 0; i < bangKeItems.length; i++) {
                if (usedBK.has(i)) continue;
                const bk = bangKeItems[i];

                // So ngày
                if (bk.ngay !== hdGroup.ngay) continue;

                // Kiểm tra chung từ: tách thành các từ riêng lẻ, kiểm tra có từ nào chung không
                const tenHD = hdGroup.tenNorm;
                const tenBK = bk.tenNorm;
                const wordsHD = tenHD.split(/\s+/).filter(w => w.length > 0);
                const wordsBK = tenBK.split(/\s+/).filter(w => w.length > 0);
                
                // Lấy từ cuối cùng (tên riêng - quan trọng nhất)
                const lastWordHD = wordsHD[wordsHD.length - 1] || '';
                const lastWordBK = wordsBK[wordsBK.length - 1] || '';
                
                // Kiểm tra: chung từ cuối (tên) HOẶC chung ít nhất 1 từ bất kỳ
                const sameLastWord = lastWordHD === lastWordBK && lastWordHD.length > 0;
                const hasCommonWord = wordsHD.some(w => wordsBK.includes(w));
                
                if (!sameLastWord && !hasCommonWord) continue;

                // So tiền - chấp nhận sai số < 1 đồng
                const diff = Math.abs(bk.tongTien - hdGroup.tienChuaThue);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestMatch = i;
                    matchType = 'partial';
                }
            }
        }

        if (bestMatch !== null) {
            usedBK.add(bestMatch);
            // Đánh dấu tất cả HD gốc trong nhóm đã được xử lý
            for (const item of hdGroup.items) {
                const idx = hoaDonItems.indexOf(item);
                if (idx >= 0) usedHD.add(idx);
            }
            const bk = bangKeItems[bestMatch];
            const diff = bk.tongTien - hdGroup.tienChuaThue;
            const isMatch = Math.abs(diff) < 1;

            // So sánh thêm tiền thuế
            const thueDiff = Math.abs((bk.tongThue || 0) - (hdGroup.tienThue || 0));
            const thueMatch = thueDiff < 1;

            const chenhLechThueVal = Math.round(((bk.tongThue || 0) - (hdGroup.tienThue || 0)) * 100) / 100;
            results.push({
                soHD: hdGroup.soHD + ' / ' + bk.soHD,
                ngay: hdGroup.ngay,
                ten: hdGroup.ten,
                bangKeTien: bk.tongTien,
                hoaDonTien: hdGroup.tienChuaThue,
                bangKeThue: bk.tongThue || 0,
                hoaDonThue: hdGroup.tienThue || 0,
                chenhLech: Math.round(diff * 100) / 100,
                chenhLechThue: chenhLechThueVal,
                status: isMatch ? 'KHỚP (chi tiết)' : 'LỆCH (chi tiết)',
                type: isMatch ? 'match-detail' : 'mismatch-detail',
                hdType: hdGroup.hdType,
                thueMatch: thueMatch,
                thueChenhLech: chenhLechThueVal
            });
        }
    }

    // Các hóa đơn còn lại không tìm thấy trong bảng kê
    for (let j = 0; j < hoaDonItems.length; j++) {
        if (usedHD.has(j)) continue;
        const hd = hoaDonItems[j];
        results.push({
            soHD: hd.soHD,
            ngay: hd.ngay,
            ten: hd.ten,
            bangKeTien: 0,
            hoaDonTien: hd.tienChuaThue,
            bangKeThue: 0,
            hoaDonThue: hd.tienThue || 0,
            chenhLech: -Math.round(hd.tienChuaThue),
            chenhLechThue: -(hd.tienThue || 0),
            status: 'THIẾU BẢNG KÊ',
            type: 'missing-bk',
            hdType: hd.hdType || ''
        });
    }

    // KHÔNG báo THIẾU HĐ ở đây - để phase 3 trong processBanRa/processMuaVao xử lý
    // để tránh trùng lặp với phase 3

    // Sắp xếp: LỆCH lên đầu, THIẾU HĐ thứ 2, THIẾU BẢNG KÊ thứ 3, KHỚP cuối cùng
    const order = { 'LỆCH (chi tiết)': 0, 'THIẾU HĐ': 1, 'THIẾU BẢNG KÊ': 2, 'KHỚP (chi tiết)': 3 };
    results.sort((a, b) => (order[a.status] || 9) - (order[b.status] || 9));

    return { results, matchedBKIndices: usedBK };
}

/**
 * Xử lý chính cho Bán ra
 * @param {Array} bangKeRows - Rows bảng kê bán ra (đã gộp)
 * @param {Array} hdDaCapMaRows - Rows hóa đơn đã cấp mã (đã gộp)
 * @param {Array} hdMayTinhTienRows - Rows hóa đơn máy tính tiền (đã gộp)
 * @returns {{ results: Array, stats: Object, summary: Object }}
 */
function processBanRa(bangKeRows, hdDaCapMaRows, hdMayTinhTienRows) {
    // Parse bảng kê
    const bkItems = parseBangKe(bangKeRows, FILE_CONFIG.bangKeBanRa);
    const bkGrouped = groupBangKe(bkItems);

    // Parse hóa đơn - gắn nhãn loại hóa đơn
    const hdItems = [];
    let tongSoHDBiThayThe = 0;
    const biThayTheItems = []; // Danh sách hóa đơn bị thay thế (đã bỏ qua)
    const hdTypeCount = {}; // Đếm số lượng HD theo loại
    
    if (hdDaCapMaRows) {
        const result = parseHoaDon(hdDaCapMaRows, FILE_CONFIG.hdBanRaDaCapMa);
        result.items.forEach(i => i.hdType = 'Đã cấp mã');
        hdItems.push(...result.items);
        tongSoHDBiThayThe += result.skippedThayThe;
        biThayTheItems.push(...result.thayTheItems.map(i => ({ ...i, hdType: 'Đã cấp mã' })));
        hdTypeCount['Đã cấp mã'] = (hdTypeCount['Đã cấp mã'] || 0) + result.items.length;
    }
    if (hdMayTinhTienRows) {
        const result = parseHoaDon(hdMayTinhTienRows, FILE_CONFIG.hdBanRaMayTinhTien);
        result.items.forEach(i => i.hdType = 'Máy tính tiền');
        hdItems.push(...result.items);
        tongSoHDBiThayThe += result.skippedThayThe;
        biThayTheItems.push(...result.thayTheItems.map(i => ({ ...i, hdType: 'Máy tính tiền' })));
        hdTypeCount['Máy tính tiền'] = (hdTypeCount['Máy tính tiền'] || 0) + result.items.length;
    }

    // Phân loại bảng kê: có số HĐ và không có số HĐ
    const bkCoSoHD = bkGrouped.filter(i => i.hasSoHD);
    const bkKhongCoSoHD = bkGrouped.filter(i => !i.hasSoHD);

    let results = [];
    const usedHdKeys = new Set(); // Theo dõi HD đã được xử lý

    // === PHASE 1: So sánh bằng (số HĐ + ngày) cho các item CÓ số HĐ ===
    let bkCoSoHDChuaMatch = []; // BK có số HĐ nhưng không match với HD
    let hdNoMatch = []; // HD không match với BK

    if (bkCoSoHD.length > 0) {
        const bkKeySet = new Set(bkCoSoHD.map(i => makeKey(i.soHD, i.ngay)));
        const hdWithMatch = hdItems.filter(i => bkKeySet.has(makeKey(i.soHD, i.ngay)));
        hdNoMatch = hdItems.filter(i => !bkKeySet.has(makeKey(i.soHD, i.ngay)));
        const bkWithMatch = bkCoSoHD.filter(i => hdWithMatch.some(hd => makeKey(hd.soHD, hd.ngay) === makeKey(i.soHD, i.ngay)));
        bkCoSoHDChuaMatch = bkCoSoHD.filter(i => !hdWithMatch.some(hd => makeKey(hd.soHD, hd.ngay) === makeKey(i.soHD, i.ngay)));

        if (bkWithMatch.length > 0 || hdWithMatch.length > 0) {
            const phase1Results = compareLists(bkWithMatch, hdWithMatch);
            for (const r of phase1Results) {
                const hd = hdWithMatch.find(h => makeKey(h.soHD, h.ngay) === makeKey(r.soHD, r.ngay));
                if (hd) r.hdType = hd.hdType;
                usedHdKeys.add(makeKey(r.soHD, r.ngay));
            }
            results.push(...phase1Results);
        }
    }

    // === PHASE 2: So sánh bằng (ngày + tên + tiền) ===
    // Gộp BK không số HĐ + BK có số HĐ không match HD để so sánh chi tiết với HD còn lại
    const hdConLai = hdItems.filter(i => !usedHdKeys.has(makeKey(i.soHD, i.ngay)));
    const bkDetail = [...bkKhongCoSoHD, ...bkCoSoHDChuaMatch];

    // usedBKDetail: indices của BK items đã match trong phase 2
    // Dùng để phase 3 biết BK nào chưa match (báo cáo THIẾU HĐ)
    let usedBKDetail;

    if (bkDetail.length > 0 && hdConLai.length > 0) {
        const { results: detailResults, matchedBKIndices } = compareByDetails(bkDetail, hdConLai);
        for (const r of detailResults) {
            const hd = hdConLai.find(h => makeKey(h.soHD, h.ngay) === makeKey(r.soHD, r.ngay));
            if (hd) r.hdType = hd.hdType;
        }
        results.push(...detailResults);

        // Sử dụng matchedBKIndices trực tiếp từ compareByDetails (chính xác tuyệt đối)
        usedBKDetail = matchedBKIndices;
    } else {
        // Không có phase 2, tất cả BK detail đều chưa match
        usedBKDetail = new Set();
    }

    // === PHASE 3: Báo cáo BK dư (không match với bất kỳ HD nào) ===
    // BK có số HĐ không match → THIẾU HĐ
    // BK không số HĐ không match → THIẾU HĐ (vì HD là chuẩn, BK dư nghĩa là thiếu trong HD)
    for (let i = 0; i < bkDetail.length; i++) {
        if (usedBKDetail.has(i)) continue;
        const bk = bkDetail[i];
        results.push({
            soHD: bk.soHD || '—',
            ngay: bk.ngay,
            ten: bk.ten,
            bangKeTien: bk.tongTien,
            hoaDonTien: 0,
            bangKeThue: bk.tongThue || 0,
            hoaDonThue: 0,
            chenhLech: Math.round(bk.tongTien),
            chenhLechThue: bk.tongThue || 0,
            status: 'THIẾU HĐ',
            type: 'missing-hd',
            hdType: ''
        });
    }

    // Thống kê - đếm từ results thực tế
    const matchCount = results.filter(r => r.status === 'KHỚP' || r.status === 'KHỚP (chi tiết)').length;
    const mismatchCount = results.filter(r => r.status === 'LỆCH' || r.status === 'LỆCH (chi tiết)').length;
    const missingHDCount = results.filter(r => r.status === 'THIẾU HĐ').length;
    const missingBKCount = results.filter(r => r.status === 'THIẾU BẢNG KÊ').length;
    const duplicateCount = results.filter(r => r.duplicate).length;
    const mismatchThueCount = results.filter(r => Math.abs(r.chenhLechThue || 0) > 1).length;
    
    const stats = {
        total: matchCount + mismatchCount + missingHDCount + missingBKCount, // Tổng các danh mục
        match: matchCount,
        mismatch: mismatchCount,
        missingHD: missingHDCount,
        missingBK: missingBKCount,
        duplicate: duplicateCount,
        mismatchThue: mismatchThueCount
    };

    // Thông tin tổng quan
    const summary = {
        tongSoBK: bkGrouped.length,
        tongSoHD: hdItems.length,
        soHDBiThayThe: tongSoHDBiThayThe,
        biThayTheItems: biThayTheItems,
        hdTypeCount: hdTypeCount,
        bkGrouped: bkGrouped,     // Danh sách bảng kê đã gộp (để hiển thị)
        hdItems: hdItems          // Danh sách hóa đơn gốc (để hiển thị)
    };

    return { results, stats, summary };
}

/**
 * Xử lý chính cho Mua vào
 * @param {Array} bangKeRows - Rows bảng kê mua vào (đã gộp)
 * @param {Array} hdDaCapMaRows - Rows hóa đơn đã cấp mã (đã gộp)
 * @param {Array} hdKhongCapMaRows - Rows hóa đơn không cấp mã (đã gộp)
 * @param {Array} hdMayTinhTienRows - Rows hóa đơn máy tính tiền (đã gộp)
 * @returns {{ results: Array, stats: Object, summary: Object }}
 */
function processMuaVao(bangKeRows, hdDaCapMaRows, hdKhongCapMaRows, hdMayTinhTienRows) {
    const bkItems = parseBangKe(bangKeRows, FILE_CONFIG.bangKeMuaVao);
    const bkGrouped = groupBangKe(bkItems);

    // Parse hóa đơn - gắn nhãn loại hóa đơn
    const hdItems = [];
    let tongSoHDBiThayThe = 0;
    const biThayTheItems = []; // Danh sách hóa đơn bị thay thế (đã bỏ qua)
    const hdTypeCount = {}; // Đếm số lượng HD theo loại

    if (hdDaCapMaRows) {
        const result = parseHoaDon(hdDaCapMaRows, FILE_CONFIG.hdMuaVaoDaCapMa);
        result.items.forEach(i => i.hdType = 'Đã cấp mã');
        hdItems.push(...result.items);
        tongSoHDBiThayThe += result.skippedThayThe;
        biThayTheItems.push(...result.thayTheItems.map(i => ({ ...i, hdType: 'Đã cấp mã' })));
        hdTypeCount['Đã cấp mã'] = (hdTypeCount['Đã cấp mã'] || 0) + result.items.length;
    }
    if (hdKhongCapMaRows) {
        const result = parseHoaDon(hdKhongCapMaRows, FILE_CONFIG.hdMuaVaoKhongCapMa);
        result.items.forEach(i => i.hdType = 'Không cấp mã');
        hdItems.push(...result.items);
        tongSoHDBiThayThe += result.skippedThayThe;
        biThayTheItems.push(...result.thayTheItems.map(i => ({ ...i, hdType: 'Không cấp mã' })));
        hdTypeCount['Không cấp mã'] = (hdTypeCount['Không cấp mã'] || 0) + result.items.length;
    }
    if (hdMayTinhTienRows) {
        const result = parseHoaDon(hdMayTinhTienRows, FILE_CONFIG.hdMuaVaoMayTinhTien);
        result.items.forEach(i => i.hdType = 'Máy tính tiền');
        hdItems.push(...result.items);
        tongSoHDBiThayThe += result.skippedThayThe;
        biThayTheItems.push(...result.thayTheItems.map(i => ({ ...i, hdType: 'Máy tính tiền' })));
        hdTypeCount['Máy tính tiền'] = (hdTypeCount['Máy tính tiền'] || 0) + result.items.length;
    }

    // Phân loại bảng kê: có số HĐ và không có số HĐ
    const bkCoSoHD = bkGrouped.filter(i => i.hasSoHD);
    const bkKhongCoSoHD = bkGrouped.filter(i => !i.hasSoHD);

    let results = [];
    const usedHdKeys = new Set();

    // === PHASE 1: So sánh bằng (số HĐ + ngày) cho các item CÓ số HĐ ===
    let bkCoSoHDChuaMatch = [];
    let hdNoMatch = [];

    if (bkCoSoHD.length > 0) {
        const bkKeySet = new Set(bkCoSoHD.map(i => makeKey(i.soHD, i.ngay)));
        const hdWithMatch = hdItems.filter(i => bkKeySet.has(makeKey(i.soHD, i.ngay)));
        hdNoMatch = hdItems.filter(i => !bkKeySet.has(makeKey(i.soHD, i.ngay)));
        const bkWithMatch = bkCoSoHD.filter(i => hdWithMatch.some(hd => makeKey(hd.soHD, hd.ngay) === makeKey(i.soHD, i.ngay)));
        bkCoSoHDChuaMatch = bkCoSoHD.filter(i => !hdWithMatch.some(hd => makeKey(hd.soHD, hd.ngay) === makeKey(i.soHD, i.ngay)));

        if (bkWithMatch.length > 0 || hdWithMatch.length > 0) {
            const phase1Results = compareLists(bkWithMatch, hdWithMatch);
            for (const r of phase1Results) {
                const hd = hdWithMatch.find(h => makeKey(h.soHD, h.ngay) === makeKey(r.soHD, r.ngay));
                if (hd) r.hdType = hd.hdType;
                usedHdKeys.add(makeKey(r.soHD, r.ngay));
            }
            results.push(...phase1Results);
        }
    }

    // === PHASE 2: So sánh bằng (ngày + tên + tiền) ===
    const hdConLai = hdItems.filter(i => !usedHdKeys.has(makeKey(i.soHD, i.ngay)));
    const bkDetail = [...bkKhongCoSoHD, ...bkCoSoHDChuaMatch];

    // usedBKDetail: indices của BK items đã match trong phase 2
    // Dùng để phase 3 biết BK nào chưa match (báo cáo THIẾU HĐ)
    let usedBKDetail;

    if (bkDetail.length > 0 && hdConLai.length > 0) {
        const { results: detailResults, matchedBKIndices } = compareByDetails(bkDetail, hdConLai);
        for (const r of detailResults) {
            const hd = hdConLai.find(h => makeKey(h.soHD, h.ngay) === makeKey(r.soHD, r.ngay));
            if (hd) r.hdType = hd.hdType;
        }
        results.push(...detailResults);

        // Sử dụng matchedBKIndices trực tiếp từ compareByDetails (chính xác tuyệt đối)
        usedBKDetail = matchedBKIndices;
    } else {
        // Không có phase 2, tất cả BK detail đều chưa match
        usedBKDetail = new Set();
    }

    // === PHASE 3: Báo cáo BK dư (không match với bất kỳ HD nào) ===
    for (let i = 0; i < bkDetail.length; i++) {
        if (usedBKDetail.has(i)) continue;
        const bk = bkDetail[i];
        results.push({
            soHD: bk.soHD || '—',
            ngay: bk.ngay,
            ten: bk.ten,
            bangKeTien: bk.tongTien,
            hoaDonTien: 0,
            bangKeThue: bk.tongThue || 0,
            hoaDonThue: 0,
            chenhLech: Math.round(bk.tongTien),
            chenhLechThue: bk.tongThue || 0,
            status: 'THIẾU HĐ',
            type: 'missing-hd',
            hdType: ''
        });
    }

    const matchCount = results.filter(r => r.status === 'KHỚP' || r.status === 'KHỚP (chi tiết)').length;
    const mismatchCount = results.filter(r => r.status === 'LỆCH' || r.status === 'LỆCH (chi tiết)').length;
    const missingHDCount = results.filter(r => r.status === 'THIẾU HĐ').length;
    const missingBKCount = results.filter(r => r.status === 'THIẾU BẢNG KÊ').length;
    const duplicateCount = results.filter(r => r.duplicate).length;
    const mismatchThueCount = results.filter(r => Math.abs(r.chenhLechThue || 0) > 1).length;

    const stats = {
        total: matchCount + mismatchCount + missingHDCount + missingBKCount, // Tổng các danh mục
        match: matchCount,
        mismatch: mismatchCount,
        missingHD: missingHDCount,
        missingBK: missingBKCount,
        duplicate: duplicateCount,
        mismatchThue: mismatchThueCount
    };

    const summary = {
        tongSoBK: bkGrouped.length,
        tongSoHD: hdItems.length,
        soHDBiThayThe: tongSoHDBiThayThe,
        biThayTheItems: biThayTheItems,
        hdTypeCount: hdTypeCount,
        bkGrouped: bkGrouped,
        hdItems: hdItems
    };

    return { results, stats, summary };
}

// ============================================================
// End of comparator.js
// ============================================================
