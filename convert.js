// convert.js - 最終修正版 Node.js XML 轉換腳本 (V7.6 - 最終結構優化版)
const fs = require('fs');
const path = require('path');
// 需要確保您已安裝 xmldom: npm install xmldom
const { DOMParser } = require('xmldom');

// --- 1. 檔案配置 ---
const FILES_CM = [
    { url: 'icd10cm_index_2023.xml', isTable: false, isTabular: false, name: 'Index' },
    { url: 'icd10cm_neoplasm_2023.xml', isTable: true, isTabular: false, name: 'Neoplasm' },
    { url: 'icd10cm_drug_2023.xml', isTable: true, isTabular: false, name: 'Drug' },
    { url: 'icd10cm_eindex_2023.xml', isTable: false, isTabular: false, name: 'E-Index' },
    { url: 'icd10cm_tabular_2023.xml', isTable: false, isTabular: true, name: 'Tabular' } 
];

const FILES_PCS = [
    { url: 'icd10pcs_index_2023.xml', isTable: false, isTabular: false, name: 'PCS Index' },
];

// --- 2. 全局變量 ---
let cmIndexData = [];
let pcsIndexData = [];
let tabularData = {}; 
let indexType = 'cm'; // 當前處理的是 CM 還是 PCS 索引

// --- 3. 核心工具函式 ---

/**
 * 載入 XML 檔案內容 (V7.6 增強錯誤檢查)
 * @param {string} filename 
 * @returns {string | null}
 */
function loadXML(filename) {
    const filePath = path.join(__dirname, filename);
    if (fs.existsSync(filePath)) {
        try {
            return fs.readFileSync(filePath, 'utf8');
        } catch (e) {
            console.error(`❌ 錯誤：無法讀取檔案 (${filename})，請檢查權限或檔案是否損壞: ${e.message}`);
            throw new Error(`Critical Error reading ${filename}`); 
        }
    }
    console.log(`❌ 警告：檔案未找到或路徑錯誤，將跳過處理: ${filename}`);
    return null;
}

/**
 * 獲取 XML 元素中的所有子節點，過濾掉文本節點，只保留元素節點。
 * @param {Element} node 
 * @returns {Element[]}
 */
function getChildElements(node) {
    if (!node || !node.childNodes) return [];
    return Array.from(node.childNodes).filter(child => child.nodeType === 1);
}

/**
 * 提取表格（Neoplasm, Drug）中的特殊代碼（如 `cell` 標籤的內容）。
 */
function extractSpecialCodes(termNode) {
    const isTable = indexType === 'cm' && (termNode.ownerDocument.documentElement.getElementsByTagName('indexHeading').length > 0);
    if (!isTable) {
        return null;
    }

    const specialCodes = {};
    const cellNodes = getChildElements(termNode).filter(child => child.localName === 'cell');

    cellNodes.forEach(cell => {
        const col = cell.getAttribute('col');
        const code = cell.textContent.trim() === '--' ? '' : cell.textContent.trim();
        if (col) {
            specialCodes[`col${col}`] = code;
        }
    });

    return Object.keys(specialCodes).length > 0 ? specialCodes : null;
}

/**
 * 處理並格式化描述文本，將 title 和 nemod 組合起來。
 */
function formatDescription(titleNode) {
    let title = titleNode ? titleNode.textContent.replace(/\s+/g, ' ').trim() : null;
    let nemod = null;
    
    if (titleNode) {
        const nemodNode = titleNode.getElementsByTagName('nemod')[0];
        if (nemodNode) {
            let titleWithNemod = titleNode.textContent.replace(/\s+/g, ' ').trim(); 
            nemod = nemodNode.textContent.replace(/[\(\)]/g, '').trim(); 
            
            title = titleWithNemod.replace(nemodNode.textContent, '').trim();
            title = title.replace(/\s+/g, ' ').trim();
            if (title === '') title = null; 
        }
    }

    let description = title || '';
    if (nemod) {
        description += ` (${nemod})`;
    }
    
    if (!nemod && title && title.includes('(') && !title.includes(')')) {
        description += ')';
    }

    return description;
}


/**
 * 遞迴解析 ICD-10-CM 索引檔案 (Index/E-Index/Neoplasm/Drug) 中的主詞和子詞。
 * @param {Element} termNode - 當前處理的 <mainTerm> 或 <term> 節點。
 * @param {number} level - 階層深度 (mainTerm = 1, subTerm = 2, 以此類推)。
 * @param {string} parentDescription - 父節點的完整描述。
 * @param {string} source - 數據來源名稱。
 * @param {string} parentCode - 父節點繼承的代碼。
 */
