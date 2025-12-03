// convert.js - Node.js XML 轉換腳本 (還原到 V3 拆分邏輯 - 條列式樣式)
const fs = require('fs');
const path = require('path');
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

let cmIndexData = [];
let pcsIndexData = [];
let tabularData = {}; 
let specialTableHeaders = {}; 

// --- 2. 工具函數 ---

/**
 * 載入 XML 檔案並新增錯誤日誌
 */
function loadXML_DOM(fileName) {
    try {
        const filePath = path.join(process.cwd(), fileName); 
        
        // 檢查檔案是否存在
        if (!fs.existsSync(filePath)) {
            console.error(`🚨 錯誤：XML 檔案 ${fileName} 不存在於當前目錄，將跳過。`);
            return null;
        }
        
        const xmlString = fs.readFileSync(filePath, 'utf8');
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlString, 'text/xml');
        
        // 檢查 DOM 解析是否成功
        if (!doc || !doc.documentElement) {
            console.error(`🚨 錯誤：XML 檔案 ${fileName} 內容無效或無法解析。`);
            return null;
        }

        return doc.documentElement;
    } catch (e) {
        console.error(`🚨 致命錯誤：讀取或解析 ${fileName} 失敗:`, e.message);
        return null;
    }
}

function cleanTitle(title) {
    if (!title) return '';
    return title.replace(/<nemod>.*?<\/nemod>/g, '').trim();
}

function extractReference(element, tagName) {
    const refElement = element.getElementsByTagName(tagName)[0];
    if (refElement) {
        return refElement.textContent.replace(/<codes>.*?<\/codes>/g, '').trim();
    }
    return null;
}

function extractSpecialTableHeaders(doc, fileName) {
    const indexHeading = doc.getElementsByTagName('indexHeading')[0];
    if (!indexHeading) return null;

    const headers = {};
    const headElements = Array.from(indexHeading.getElementsByTagName('head'));
    headElements.forEach(head => {
        const col = head.getAttribute('col');
        // 清理標題，以便用於描述 (例如：MalignantPrimary)
        const title = head.textContent.trim(); 
        headers[col] = title.replace(/\s+|\(|\)/g, ''); 
    });

    specialTableHeaders[fileName] = headers;
}

/**
 * 遞迴解析索引或表格條目
 */
function recursiveParseIndex(element, currentPath, sourceType, fileName, isTable) {
    const titleElement = element.getElementsByTagName('title')[0];
    const codeElement = element.getElementsByTagName('code')[0];
    
    let title = titleElement ? cleanTitle(titleElement.textContent) : '';
    let description = currentPath ? `${currentPath}, ${title}` : title;

    if (isTable) {
        // --- 舊 V3 邏輯：為每個代碼創建一個獨立條目 (導致多行顯示) ---
        const cells = Array.from(element.getElementsByTagName('cell'));
        const columnHeaders = specialTableHeaders[fileName]; // 獲取表格標頭

        cells.forEach(cell => {
            const col = cell.getAttribute('col');
            let code = cell ? cell.textContent.trim() : '-'; 

            // 只有當代碼存在時才生成條目
            if (code === '--' || code === '' || code === '-') {
                return; 
            }
            
            let fullDescription = description;
            const columnDesc = columnHeaders[col];
            if (columnDesc) {
                 // 將 Neoplasm 欄位描述加入到條目描述中 (例如: , MalignantPrimary)
                 fullDescription += `, ${columnDesc}`; 
            }

            const item = {
                code: code, // 每個條目只有一個代碼
                description: fullDescription,
                source: fileName, 
                see: extractReference(element, 'see'),
                seeAlso: extractReference(element, 'seeAlso'),
                use: extractReference(element, 'use'),
            };
            if (sourceType === 'cm') cmIndexData.push(item);
        });
        // --- 舊 V3 邏輯結束 ---
    } 
    else if (codeElement) {
        const item = {
            code: codeElement.textContent.trim(),
            description: description,
            source: fileName, 
            see: extractReference(element, 'see'),
            seeAlso: extractReference(element, 'seeAlso'),
            use: extractReference(element, 'use'),
        };

        if (sourceType === 'cm') {
            cmIndexData.push(item);
        } else if (sourceType === 'pcs') {
            pcsIndexData.push(item);
        }
    }
    // 處理純參考條目
    else if (extractReference(element, 'see') || extractReference(element, 'seeAlso') || extractReference(element, 'use')) {
         const item = {
            code: null, 
            description: description,
            source: fileName,
            see: extractReference(element, 'see'),
            seeAlso: extractReference(element, 'seeAlso'),
            use: extractReference(element, 'use'),
        };
        if (sourceType === 'cm') cmIndexData.push(item);
        else if (sourceType === 'pcs') pcsIndexData.push(item);
    }


    const subTerms = Array.from(element.getElementsByTagName('term'));
    subTerms.forEach(subTerm => {
        if (subTerm.parentNode === element) {
             recursiveParseIndex(subTerm, description, sourceType, fileName, isTable);
        }
    });
}

