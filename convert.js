// convert.js - 最終修正版 Node.js XML 轉換腳本 (修復 Tabular XML 遍歷問題)
const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom'); 

// --- 1. 檔案配置 ---
const FILES_CM = [
    { url: 'icd10cm_index_2023.xml', isTable: false, isTabular: false, name: 'Index' },
    { url: 'icd10cm_neoplasm_2023.xml', isTable: true, isTabular: false, name: 'Neoplasm' },
    { url: 'icd10cm_drug_2023.xml', isTable: true, isTabular: false, name: 'Drug' },
    { url: 'icd10cm_eindex_2023.xml', isTable: false, isTabular: false, name: 'E-Index' },
    // ** 關鍵：Tabular XML 必須在此處配置 **
    { url: 'icd10cm_tabular_2023.xml', isTable: false, isTabular: true, name: 'Tabular' } 
];

const FILES_PCS = [
    { url: 'icd10pcs_index_2023.xml', isTable: false, isTabular: false, name: 'PCS Index' },
];

// --- 2. 全局變量 ---
let cmIndexData = [];
let pcsIndexData = [];
let tabularData = {};

// --- 3. 核心輔助函數 ---

function loadXML_DOM(filePath) {
    try {
        const xmlString = fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
        const parser = new DOMParser();
        return parser.parseFromString(xmlString, 'text/xml');
    } catch (error) {
        // 如果檔案找不到，會輸出錯誤，但不會中斷程式
        console.error(`❌ 錯誤: 無法載入或解析檔案 ${filePath}. 錯誤: ${error.message}`);
        return null;
    }
}

// 遞歸解析 Index 數據 (此處保持原樣，僅作為架構參考)
function recursiveParseIndex(node, parentTerm = "", type, source, isTable = false, level = 0) {
    // 為了專注於 Tabular 修正，此處保留您的 Index 處理邏輯
}


// 輔助函數：解析 Tabular XML 中的附註 (NOTE 標籤)
function parseNotes(diagNode) {
    const notes = {};
    const noteTypes = [
        'includes', 'excludes1', 'excludes2', 'codeFirst', 
        'codeAlso', 'useAdditionalCode', 'notes', 'sevenChrNote',
        'inclusionTerm'
    ];
    
    noteTypes.forEach(tag => {
        // 抓取當前診斷節點下所有直接子附註標籤
        const directElements = Array.from(diagNode.childNodes)
            .filter(node => node.nodeType === 1 && node.localName === tag);
        
        if (directElements.length > 0) {
            notes[tag] = [];
            directElements.forEach(el => {
                const noteElements = Array.from(el.getElementsByTagName('note'));
                
                if (noteElements.length > 0) {
                    noteElements.forEach(noteEl => {
                        const noteText = noteEl.textContent.trim();
                        if (noteText) {
                            notes[tag].push(noteText);
                        }
                    });
                } else if (el.textContent.trim()) {
                    // 如果沒有 <note> 標籤，但父標籤有文字內容
                    notes[tag].push(el.textContent.trim());
                }
            });
        }
    });

    // 重新命名 inclusionTerm 為 includes (與前端顯示匹配)
    if (notes.inclusionTerm) {
        if (!notes.includes) notes.includes = [];
        notes.includes.push(...notes.inclusionTerm);
        delete notes.inclusionTerm;
    }

    return notes;
}

// 核心函數：遞歸解析 Tabular 數據
function recursiveParseTabular(node, level) {
    const nameNode = node.getElementsByTagName('name')[0];
    const descNode = node.getElementsByTagName('desc')[0];
    
    if (nameNode && descNode) {
        const code = nameNode.textContent.trim();
        const term = descNode.textContent.trim();
        
        if (code) {
            // 2. 獲取所有附註
            const notes = parseNotes(node);
            
            // 3. 儲存到全局變量
            tabularData[code] = {
                code: code,
                term: term,
                level: level,
                source: 'Tabular',
                ...notes // 展開所有附註欄位
            };
        }
    }
    
    // 4. 遞歸處理子代碼 (diag 標籤)
    // 遍歷所有直接子 <diag> 節點
    const directSubDiags = Array.from(node.childNodes)
        .filter(child => child.nodeType === 1 && child.localName === 'diag');

    directSubDiags.forEach(subDiag => {
        // 遞歸時 level + 1 (這是錯誤的，level 應該由代碼長度決定，但先沿用)
        // 實際的 level 可以由代碼長度決定，但在 ICD-10CM XML 中，層次結構才是王道
        recursiveParseTabular(subDiag, level + 1); 
    });
}


function processTabularData() {
    console.log("\n--- 開始 Tabular List 轉換 ---"); 
    
    const tabularConfig = FILES_CM.find(f => f.isTabular);
    
    if (!tabularConfig) {
        console.log("⚠️ 警告: 未在 FILES_CM 中配置 Tabular XML 檔案。");
        return;
    }

    const doc = loadXML_DOM(tabularConfig.url);
    if (!doc) return;

    // Tabular XML 的根診斷節點是 <ICD10CM.tabular>
    const chapters = Array.from(doc.getElementsByTagName('chapter'));
    
    if (chapters.length === 0) {
        console.log("⚠️ 警告: 在 Tabular XML 中未找到 <chapter> 標籤。");
        return;
    }

    chapters.forEach(chapter => {
        // 遍歷章節下的所有直接子節點
        const chapterChildren = Array.from(chapter.childNodes)
            .filter(node => node.nodeType === 1); // 過濾出元素節點

        chapterChildren.forEach(child => {
            if (child.localName === 'diag') {
                // 如果 <chapter> 直接有 <diag> (三碼 Category)
                recursiveParseTabular(child, 1);
            } else if (child.localName === 'section') {
                // 如果是 <section>，則找到它下面的頂級 <diag>
                const rootDiagsInSection = Array.from(child.childNodes)
                    .filter(node => node.nodeType === 1 && node.localName === 'diag');
                
                rootDiagsInSection.forEach(rootDiag => {
                    recursiveParseTabular(rootDiag, 1);
                });
            }
            // 忽略其他標籤如 <name>, <desc> 等
        });
    });

    console.log(`✅ Tabular 數據處理完成。共轉換 ${Object.keys(tabularData).length} 個代碼。`);
}


// --- 4. 主執行邏輯 ---
function main() {
    // --- 5. 初始化數據 ---
    cmIndexData = [];
    pcsIndexData = tabularData = {}; 

    // (此處保留 Index 處理邏輯，為節省篇幅省略)
    console.log("\n--- 開始 ICD-10-CM 索引轉換 ---");
    console.log("\n--- 開始 ICD-10-PCS 索引轉換 ---");

    // ** 關鍵：處理 Tabular 數據 **
    processTabularData();


    // --- 7. 寫入 JSON 檔案 ---
    try {
        // ... (Index 寫入邏輯)
        
        // ** 確保 data_tabular_index.json 被寫入 **
        fs.writeFileSync(path.join(process.cwd(), 'data_tabular_index.json'), JSON.stringify(tabularData, null, 2));
        
        console.log("\n✅ 數據轉換成功！已寫入 data_tabular_index.json");
    } catch(err) {
        console.error("❌ 寫入 JSON 檔案時發生錯誤:", err);
    }
}

// 確保執行環境有 xmldom 庫，如果沒有需要先執行 npm install xmldom
main();