function parseTerm(termNode, level, parentDescription, source, parentCode) {
    let titleNode = termNode.getElementsByTagName('title')[0];
    let codeNode = getChildElements(termNode).find(child => child.localName === 'code');
    
    // 1. 獲取當前詞彙的描述 (Title + Nemod)
    let termDescription = formatDescription(titleNode);
    
    // 2. 累加形成完整的描述
    let currentDescription = parentDescription;
    if (termDescription) {
        // 使用逗號加空格進行累加
        currentDescription += (currentDescription ? ', ' : '') + termDescription;
    }
    
    // 3. 獲取代碼 (如果自身沒有代碼，則繼承父代碼)
    let code = codeNode ? codeNode.textContent : parentCode;
    
    // 4. 處理 See/SeeAlso/Use (引導詞)
    let seeNode = getChildElements(termNode).find(child => child.localName === 'see');
    let seeText = seeNode ? seeNode.textContent.replace(/\s+/g, ' ').trim() : null;
    
    let seeAlsoNode = getChildElements(termNode).find(child => child.localName === 'seeAlso');
    let seeAlsoText = seeAlsoNode ? seeAlsoNode.textContent.replace(/\s+/g, ' ').trim() : null;
    
    let useNode = getChildElements(termNode).find(child => child.localName === 'use');
    let useText = useNode ? useNode.textContent.replace(/\s+/g, ' ').trim() : null;

    // 5. 處理結果項目（只有有代碼或引導詞的項目才加入）
    const specialCodes = extractSpecialCodes(termNode);
    const isTableItem = ['Neoplasm', 'Drug'].includes(source) && specialCodes !== null;

    // 只要有本地代碼、繼承代碼、引導詞或表格代碼，就將此項目儲存。
    if (code || seeText || seeAlsoText || useText || isTableItem) {
        const item = {
            description: currentDescription, // 完整的累加描述
            code: code || '', 
            level: level,
            index: indexType,
            source: source,
            see: seeText,
            seeAlso: seeAlsoText,
            use: useText,
            specialCodes: specialCodes
        };
        cmIndexData.push(item);
    }
    
    // 6. 處理子項 (遞迴)
    const childTerms = getChildElements(termNode).filter(child => child.localName === 'term');
    childTerms.forEach(childTerm => {
        // 傳遞當前 term 的完整描述作為子 term 的 parentDescription
        // 關鍵：傳遞當前 term 的 code 作為子 term 的 parentCode
        parseTerm(childTerm, level + 1, currentDescription, source, code);
    });
}

/**
 * 處理 ICD-10-CM 索引（Index, E-Index, Neoplasm, Drug）的 XML。
 * **V7.6 關鍵修正點：** 避免在非表格數據中儲存有子詞的 MainTerm，以減少冗餘。
 * @param {string} xmlContent 
 * @param {string} sourceName 
 * @param {boolean} isTable 
 */