/**
 * 載入並處理 Tabular 數據
 */
function processTabularData() {
    console.log("\n--- 開始 Tabular 轉換 ---");
    const tabularFile = FILES_CM.find(f => f.isTabular);
    const doc = loadXML_DOM(tabularFile.url);

    if (!doc) {
         console.log(`處理 Tabular 數據失敗: ${tabularFile.url} 遺失或無效。`);
         return;
    }

    /**
     * 提取 Notes 的輔助函數
     */
    function extractNotes(element) {
        const notes = [];
        const noteTags = [
            { tag: 'includes', type: 'Includes' },
            { tag: 'excludes1', type: 'Excludes1' },
            { tag: 'excludes2', type: 'Excludes2' },
            { tag: 'codeFirst', type: 'Code First' },
            { tag: 'useAdditionalCode', type: 'Use Additional Code' },
            { tag: 'notes', type: 'Notes' } 
        ];
        
        // --- 1. 處理標籤化的 Notes ---
        noteTags.forEach(({ tag, type }) => {
            const container = element.getElementsByTagName(tag)[0];
            if (container) {
                Array.from(container.childNodes).forEach(node => {
                    let text = node.textContent;
                    if (text) {
                        text = text.replace(/<codes>.*?<\/codes>/g, '').trim();
                        if (text.length > 0) {
                            notes.push({ type: type, text: text });
                        }
                    }
                });
            }
        });
        
        // --- 2. 處理 <desc> 之後的直接文本內容 ---
        
        const descElement = element.getElementsByTagName('desc')[0];
        let startParsing = false;

        const stopTags = ['diag', 'notes', 'includes', 'excludes1', 'excludes2', 'codeFirst', 'useAdditionalCode', 'extension'];

        Array.from(element.childNodes).forEach(node => {
            if (node === descElement) {
                startParsing = true;
                return;
            }

            if (startParsing) {
                if (node.nodeType === 1) { // 元素節點
                    const tagName = node.tagName.toLowerCase();
                    if (stopTags.includes(tagName)) {
                        startParsing = false; 
                        return;
                    }
                    // 將元素內容視為單獨一條
                    let text = node.textContent;
                    if (text) {
                        text = text.replace(/<codes>.*?<\/codes>/g, '').trim();
                        if (text.length > 0) {
                            notes.push({ type: 'Includes', text: text });
                        }
                    }
                } 
                else if (node.nodeType === 3) { // 文本節點 (Text Node)
                    let text = node.textContent;
                    if (text) {
                        text = text.replace(/<codes>.*?<\/codes>/g, '').trim();
                        
                        if (text.length > 0) {
                            let items;
                            
                            // *** 核心修正邏輯：針對 F20.2 這種特殊結構進行強制分割 ***
                            const currentCodeName = element.getElementsByTagName('name')[0]?.textContent.trim();

                            if (currentCodeName === 'F20.2') {
                                // 針對 F20.2，強制使用正則表達式，在 '空格 + 大寫字母' 之前分割
                                items = text.split(/(?=\s[A-Z])/) 
                                            .map(item => item.trim())
                                            .filter(item => item.length > 0);
                            } else if (!text.includes('\n') && text.length > 30) { 
                                // 對於其他長文本，使用通用正則分割
                                items = text.split(/(?=\s[A-Z])/) 
                                            .map(item => item.trim())
                                            .filter(item => item.length > 0);
                            } else {
                                // 對於短文本或包含換行符的文本，按換行符分割
                                items = text.split('\n')
                                            .map(line => line.trim())
                                            .filter(line => line.length > 0);
                            }
                            // *** 核心修正邏輯結束 ***
                            
                            items.forEach(item => {
                                notes.push({ type: 'Includes', text: item });
                            });
                        }
                    }
                }
            }
        });
        
        return notes.length > 0 ? notes : null;
    }

    /**
     * 遞迴地提取診斷代碼的資訊和其子代碼
     */
    function recursiveExtractDiag(diagElement) {
        const name = diagElement.getElementsByTagName('name')[0]?.textContent.trim() || '';
        const desc = diagElement.getElementsByTagName('desc')[0]?.textContent.trim() || '';

        if (!name) return null;

        const entry = {
            d: desc,
            notes: extractNotes(diagElement), // 使用修正後的 extractNotes
            ext: diagElement.getElementsByTagName('extension')[0]?.textContent.trim() || null,
        };
        
        const subDiags = Array.from(diagElement.getElementsByTagName('diag')).filter(d => {
            return d.parentNode === diagElement; 
        });

        if (subDiags.length > 0) {
            entry.subs = {}; 
            subDiags.forEach(sub => {
                const subEntry = recursiveExtractDiag(sub);
                if (subEntry) {
                    entry.subs[subEntry.name] = subEntry;
                    delete subEntry.name; 
                }
            });
        }
        
        entry.name = name; 
        return entry;
    }
    
    // 1. 查找所有 3 碼 Category 節點
    const allDiagElements = doc.getElementsByTagName('diag');
    
    const rootDiags = Array.from(allDiagElements).filter(d => {
        const name = d.getElementsByTagName('name')[0]?.textContent.trim() || '';
        return name.length === 3;
    });

    // 2. 對每個 3 碼 Category 進行遞迴處理
    rootDiags.forEach(diagElement => {
        const entry = recursiveExtractDiag(diagElement);
        if (entry) {
            const categoryCode = entry.name;
            delete entry.name; 
            tabularData[categoryCode] = entry;
        }
    });

    console.log(`Tabular data processed. Total 3-char categories: ${Object.keys(tabularData).length}`);
}