function processCMIndexData(xmlContent, sourceName, isTable) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    const letterNodes = doc.getElementsByTagName('letter');
    
    console.log(`\n    --- 開始解析 ${sourceName} 數據 ---`);

    Array.from(letterNodes).forEach(letterNode => {
        const letterTitle = letterNode.getElementsByTagName('title')[0]?.textContent;
        // 打印進度指示
        process.stdout.write(letterTitle || '?.'); 

        const mainTermNodes = getChildElements(letterNode).filter(child => child.localName === 'mainTerm');

        mainTermNodes.forEach(mainTermNode => {
            
            // 處理 Level 1 主詞的代碼、描述和子詞
            let codeNode = getChildElements(mainTermNode).find(child => child.localName === 'code');
            let mainTermCode = codeNode ? codeNode.textContent : null;
            let titleNode = mainTermNode.getElementsByTagName('title')[0];
            let mainTermDescription = formatDescription(titleNode);
            const childTerms = getChildElements(mainTermNode).filter(child => child.localName === 'term');
            
            // 處理 Level 1 的引導詞
            const mainSeeNode = getChildElements(mainTermNode).find(child => child.localName === 'see');
            const mainSeeAlsoNode = getChildElements(mainTermNode).find(child => child.localName === 'seeAlso');
            const mainUseNode = getChildElements(mainTermNode).find(child => child.localName === 'use');
            
            const isCodableOrReferable = mainTermCode || mainSeeNode || mainSeeAlsoNode || mainUseNode;

            // --- Level 1 儲存邏輯 (V7.6) ---
            if (isTable) {
                // 1. 對於 Tabular (Neoplasm, Drug)，MainTerm 必須被儲存 (作為 Level 1)
                 const item = {
                    description: mainTermDescription,
                    code: mainTermCode || '', 
                    level: 1,
                    index: indexType,
                    source: sourceName,
                    see: mainSeeNode ? mainSeeNode.textContent.replace(/\s+/g, ' ').trim() : null,
                    seeAlso: mainSeeAlsoNode ? mainSeeAlsoNode.textContent.replace(/\s+/g, ' ').trim() : null,
                    use: mainUseNode ? mainUseNode.textContent.replace(/\s+/g, ' ').trim() : null,
                    specialCodes: extractSpecialCodes(mainTermNode)
                };
                cmIndexData.push(item);
                
                // Tabular 的子項從 Level 2 開始
                 childTerms.forEach(childTerm => {
                    parseTerm(childTerm, 2, mainTermDescription, sourceName, mainTermCode);
                });
                return;
            } 
            
            // 2. 對於 Index / E-Index (非表格)
            if (isCodableOrReferable && childTerms.length === 0) {
                // 只有在 MainTerm 是 codable/referable 且沒有子詞時才儲存 (作為 Level 1 最終條目)。
                const item = {
                    description: mainTermDescription,
                    code: mainTermCode || '', 
                    level: 1,
                    index: indexType,
                    source: sourceName,
                    see: mainSeeNode ? mainSeeNode.textContent.replace(/\s+/g, ' ').trim() : null,
                    seeAlso: mainSeeAlsoNode ? mainSeeAlsoNode.textContent.replace(/\s+/g, ' ').trim() : null,
                    use: mainUseNode ? mainUseNode.textContent.replace(/\s+/g, ' ').trim() : null,
                    specialCodes: null
                };
                cmIndexData.push(item);
            }
            // 如果 MainTerm 有子詞，則不儲存它本身，只將其描述和代碼傳遞給子詞。

            // 處理所有子詞 (Level 2 及以下)
            childTerms.forEach(childTerm => {
                // 遞迴呼叫從 Level 2 開始，父級描述為 MainTermTitle
                // MainTermCode 是父代碼，會被子詞繼承
                parseTerm(childTerm, 2, mainTermDescription, sourceName, mainTermCode);
            });
        });
    });
    console.log('\n'); // 換行，使後續輸出清晰
}

// *** Tabular 和 PCS 的處理邏輯保持不變，因為它們的結構和需求已經固定。***

/**
 * 遞迴解析 Tabular List 中的代碼。
 */
function recursiveParseTabular(diagNode, level) {
    const nameNode = diagNode.getElementsByTagName('name')[0];
    const descNode = diagNode.getElementsByTagName('desc')[0];

    if (!nameNode || !descNode) return;

    const code = nameNode.textContent.trim();
    const term = descNode.textContent.trim();

    if (tabularData[code]) return;
    
    const getNotes = (tagName) => getChildElements(diagNode).filter(child => child.localName === tagName)
        .flatMap(node => Array.from(node.getElementsByTagName('note')).map(n => n.textContent.trim()));

    const includes = getNotes('inclusionTerm'); 
    const excludes1 = getNotes('excludes1');
    const excludes2 = getNotes('excludes2');
    const codeFirst = getNotes('codeFirst');
    const useAdditionalCode = getNotes('useAdditionalCode');
    const notes = getNotes('notes');
        
    const sevenCharNode = getChildElements(diagNode).find(child => child.localName === 'sevenChar');
    const sevenChar = sevenCharNode ? {
        default: sevenCharNode.getElementsByTagName('default')[0] ? sevenCharNode.getElementsByTagName('default')[0].textContent.trim() : null,
        notes: Array.from(sevenCharNode.getElementsByTagName('note')).map(n => n.textContent.trim())
    } : null;


    tabularData[code] = {
        code: code,
        term: term,
        level: level,
        source: 'Tabular',
        ...(includes.length > 0 && { includes }),
        ...(excludes1.length > 0 && { excludes1 }),
        ...(excludes2.length > 0 && { excludes2 }),
        ...(codeFirst.length > 0 && { codeFirst }),
        ...(useAdditionalCode.length > 0 && { useAdditionalCode }),
        ...(notes.length > 0 && { notes }),
        ...(sevenChar && (sevenChar.default || sevenChar.notes.length > 0) && { sevenChar }),
    };

    const childDiags = getChildElements(diagNode).filter(child => child.localName === 'diag');
    childDiags.forEach(childDiag => {
        recursiveParseTabular(childDiag, level + 1);
    });
}

/**
 * 處理 ICD-10-CM Tabular List 的 XML。
 */
function processTabularData(xmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    const chapterNodes = doc.getElementsByTagName('chapter');

    Array.from(chapterNodes).forEach(chapterNode => {
        const children = getChildElements(chapterNode);
        
        children.forEach(child => {
            if (child.localName === 'diag') {
                recursiveParseTabular(child, 1);
            } else if (child.localName === 'section') {
                const rootDiagsInSection = getChildElements(child).filter(node => node.localName === 'diag');
                rootDiagsInSection.forEach(rootDiag => {
                    recursiveParseTabular(rootDiag, 1);
                });
            }
        });
    });

    // 將 Tabular List 的三碼 Category 級別加入 Index Data 以便搜索
    Object.keys(tabularData).filter(code => code.length === 3).forEach(code => {
         cmIndexData.push({
            description: tabularData[code].term,
            code: code,
            level: 1,
            index: 'cm',
            source: 'Tabular',
            see: null,
            seeAlso: null,
            use: null,
            specialCodes: null
        });
    });
}


/**
 * 處理 ICD-10-PCS 索引。
 */
function processPCSIndexData(xmlContent, sourceName) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');
    
    const letterNodes = doc.getElementsByTagName('letter');
    
    console.log(`\n    --- 開始解析 ${sourceName} 數據 ---`);


    Array.from(letterNodes).forEach(letterNode => {
        const letterTitle = letterNode.getElementsByTagName('title')[0]?.textContent;
        process.stdout.write(letterTitle || '?.'); 

        const mainTermNodes = getChildElements(letterNode).filter(child => child.localName === 'mainTerm');

        mainTermNodes.forEach(mainTermNode => {
            let titleNode = mainTermNode.getElementsByTagName('title')[0];
            let mainTermDescription = formatDescription(titleNode);

            const childTerms = getChildElements(mainTermNode).filter(child => child.localName === 'term');

            // 處理 Level 1 的引導詞
            let seeNode = getChildElements(mainTermNode).find(child => child.localName === 'see');
            let useNode = getChildElements(mainTermNode).find(child => child.localName === 'use');
            
            let seeText = seeNode ? seeNode.textContent.replace(/\s+/g, ' ').trim() : null;
            let useText = useNode ? useNode.textContent.replace(/\s+/g, ' ').trim() : null;
            
            // 只要有 See 或 Use，就儲存 PCS Level 1 項目
            if (seeNode || useNode) {
                 const item = {
                    description: mainTermDescription,
                    code: '', 
                    level: 1,
                    index: 'pcs',
                    source: sourceName,
                    see: seeText,
                    seeAlso: null,
                    use: useText,
                    specialCodes: null
                };
                pcsIndexData.push(item);
            }
            
            // 處理所有子詞 (level 2 及以下)
            childTerms.forEach(childTerm => {
                // 遞迴呼叫從 level 2 開始，父級描述為 MainTermTitle
                parseTermPCS(childTerm, 2, mainTermDescription, sourceName);
            });
        });
    });
    console.log('\n'); 
}

/**
 * 遞迴解析 PCS Index 的 <term>。
 */
function parseTermPCS(termNode, level, parentDescription, source) {
    let titleNode = termNode.getElementsByTagName('title')[0];
    let termDescription = formatDescription(titleNode);

    // 構造當前層級的描述： Parent, CurrentTitle (nemod)
    let currentDescription = parentDescription;
    if (termDescription) {
        currentDescription += (currentDescription ? ', ' : '') + termDescription;
    }
    
    // 處理 See/Use/Codes
    let seeNode = getChildElements(termNode).find(child => child.localName === 'see');
    let useNode = getChildElements(termNode).find(child => child.localName === 'use');
    
    let seeText = seeNode ? seeNode.textContent.replace(/\s+/g, ' ').trim() : null;
    let useText = useNode ? useNode.textContent.replace(/\s+/g, ' ').trim() : null;
    
    // 提取 <codes> 內容
    const codesNode = seeNode ? getChildElements(seeNode).find(child => child.localName === 'codes') : null;
    const codesText = codesNode ? codesNode.textContent.replace(/\s+/g, ' ').trim() : null;
    
    // 處理結果項目
    if (seeText || useText) {
        const item = {
            description: currentDescription,
            code: codesText || '', 
            level: level,
            index: 'pcs',
            source: source,
            see: seeText,
            seeAlso: null,
            use: useText,
            specialCodes: null
        };
        pcsIndexData.push(item);
    }
    
    // 處理子項 (遞迴)
    const childTerms = getChildElements(termNode).filter(child => child.localName === 'term');
    childTerms.forEach(childTerm => {
        parseTermPCS(childTerm, level + 1, currentDescription, source);
    });
}