// --- 3. 主執行邏輯 ---
function runConversion() {
    
    // ====== CM 索引處理 ======
    console.log("--- 開始 ICD-10-CM 索引轉換 ---");
    cmIndexData = []; 

    for (const fileConfig of FILES_CM.filter(f => f.isTable)) {
        const doc = loadXML_DOM(fileConfig.url);
        if (!doc) continue;
        
        extractSpecialTableHeaders(doc, fileConfig.name);
        
        const mainTerms = Array.from(doc.getElementsByTagName('mainTerm'));
        console.log(`Processing CM Table: ${fileConfig.name} (${mainTerms.length} terms)`);
        
        mainTerms.forEach(term => {
            recursiveParseIndex(term, "", 'cm', fileConfig.name, true); 
        });
    }

    for (const fileConfig of FILES_CM.filter(f => !f.isTable && !f.isTabular)) {
        const doc = loadXML_DOM(fileConfig.url);
        if (!doc) continue;
        
        const mainTerms = Array.from(doc.getElementsByTagName('mainTerm'));
        console.log(`Processing CM Index: ${fileConfig.name} (${mainTerms.length} terms)`);
        
        mainTerms.forEach(term => {
            recursiveParseIndex(term, "", 'cm', fileConfig.name, false); 
        });
    }
    
    // 3. 處理 Tabular 數據 (遞迴邏輯)
    processTabularData();


    // ====== PCS 索引處理 ======
    console.log("\n--- 開始 ICD-10-PCS 索引轉換 ---"); 
    pcsIndexData = []; 
    for (const fileConfig of FILES_PCS) {
        const doc = loadXML_DOM(fileConfig.url);
        if (!doc) {
             console.log(`處理 PCS Index: ${fileConfig.name} (0 terms) - 警告: 檔案 ${fileConfig.url} 似乎遺失或無效。`);
             continue;
        }

        const mainTerms = Array.from(doc.getElementsByTagName('mainTerm'));
        console.log(`Processing PCS Index: ${fileConfig.name} (${mainTerms.length} terms)`);
        
        mainTerms.forEach(term => {
            recursiveParseIndex(term, "", 'pcs', fileConfig.name, fileConfig.isTable);
        });
    }


    // --- 4. 寫入 JSON 檔案 ---
    try {
        fs.writeFileSync(path.join(process.cwd(), 'data_cm_index.json'), JSON.stringify(cmIndexData, null, 2));
        fs.writeFileSync(path.join(process.cwd(), 'data_pcs_index.json'), JSON.stringify(pcsIndexData, null, 2));
        fs.writeFileSync(path.join(process.cwd(), 'data_tabular_index.json'), JSON.stringify(tabularData, null, 2));
        
        console.log('\n✅ 數據轉換完成！');
        console.log(`CM Index: ${cmIndexData.length} 條`); 
        console.log(`PCS Index: ${pcsIndexData.length} 條`);
        console.log(`Tabular Categories: ${Object.keys(tabularData).length} 條`);

    } catch (e) {
        console.error('\n🚨 寫入檔案失敗:', e);
    }
}
runConversion();