// --- 4. 主執行邏輯 ---
function main() {
    cmIndexData = [];
    pcsIndexData = [];
    tabularData = {}; 

    // --- 處理 ICD-10-CM 數據 ---
    console.log("\n--- 開始 ICD-10-CM 索引轉換 ---");
    FILES_CM.filter(f => !f.isTabular).forEach(file => {
        indexType = 'cm';
        try {
            const xmlContent = loadXML(file.url);
            if (xmlContent) {
                 processCMIndexData(xmlContent, file.name, file.isTable);
                 console.log(`✅ 轉換完成: ${file.url} (${file.name})`);
            }
        } catch (e) {
            if (e.message.startsWith('Critical Error reading')) {
                console.error(`❌ 轉換程序終止：請檢查檔案路徑或權限。`);
                return; 
            }
            console.error(`❌ 轉換失敗: ${file.url} (${file.name})`, e.message);
        }
    });
    
    // 處理 Tabular 數據
    const tabularFile = FILES_CM.find(f => f.isTabular);
    if (tabularFile) {
        console.log("\n--- 開始 ICD-10-CM Tabular 轉換 ---");
        try {
            const xmlContent = loadXML(tabularFile.url);
            if (xmlContent) {
                processTabularData(xmlContent);
                console.log(`✅ Tabular 數據處理完成。共轉換 ${Object.keys(tabularData).length} 個代碼。`);
            } else {
                 console.log(`⚠️ Tabular XML 檔案缺失或無法讀取，跳過處理。`);
            }
        } catch (e) {
             if (e.message.startsWith('Critical Error reading')) {
                console.error(`❌ 轉換程序終止：請檢查檔案路徑或權限。`);
                return; 
            }
             console.error(`❌ Tabular 轉換失敗: ${tabularFile.url}`, e.message);
        }
    }
    
    // --- 處理 ICD-10-PCS 索引 ---
    console.log("\n--- 開始 ICD-10-PCS 索引轉換 ---");
    FILES_PCS.forEach(file => {
        indexType = 'pcs';
        try {
            const xmlContent = loadXML(file.url);
            if (xmlContent) {
                processPCSIndexData(xmlContent, file.name);
                console.log(`✅ 轉換完成: ${file.url} (${file.name})`);
            }
        } catch (e) {
             if (e.message.startsWith('Critical Error reading')) {
                console.error(`❌ 轉換程序終止：請檢查檔案路徑或權限。`);
                return; 
            }
             console.error(`❌ 轉換失敗: ${file.url} (${file.name})`, e.message);
        }
    });


    // --- 寫入 JSON 檔案 ---
    try {
        fs.writeFileSync(path.join(__dirname, 'data_cm_index.json'), JSON.stringify(cmIndexData, null, 2));
        console.log(`\n✅ 成功寫入 data_cm_index.json, 共 ${cmIndexData.length} 條 (包含索引, 腫瘤, 中毒, Tabular Category)`);
    } catch (e) {
        console.error("❌ 寫入 data_cm_index.json 失敗:", e.message);
    }

    try {
        fs.writeFileSync(path.join(__dirname, 'data_pcs_index.json'), JSON.stringify(pcsIndexData, null, 2));
        console.log(`✅ 成功寫入 data_pcs_index.json, 共 ${pcsIndexData.length} 條`);
    } catch (e) {
        console.error("❌ 寫入 data_pcs_index.json 失敗:", e.message);
    }

    try {
        fs.writeFileSync(path.join(__dirname, 'data_tabular_index.json'), JSON.stringify(tabularData, null, 2));
        console.log(`✅ 成功寫入 data_tabular_index.json, 共 ${Object.keys(tabularData).length} 條`);
    } catch (e) {
        console.error("❌ 寫入 data_tabular_index.json 失敗:", e.message);
    }
}


if (require.main === module) {
    main();
}