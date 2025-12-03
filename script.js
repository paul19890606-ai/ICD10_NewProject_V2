<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <title>ICD-10-PCS 2023 查詢工具（優化版本）</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <style>
    * {
      box-sizing: border-box;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
        sans-serif;
    }

    body {
      margin: 0;
      background: #f5f5f5;
      color: #111827;
    }

    .app {
      max-width: 2000px;
      margin: 3px;
      padding: 24px 20px 40px;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
    }
    
    /* 新增：標題和按鈕的容器 */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px; /* 增加標題區塊底部的間距 */
    }

    h1 {
      margin-top: 0;
      margin-bottom: 0; /* 確保 h1 在 header-row 內不產生額外間距 */
      font-size: 1.6rem;
      letter-spacing: 0.03em;
    }
    
    /* 新增：返回按鈕樣式 */
    .back-link {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 999px;
      background: #4f46e5;
      color: #ffffff;
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 600;
      transition: background 0.2s;
      white-space: nowrap;
      flex-shrink: 0; /* 防止被標題擠壓 */
    }

    .back-link:hover {
      background: #3730a3;
    }

    .subtitle {
      margin-top: 4px;
      margin-bottom: 12px;
      font-size: 0.9rem;
      color: #4b5563;
    }

    .file-row,
    .search-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-bottom: 10px;
    }

    .file-row label,
    .search-row label {
      font-size: 0.9rem;
      font-weight: 600;
    }

    #xmlFile,
    #defFile,
    #indexFile {
      font-size: 0.85rem;
    }

    #searchInput,
    #indexSearchInput {
      flex: 1;
      min-width: 180px;
      padding: 9px 12px;
      border-radius: 999px;
      border: 1px solid #d1d5db;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    #searchInput:focus,
    #indexSearchInput:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
    }

    .hint {
      font-size: 0.8rem;
      color: #6b7280;
      margin-bottom: 8px;
      line-height: 1.4;
    }

    .hint code {
      background: #eef2ff;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 0.78rem;
    }

    .status-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6px;
      margin-bottom: 8px;
      font-size: 0.82rem;
      color: #4b5563;
      gap: 6px;
      flex-wrap: wrap;
    }
    
    /* 處理用戶請求：1. 2. 3. 縮小 並排 不換行 */
    .file-status-group {
      display: flex;
      gap: 8px; /* 狀態列之間的間距 */
      margin-top: 6px; /* 與上一個 input 區塊的間距 */
      margin-bottom: 8px; /* 與下一個 resultInfo 的間隔 */
      flex-wrap: nowrap; /* 不換行 */
    }
    
    .file-status-group .status-row {
      flex: 1 1 0%; /* 平均分配空間並讓其縮小 */
      /* 移除原本 status-row 的垂直 margin，由 group 統一控制 */
      margin-top: 0 !important; 
      margin-bottom: 0 !important;
      /* 新增邊框與底色，讓視覺上更像一個獨立的元件 */
      border: 1px solid #e5e7eb;
      padding: 6px 8px;
      border-radius: 6px;
      background: #ffffff;
      /* 重設 flex-wrap，以免內部再換行 */
      flex-wrap: nowrap;
    }
    
    .file-status-group #loadStatus,
    .file-status-group #defStatus,
    .file-status-group #indexStatus {
      /* 確保文字在並排時不會換行，達到視覺上的「縮小」感 */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      /* 確保 loadStatus 裡的 badge 不會被擠壓 */
      min-width: 0;
    }
    /* 調整原本 status-row 上的 badge 佈局 */
    #tablesStatusRow {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    /* 調整 resultInfo 的 margin，使其更靠近 group */
    .app > .status-row:nth-last-child(3) { /* Targeting the resultInfo row */
        margin-top: 0;
    }

    /* 載入狀態的圖示樣式 */
    .status-icon {
        margin-right: 4px;
        font-weight: 700;
        font-size: 0.9rem;
    }

    .loading .status-icon {
      color: #c05621; /* 橘色 */
      animation: spin 1s linear infinite;
    }

    .ok .status-icon {
      color: #047857; /* 綠色 */
    }

    .error .status-icon {
      color: #b91c1c; /* 紅色 */
    }

    .initial .status-icon {
      color: #9ca3af; /* 灰色 */
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    /* 移除先前隱藏狀態列的 CSS 規則，讓它們可以顯示 */

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: 999px;
      background: #eef2ff;
      color: #4338ca;
      font-size: 0.78rem;
      gap: 6px;
      /* 確保在並排縮小時不會佔用太多空間 */
      flex-shrink: 0;
    }

    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #4f46e5;
    }

    .pcs-summary {
      margin-top: 16px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 10px 12px;
      background: #f9fafb;
      font-size: 0.86rem;
    }

    .pcs-summary-title {
      font-weight: 700;
      margin-bottom: 6px;
      font-size: 1rem;
    }

    .pcs-summary-row {
      display: flex;
      gap: 8px;
      line-height: 1.4;
    }

    .pcs-summary-row span:first-child {
      font-style: italic;
      min-width: 80px;
    }

    .pcs-summary-code {
      font-weight: 700;
      margin-right: 4px;
    }

    .selected-code-box {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px dashed #d1d5db;
      font-size: 0.86rem;
    }

    .selected-code-box code {
      font-family: "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono",
        "Courier New", monospace;
    }

    .table-wrapper {
      margin-top: 12px;
      border-radius: 12px;
      overflow: auto;
      border: 1px solid #e5e7eb;
      background: #fafafa;
      max-height: 70vh;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      min-width: 760px;
      font-size: 0.85rem;
    }

    thead {
      background: #f3f4ff;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    th,
    td {
      padding: 6px 8px;
      border-bottom: 1px solid #e5e7eb;
      border-right: 1px solid #e5e7eb;
      text-align: left;
      vertical-align: top;
    }

    th:last-child,
    td:last-child {
      border-right: none;
    }

    th {
      font-weight: 600;
      font-size: 0.78rem;
      color: #4b5563;
    }

    tbody tr:nth-child(even) {
      background: #f9fafb;
    }

    .no-result {
      padding: 16px;
      text-align: center;
      color: #9ca3af;
      font-size: 0.9rem;
    }

    /* 移除這裡原本的 loading/ok/error 顏色定義 */
    /* .loading { color: #c05621; } */
    /* .ok { color: #047857; } */
    /* .error { color: #b91c1c; } */

    .option-row {
      display: flex;
      align-items: flex-start;
      gap: 4px;
      font-size: 0.83rem;
      line-height: 1.3;
    }

    .option-row input[type="radio"] {
      margin-top: 2px;
    }

    .option-code {
      font-family: "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono",
        "Courier New", monospace;
      font-weight: 600;
      margin-right: 4px;
    }

    /* Index 查詢結果區塊 */
    .index-result-box {
      margin-top: 4px;
      margin-bottom: 10px;
      max-height: 220px;
      overflow: auto;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
      background: #f9fafb;
      padding: 6px 8px;
      font-size: 0.82rem;
    }

    .index-result-empty {
      color: #9ca3af;
      padding: 4px 2px;
    }

    .index-result-item {
      padding: 4px 0;
      border-bottom: 1px solid #e5e7eb;
    }

    .index-result-item:last-child {
      border-bottom: none;
    }

    .index-path {
      font-weight: 500;
      margin-bottom: 2px;
    }

    .index-codes {
      margin-top: 2px;
    }

    .index-code-chip {
      display: inline-block;
      margin-right: 6px;
      margin-top: 3px;
      padding: 1px 7px;
      border-radius: 999px;
      background: #eef2ff;
      border: 1px solid #e0e7ff;
      cursor: pointer;
      font-family: "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono",
        "Courier New", monospace;
      font-size: 0.78rem;
    }

    .index-code-chip:hover {
      background: #e0e7ff;
    }

    .index-tip {
      font-size: 0.75rem;
      color: #6b7280;
      margin-top: 2px;
    }

    @media (max-width: 640px) {
      .app {
        margin: 12px;
        padding: 16px;
        border-radius: 12px;
      }
      h1 {
        font-size: 1.3rem;
      }
      /* 新增：移動到小螢幕時，標題和按鈕仍然保持並列 */
      .header-row {
          flex-direction: row;
          align-items: flex-start;
      }
      /* 在小螢幕時，讓狀態列回到堆疊，並允許換行 */
      .file-status-group {
          flex-direction: column;
          gap: 6px;
          margin-bottom: 6px;
      }
      .file-status-group .status-row {
          padding: 8px 10px;
          /* 讓文字可以換行 */
          flex-wrap: wrap;
      }
      .file-status-group #loadStatus,
      .file-status-group #defStatus,
      .file-status-group #indexStatus {
          white-space: normal;
          overflow: visible;
          text-overflow: clip;
      }
      /* 調整 resultInfo 的 margin */
      .app > .status-row:nth-last-child(3) {
          margin-top: 0;
          margin-bottom: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="app">
    <div class="header-row">
      <h1>ICD-10-PCS 2023 查詢工具（優化版）</h1>
      <a href="index.html" class="back-link">返回 Index</a>
    </div>
    <div class="file-row">
  <label>1. Tables 檔：</label>
  <span>自動載入 <code>icd10pcs_tables_2023.xml</code></span>
</div>

<div class="file-row">
  <label>2. Definitions 檔（可選）：</label>
  <span>自動載入 <code>icd10pcs_definitions_2023.xml</code></span>
</div>

<div class="file-row">
  <label>3. Index 檔（處置名稱查詢，可選）：</label>
  <span>自動載入 <code>icd10pcs_index_2023.xml</code></span>
</div>





    <div class="search-row">
      <label for="indexSearchInput">處置名稱：</label>
      <input
        id="indexSearchInput"
        type="text"
        placeholder="載入 Index 檔後，可輸入英文處置名稱（例：Appendectomy）"
        autocomplete="off"
        disabled
      />
    </div>
    <div class="hint">
      ▸ 支援模糊搜尋：輸入部分關鍵字即可（不分大小寫）。<br />
      ▸ 點選結果中的代碼膠囊（例如 <code>0DTJ</code>），會自動帶入前三碼到上方欄位並查詢 PCS Table。
    </div>

    <div class="search-row">
      <label for="searchInput">PCS 前 3 碼：</label>
      <input
        id="searchInput"
        type="text"
        placeholder="請先載入 Tables 檔，再輸入前 3 碼（例如：0BD）"
        autocomplete="off"
        disabled
      />
    </div>
    <div class="hint">
      ▸ 使用「起始比對」：只抓代碼開頭 = 你輸入的 3 碼。<br />
      ▸ 四欄各選一個，系統會自動補齊最可能的合法組合並顯示完整 7 碼。
    </div>

    <div class="file-status-group">
        <div class="status-row initial" id="tablesStatusRow">
          <div id="loadStatus">尚未載入 Tables XML。</div>
          <div class="badge">
            <span class="badge-dot"></span>
            <span>來源：ICD-10-PCS 2023</span>
          </div>
        </div>
        <div class="status-row initial" id="defStatusRow">
          <div id="defStatus">尚未載入 Definitions XML（hover 提示關閉）。</div>
        </div>
        <div class="status-row initial" id="indexStatusRow">
          <div id="indexStatus">尚未載入 Index XML（處置名稱查詢關閉）。</div>
        </div>
    </div>
    <div class="status-row">
      <div id="resultInfo">請先載入 Tables 檔，再輸入前 3 碼。</div>
    </div>

    <div id="indexResultBox" class="index-result-box">
      <div class="index-result-empty">
        目前尚未載入 Index XML，或尚未輸入處置名稱。
      </div>
    </div>
<div id="pcsSummary" class="pcs-summary">
      <div id="summaryTitle" class="pcs-summary-title">
        尚未查詢
      </div>
      <div id="summaryDetail">
        <div class="pcs-summary-row">
          <span><em>Section</em></span>
          <span>—</span>
        </div>
        <div class="pcs-summary-row">
          <span><em>Body System</em></span>
          <span>—</span>
        </div>
        <div class="pcs-summary-row">
          <span><em>Operation</em></span>
          <span>—</span>
        </div>
      </div>
      <div id="selectedCodeBox" class="selected-code-box">
        目前尚未選取完整 7 碼代碼。
      </div>
    </div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Body Part<br /><span style="font-weight:400;">（第 4 碼）</span></th>
            <th>Approach<br /><span style="font-weight:400;">（第 5 碼）</span></th>
            <th>Device<br /><span style="font-weight:400;">（第 6 碼）</span></th>
            <th>Qualifier<br /><span style="font-weight:400;">（第 7 碼）</span></th>
          </tr>
        </thead>
        <tbody id="resultBody">
          <tr>
            <td class="no-result" colspan="4">
              尚未載入資料。請先選擇 <code>icd10pcs_tables_2023.xml</code>。
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <script>
    
// 固定檔案的 URL
// 【修正點 2：修正檔案路徑，假設 XML 檔案與 HTML 檔案在同一目錄】
const TABLES_URL = "icd10pcs_tables_2023.xml";
const DEFINITIONS_URL = "icd10pcs_definitions_2023.xml";
const INDEX_URL = "icd10pcs_index_2023.xml";

// 自動載入 Tables
function loadTables() {
  setLoadStatus("正在載入 Tables 檔案...", "loading");
  fetch(TABLES_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error("無法載入 Tables 檔案");
      }
      return response.text();
    })
    .then((text) => {
      const codes = parseIcd10PcsXml(text);
      icdCodes = codes;
      icdCodeMap = new Map();
      codes.forEach((c) => icdCodeMap.set(c.code, c.desc));
      buildValidMap(); // 建立合法組合表
      isLoaded = true;
      searchInput.disabled = false;
      setLoadStatus(
        `Tables 載入完成，共 ${codes.length.toLocaleString()} 筆代碼。`,
        "ok"
      );
      resetTablePlaceholder("請在上方輸入前 3 碼。");
    })
    .catch((err) => {
      console.error(err);
      setLoadStatus("Tables 載入失敗：" + err.message, "error");
    });
}

// 自動載入 Definitions
function loadDefinitions() {
  setDefStatus("正在載入 Definitions 檔案...", "loading");
  fetch(DEFINITIONS_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error("無法載入 Definitions 檔案");
      }
      return response.text();
    })
    .then((text) => {
      parseDefinitionsXml(text);
      defLoaded = true;
      setDefStatus("Definitions 載入完成。", "ok");
    })
    .catch((err) => {
      console.error(err);
      setDefStatus("Definitions 載入失敗：" + err.message, "error");
    });
}

// 自動載入 Index
function loadIndex() {
  setIndexStatus("正在載入 Index 檔案...", "loading");
  fetch(INDEX_URL)
    .then((response) => {
      if (!response.ok) {
        throw new Error("無法載入 Index 檔案");
      }
      return response.text();
    })
    .then((text) => {
      const entries = parseIndexXml(text);
      indexEntries = entries;
      indexLoaded = true;
      indexSearchInput.disabled = false;
      setIndexStatus(
        `Index 載入完成，共 ${entries.length.toLocaleString()} 筆項目。`,
        "ok"
      );
    })
    .catch((err) => {
      console.error(err);
      setIndexStatus("Index 載入失敗：" + err.message, "error");
    });
}

// 頁面載入時自動執行
document.addEventListener("DOMContentLoaded", () => {
  loadTables();
  loadDefinitions();
  loadIndex();
});

    const xmlFileInput = document.getElementById("xmlFile");
    const defFileInput = document.getElementById("defFile");
    const indexFileInput = document.getElementById("indexFile");

    // 【新增：取得 status-row 元素】
    const tablesStatusRow = document.getElementById("tablesStatusRow");
    const defStatusRow = document.getElementById("defStatusRow");
    const indexStatusRow = document.getElementById("indexStatusRow");
    
    const loadStatus = document.getElementById("loadStatus");
    const defStatus = document.getElementById("defStatus");
    const indexStatus = document.getElementById("indexStatus");

    const searchInput = document.getElementById("searchInput");
    const indexSearchInput = document.getElementById("indexSearchInput");

    const resultBody = document.getElementById("resultBody");
    const resultInfo = document.getElementById("resultInfo");

    const summaryTitle = document.getElementById("summaryTitle");
    const summaryDetail = document.getElementById("summaryDetail");
    const selectedCodeBox = document.getElementById("selectedCodeBox");

    const indexResultBox = document.getElementById("indexResultBox");

    // 7 碼完整代碼列表與 map
    let icdCodes = [];          // [{code, desc}]
    let icdCodeMap = new Map(); // code -> desc
    let isLoaded = false;

    // 新增：依前三碼建立合法組合 map
    // validMap: prefix -> { body:Set, approach:Set, device:Set, qualifier:Set, combos:Set(完整7碼) }
    let validMap = new Map();

    // definitions（hover 提示）
    const definitionMaps = {
      bodypart: new Map(),
      device: new Map(),
    };
    let defLoaded = false;

    // Index：每筆 { path, codes[] }
    let indexEntries = [];
    let indexLoaded = false;

    let currentPrefix = "";
    let selections = {
      bodypart: null,
      approach: null,
      device: null,
      qualifier: null,
    };

    // 【修改：新增圖示支援】
    function setStatus(element, rowElement, text, cls) {
      const iconMap = {
          "loading": "🔄",
          "ok": "✅",
          "error": "❌",
          "initial": "⚪"
      };
      const icon = iconMap[cls] || "";
      
      // 更新文字內容，包含圖示
      element.innerHTML = `<span class="status-icon">${icon}</span>${text}`;
      
      // 更新 class 以應用顏色和動畫
      rowElement.className = "status-row " + cls;
    }

    function setLoadStatus(text, cls) {
      setStatus(loadStatus, tablesStatusRow, text, cls);
    }
    function setDefStatus(text, cls) {
      setStatus(defStatus, defStatusRow, text, cls);
    }
    function setIndexStatus(text, cls) {
      setStatus(indexStatus, indexStatusRow, text, cls);
    }
    
    function setResultInfo(text) {
      resultInfo.textContent = text;
    }

    function resetTablePlaceholder(message) {
      resultBody.innerHTML =
        '<tr><td class="no-result" colspan="4">' +
        (message || "尚無資料。") +
        "</td></tr>";
    }

    function resetSummaryHeader() {
      summaryTitle.textContent = "尚未查詢";
      summaryDetail.innerHTML = `
        <div class="pcs-summary-row"><span><em>Section</em></span><span>—</span></div>
        <div class="pcs-summary-row"><span><em>Body System</em></span><span>—</span></div>
        <div class="pcs-summary-row"><span><em>Operation</em></span><span>—</span></div>
      `;
    }

    function resetSelections() {
      selections = {
        bodypart: null,
        approach: null,
        device: null,
        qualifier: null,
      };
      // 清掉 radio 勾選
      ["bodypart","approach","device","qualifier"].forEach(field => {
        document
          .querySelectorAll(`input[name="${field}"]`)
          .forEach(r => { r.checked = false; r.disabled = false; r.parentElement.style.opacity = 1; });
      });
      updateSelectedCode();
    }

    function escapeHtmlAttr(str) {
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    function getDefinitionTooltip(kind, label) {
      if (!defLoaded || !label) return "";
      const map = definitionMaps[kind];
      if (!map) return "";
      const key = label.trim();
      if (!map.has(key)) return "";
      return map.get(key);
    }

    // 取得 axis pos 的 label
    function getDirectAxisLabels(parent, pos) {
      const labels = [];
      Array.from(parent.children).forEach((child) => {
        if (
          child.tagName === "axis" &&
          child.getAttribute("pos") === String(pos)
        ) {
          labels.push(...Array.from(child.getElementsByTagName("label")));
        }
      });
      return labels;
    }

    // -------- Tables XML 解析 --------
    function parseIcd10PcsXml(xmlText) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "application/xml");
      const parserError = xmlDoc.querySelector("parsererror");
      if (parserError) {
        throw new Error("Tables XML 格式解析失敗，請確認檔案是否正確。");
      }

      const tables = Array.from(xmlDoc.getElementsByTagName("pcsTable"));
      if (!tables.length) {
        throw new Error(
          "Tables XML 中找不到 pcsTable 節點，可能不是正確的檔案。"
        );
      }

      const codes = [];

      tables.forEach((table) => {
        const sectionLabels = getDirectAxisLabels(table, 1);
        const bodySystemLabels = getDirectAxisLabels(table, 2);
        const operationLabels = getDirectAxisLabels(table, 3);

        if (
          !sectionLabels.length ||
          !bodySystemLabels.length ||
          !operationLabels.length
        ) {
          return;
        }

        const rows = Array.from(table.getElementsByTagName("pcsRow"));
        rows.forEach((row) => {
          const bodyPartLabels = getDirectAxisLabels(row, 4);
          const approachLabels = getDirectAxisLabels(row, 5);
          const deviceLabels = getDirectAxisLabels(row, 6);
          const qualifierLabels = getDirectAxisLabels(row, 7);

          if (
            !bodyPartLabels.length ||
            !approachLabels.length ||
            !deviceLabels.length ||
            !qualifierLabels.length
          ) {
            return;
          }

          sectionLabels.forEach((sec) => {
            const sCode = (sec.getAttribute("code") || "").toUpperCase();
            const sText = sec.textContent.trim();
            bodySystemLabels.forEach((bs) => {
              const bsCode = (bs.getAttribute("code") || "").toUpperCase();
              const bsText = bs.textContent.trim();
              operationLabels.forEach((op) => {
                const opCode = (op.getAttribute("code") || "").toUpperCase();
                const opText = op.textContent.trim();

                bodyPartLabels.forEach((bp) => {
                  const bpCode = (bp.getAttribute("code") || "").toUpperCase();
                  const bpText = bp.textContent.trim();
                  approachLabels.forEach((ap) => {
                    const apCode = (ap.getAttribute("code") || "").toUpperCase();
                    const apText = ap.textContent.trim();
                    deviceLabels.forEach((dv) => {
                      const dvCode = (dv.getAttribute("code") || "").toUpperCase();
                      const dvText = dv.textContent.trim();
                      qualifierLabels.forEach((q) => {
                        const qCode = (q.getAttribute("code") || "").toUpperCase();
                        const qText = q.textContent.trim();

                        const fullCode =
                          sCode +
                          bsCode +
                          opCode +
                          bpCode +
                          apCode +
                          dvCode +
                          qCode;

                        const descParts = [
                          sText,
                          bsText,
                          opText,
                          bpText,
                          apText,
                          dvText,
                          qText,
                        ].filter(Boolean);
                        const description = descParts.join(" / ");

                        codes.push({ code: fullCode, desc: description });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });

      return codes;
    }

    // 建立合法組合 map（validMap）
    function buildValidMap() {
      validMap.clear();
      icdCodes.forEach(item => {
        const code = item.code;
        if (!code || code.length !== 7) return;
        const prefix = code.slice(0,3);
        const c4 = code[3];
        const c5 = code[4];
        const c6 = code[5];
        const c7 = code[6];
        if (!validMap.has(prefix)) {
          validMap.set(prefix, {
            body: new Set(),
            approach: new Set(),
            device: new Set(),
            qualifier: new Set(),
            combos: new Set(),
          });
        }
        const m = validMap.get(prefix);
        m.body.add(c4);
        m.approach.add(c5);
        m.device.add(c6);
        m.qualifier.add(c7);
        m.combos.add(code);
      });
    }

    // -------- Definitions XML 解析 --------
    function parseDefinitionsXml(xmlText) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "application/xml");
      const parserError = xmlDoc.querySelector("parsererror");
      if (parserError) {
        throw new Error(
          "Definitions XML 格式解析失敗，請確認檔案是否正確。"
        );
      }

      definitionMaps.bodypart.clear();
      definitionMaps.device.clear();

      const sections = Array.from(xmlDoc.getElementsByTagName("section"));
      sections.forEach((sec) => {
        const axes = Array.from(sec.getElementsByTagName("axis"));

        axes.forEach((axis) => {
          const pos = axis.getAttribute("pos");
          let kind = null;
          if (pos === "4") kind = "bodypart";
          else if (pos === "6") kind = "device";
          if (!kind) return;

          const termsList = Array.from(axis.getElementsByTagName("terms"));
          termsList.forEach((terms) => {
            const titleNodes = Array.from(terms.getElementsByTagName("title"));
            const defNode = terms.getElementsByTagName("definition")[0];
            const explNode = terms.getElementsByTagName("explanation")[0];
            const includeNodes = Array.from(
              terms.getElementsByTagName("includes")
            );

            const lines = [];
            if (defNode && defNode.textContent.trim()) {
              lines.push("Definition: " + defNode.textContent.trim());
            }
            if (explNode && explNode.textContent.trim()) {
              lines.push("Explanation: " + explNode.textContent.trim());
            }
            if (includeNodes.length) {
              lines.push("Includes:");
              includeNodes.forEach((inc) => {
                const t = inc.textContent.trim();
                if (t) lines.push(" - " + t);
              });
            }
            let detail = lines.join("\n");
            if (!detail) {
              detail = "No additional detail in definitions XML.";
            }

            titleNodes.forEach((tNode) => {
              const label = tNode.textContent.trim();
              if (label && !definitionMaps[kind].has(label)) {
                definitionMaps[kind].set(label, detail);
              }
            });
          });
        });
      });
    }

    // -------- Index XML 解析 --------
    function getDirectTitle(parent) {
      for (const child of Array.from(parent.children)) {
        if (child.tagName === "title") {
          return child.textContent.trim();
        }
      }
      return "";
    }

    function collectCodesFromNode(node) {
      const set = new Set();
      ["code", "codes", "tab"].forEach((tag) => {
        const els = node.getElementsByTagName(tag);
        Array.from(els).forEach((el) => {
          const raw = el.textContent.trim();
          if (!raw) return;
          raw.split(/[,;\s]+/).forEach((c) => {
            const t = c.trim().toUpperCase();
            if (t) set.add(t);
          });
        });
      });
      return Array.from(set);
    }

    function traverseIndexNode(node, path, entries) {
      const isMain = node.tagName === "mainTerm";
      const isTerm = node.tagName === "term";

      let newPath = path.slice();
      if (isMain || isTerm) {
        const t = getDirectTitle(node);
        if (t) {
          if (isMain) newPath = [t];
          else newPath.push(t);
        }
      }

      const codes = collectCodesFromNode(node);
      if (codes.length) {
        entries.push({
          path: newPath.join(" > "),
          codes,
        });
      }

      Array.from(node.children).forEach((child) => {
        if (child.tagName === "term") {
          traverseIndexNode(child, newPath, entries);
        }
      });
    }

    function parseIndexXml(xmlText) {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "application/xml");
      const parserError = xmlDoc.querySelector("parsererror");
      if (parserError) {
        throw new Error("Index XML 格式解析失敗，請確認檔案是否正確。");
      }
      
      // 【修正點 1：檢查 XML 根元素是否為 ICD10PCS.index】
      if (xmlDoc.documentElement.nodeName !== "ICD10PCS.index") {
          throw new Error("XML 結構錯誤：根元素不是 <ICD10PCS.index>。請確認您上傳的是 Index 檔案。");
      }

      const letters = Array.from(xmlDoc.getElementsByTagName("letter"));
      const entries = [];

      letters.forEach((letter) => {
        const mainTerms = Array.from(letter.getElementsByTagName("mainTerm"));
        mainTerms.forEach((mt) => {
          traverseIndexNode(mt, [], entries);
        });
      });

      return entries;
    }

    // -------- 上方完整 7 碼顯示 --------
    function updateSelectedCode() {
      if (!currentPrefix) {
        selectedCodeBox.textContent = "請先輸入前 3 碼並查詢。";
        return;
      }

      const { bodypart, approach, device, qualifier } = selections;

      if (!bodypart || !approach || !device || !qualifier) {
        selectedCodeBox.textContent =
          "請在下方四個欄位（Body Part、Approach、Device、Qualifier）各選一個選項。";
        return;
      }

      const fullCode =
        currentPrefix + bodypart + approach + device + qualifier;

      if (icdCodeMap.has(fullCode)) {
        const desc = icdCodeMap.get(fullCode) || "";
        selectedCodeBox.innerHTML =
          `目前選取代碼：<code style="font-size:1.1rem;font-weight:700;">${fullCode}</code><br>` +
          `<span style="font-size:0.83rem;color:#374151;">${desc}</span>`;
      } else {
        selectedCodeBox.innerHTML =
          `組合出的代碼：<code>${fullCode}</code><br>` +
          `<span style="font-size:0.83rem;color:#b91c1c;">此組合在 2023 PCS Tables 中不存在，請檢查選項。</span>`;
      }
    }

    // -------- 自動補齊「最可能組合」 --------
    function applyMostLikelyCombination() {
      if (!currentPrefix || !validMap.has(currentPrefix)) return;
      const vm = validMap.get(currentPrefix);
      const combos = Array.from(vm.combos);

      const { bodypart, approach, device, qualifier } = selections;

      const candidates = combos.filter(code => {
        return (!bodypart  || code[3] === bodypart) &&
               (!approach || code[4] === approach) &&
               (!device   || code[5] === device) &&
               (!qualifier|| code[6] === qualifier);
      });

      if (!candidates.length) return;

      const best = candidates[0];
      const b4 = best[3];
      const b5 = best[4];
      const b6 = best[5];
      const b7 = best[6];

      if (!bodypart)  selections.bodypart  = b4;
      if (!approach)  selections.approach  = b5;
      if (!device)    selections.device    = b6;
      if (!qualifier) selections.qualifier = b7;

      // 更新 radio 勾選狀態
      ["bodypart","approach","device","qualifier"].forEach(field => {
        const v = selections[field];
        if (!v) return;
        const input = document.querySelector(`input[name="${field}"][value="${v}"]`);
        if (input && !input.disabled) {
          input.checked = true;
        }
      });
    }

    // -------- 將不可能組合反灰 & disabled --------
    function filterInvalidOptions() {
      if (!currentPrefix || !validMap.has(currentPrefix)) return;
      const vm = validMap.get(currentPrefix);

      const bpSel = selections.bodypart;
      const apSel = selections.approach;
      const dvSel = selections.device;
      const qSel  = selections.qualifier;

      function isValidCombination(c4, c5, c6, c7) {
        const testCode = currentPrefix + c4 + c5 + c6 + c7;
        return vm.combos.has(testCode);
      }

      ["bodypart","approach","device","qualifier"].forEach(field => {
        const radios = document.querySelectorAll(`input[name="${field}"]`);
        radios.forEach(r => {
          const val = r.value;
          let ok = false;

          const bodyCandidates     = (field==="bodypart"  ? [val] : bpSel ? [bpSel] : Array.from(vm.body));
          const approachCandidates = (field==="approach"  ? [val] : apSel ? [apSel] : Array.from(vm.approach));
          const deviceCandidates   = (field==="device"    ? [val] : dvSel ? [dvSel] : Array.from(vm.device));
          const qualCandidates     = (field==="qualifier" ? [val] : qSel  ? [qSel]  : Array.from(vm.qualifier));

          outer:
          for (let c4 of bodyCandidates) {
            for (let c5 of approachCandidates) {
              for (let c6 of deviceCandidates) {
                for (let c7 of qualCandidates) {
                  if (isValidCombination(c4, c5, c6, c7)) {
                    ok = true;
                    break outer;
                  }
                }
              }
            }
          }

          r.disabled = !ok;
          r.parentElement.style.opacity = ok ? 1 : 0.35;
          if (!ok && r.checked) {
            r.checked = false;
          }
        });
      });
    }

    function applyMostLikelyAndFilter() {
      applyMostLikelyCombination();
      filterInvalidOptions();
      updateSelectedCode();
    }

    // -------- 渲染四欄表格 --------
    function renderAxisTable(matched, prefix, totalMatched) {
      if (!prefix) {
        resetTablePlaceholder("請在上方輸入前 3 碼。");
        setResultInfo("請輸入查詢條件。");
        resetSummaryHeader();
        resetSelections();
        return;
      }

      if (!matched.length) {
        resetTablePlaceholder("此前 3 碼沒有對應的組合。");
        setResultInfo(`「${prefix}」查無結果。`);
        summaryTitle.textContent = prefix;
        summaryDetail.innerHTML = `
          <div class="pcs-summary-row"><span><em>Section</em></span><span>—</span></div>
          <div class="pcs-summary-row"><span><em>Body System</em></span><span>—</span></div>
          <div class="pcs-summary-row"><span><em>Operation</em></span><span>—</span></div>
        `;
        resetSelections();
        return;
      }

      const bodyParts = new Map();
      const approaches = new Map();
      const devices = new Map();
      const qualifiers = new Map();
      let headerInfo = null;

      matched.forEach((item) => {
        const code = item.code || "";
        const parts = (item.desc || "").split(" / ");

        if (!headerInfo && parts.length >= 3) {
          headerInfo = {
            secCode: code[0],
            secText: parts[0] || "",
            bsCode: code[1],
            bsText: parts[1] || "",
            opCode: code[2],
            opText: parts[2] || "",
          };
        }

        const c4 = code[3];
        const c5 = code[4];
        const c6 = code[5];
        const c7 = code[6];

        const bpText = parts[3] || "";
        const apText = parts[4] || "";
        const dvText = parts[5] || "";
        const qText = parts[6] || "";

        if (c4 && bpText && !bodyParts.has(c4)) bodyParts.set(c4, bpText);
        if (c5 && apText && !approaches.has(c5)) approaches.set(c5, apText);
        if (c6 && dvText && !devices.has(c6)) devices.set(c6, dvText);
        if (c7 && qText && !qualifiers.has(c7)) qualifiers.set(c7, qText);
      });

      if (headerInfo) {
        summaryTitle.textContent = prefix;
        summaryDetail.innerHTML = `
          <div class="pcs-summary-row">
            <span><em>Section</em></span>
            <span><span class="pcs-summary-code">${headerInfo.secCode}</span>${headerInfo.secText}</span>
          </div>
          <div class="pcs-summary-row">
            <span><em>Body System</em></span>
            <span><span class="pcs-summary-code">${headerInfo.bsCode}</span>${headerInfo.bsText}</span>
          </div>
          <div class="pcs-summary-row">
            <span><em>Operation</em></span>
            <span><span class="pcs-summary-code">${headerInfo.opCode}</span>${headerInfo.opText}</span>
          </div>
        `;
      } else {
        summaryTitle.textContent = prefix;
      }

      const bpArr = Array.from(bodyParts.entries());
      const apArr = Array.from(approaches.entries());
      const dvArr = Array.from(devices.entries());
      const qArr = Array.from(qualifiers.entries());

      const maxLen = Math.max(
        bpArr.length,
        apArr.length,
        dvArr.length,
        qArr.length
      );

      if (maxLen === 0) {
        resetTablePlaceholder(
          "此前 3 碼沒有可組合的 Body Part / Approach / Device / Qualifier。"
        );
        return;
      }

      resultBody.innerHTML = "";

      for (let i = 0; i < maxLen; i++) {
        const [bpCode, bpText] = bpArr[i] || ["", ""];
        const [apCode, apText] = apArr[i] || ["", ""];
        const [dvCode, dvText] = dvArr[i] || ["", ""];
        const [qCode, qText] = qArr[i] || ["", ""];

        const bpTip = getDefinitionTooltip("bodypart", bpText);
        const dvTip = getDefinitionTooltip("device", dvText);

        const bpTitleAttr =
          bpCode && bpTip ? ` title="${escapeHtmlAttr(bpTip)}"` : "";
        const dvTitleAttr =
          dvCode && dvTip ? ` title="${escapeHtmlAttr(dvTip)}"` : "";

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            ${
              bpCode
                ? `<label class="option-row"${bpTitleAttr}>
                     <input type="radio" name="bodypart" value="${bpCode}">
                     <span><span class="option-code">${bpCode}</span>${bpText}</span>
                   </label>`
                : ""
            }
          </td>
          <td>
            ${
              apCode
                ? `<label class="option-row">
                     <input type="radio" name="approach" value="${apCode}">
                     <span><span class="option-code">${apCode}</span>${apText}</span>
                   </label>`
                : ""
            }
          </td>
          <td>
            ${
              dvCode
                ? `<label class="option-row"${dvTitleAttr}>
                     <input type="radio" name="device" value="${dvCode}">
                     <span><span class="option-code">${dvCode}</span>${dvText}</span>
                   </label>`
                : ""
            }
          </td>
          <td>
            ${
              qCode
                ? `<label class="option-row">
                     <input type="radio" name="qualifier" value="${qCode}">
                     <span><span class="option-code">${qCode}</span>${qText}</span>
                   </label>`
                : ""
            }
          </td>
        `;
        resultBody.appendChild(tr);
      }

      setResultInfo(
        `前 3 碼「${prefix}」共有 ${totalMatched.toLocaleString()} 組 7 碼代碼；下表為其 Body Part / Approach / Device / Qualifier 選項。`
      );

      resetSelections();        // 清空選擇
      filterInvalidOptions();   // 但此時皆為合法初始狀態
    }

    function doSearch() {
      const q = searchInput.value.trim().toUpperCase();

      if (!isLoaded) {
        resetTablePlaceholder("請先載入 Tables XML。");
        setResultInfo("尚未載入 Tables XML，無法查詢。");
        resetSummaryHeader();
        resetSelections();
        return;
      }

      if (!q || q.length < 3) {
        resetTablePlaceholder("請輸入完整前 3 碼再進行查詢。");
        setResultInfo("請輸入 3 碼的查詢條件。");
        resetSummaryHeader();
        resetSelections();
        currentPrefix = "";
        return;
      }

      const prefix = q.slice(0, 3);
      currentPrefix = prefix;

      const matched = icdCodes.filter((item) =>
        (item.code || "").startsWith(prefix)
      );

      renderAxisTable(matched, prefix, matched.length);
    }

    // -------- Index 搜尋顯示 --------
    function renderIndexResults(list, query) {
      if (!indexLoaded) {
        indexResultBox.innerHTML =
          '<div class="index-result-empty">尚未載入 Index XML，無法使用處置名稱查詢。</div>';
        return;
      }

      if (!query) {
        indexResultBox.innerHTML =
          '<div class="index-result-empty">請輸入處置名稱或關鍵字（至少 2 個字母）。</div>';
        return;
      }

      if (!list.length) {
        indexResultBox.innerHTML =
          '<div class="index-result-empty">「' +
          escapeHtmlAttr(query) +
          '」查無對應項目。</div>';
        return;
      }

      const limited = list.slice(0, 50);
      const parts = [];
      limited.forEach((item) => {
        const codes = item.codes || [];
        const codeHtml = codes
          .map(
            (c) =>
              `<span class="index-code-chip" data-code="${escapeHtmlAttr(
                c
              )}">${escapeHtmlAttr(c)}</span>`
          )
          .join("");
        parts.push(`
          <div class="index-result-item">
            <div class="index-path">${escapeHtmlAttr(item.path)}</div>
            <div class="index-codes">${codeHtml}</div>
          </div>
        `);
      });

      parts.push(
        `<div class="index-tip">共找到 ${
          list.length
        } 筆，僅顯示前 ${limited.length} 筆。點選代碼膠囊可帶入前三碼查詢。</div>`
      );

      indexResultBox.innerHTML = parts.join("");
    }

    function searchIndex() {
      const qRaw = indexSearchInput.value.trim();
      if (!indexLoaded) {
        renderIndexResults([], "");
        return;
      }
      if (!qRaw || qRaw.length < 2) {
        renderIndexResults([], "");
        return;
      }

      const q = qRaw.toLowerCase();
      const matches = indexEntries.filter((e) =>
        e.path.toLowerCase().includes(q)
      );
      renderIndexResults(matches, qRaw);
    }

    // -------- 檔案載入事件 (已移除檔案選擇器，改為自動載入) --------
    
    // ... (自動載入函數 loadTables(), loadDefinitions(), loadIndex() 保持不變) ...

    // 查詢事件
    searchInput.addEventListener("input", () => {
      doSearch();
    });
    searchInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        doSearch();
      }
    });

    indexSearchInput.addEventListener("input", () => {
      searchIndex();
    });
    indexSearchInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        searchIndex();
      }
    });

    // radio 選取：更新 selections + 自動補齊 + 濾掉非法
    resultBody.addEventListener("change", (e) => {
      const target = e.target;
      if (!target || target.type !== "radio") return;
      const name = target.name;
      if (name in selections) {
        selections[name] = target.value;
        applyMostLikelyAndFilter();
      }
    });

    // 點 Index 結果代碼 → 帶入前三碼並查詢
    indexResultBox.addEventListener("click", (e) => {
      const t = e.target;
      if (!t.classList.contains("index-code-chip")) return;
      const codeRaw = (t.dataset.code || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!codeRaw || codeRaw.length < 3) return;
      const prefix = codeRaw.slice(0, 3);
      searchInput.value = prefix;
      doSearch();
    });
  </script>
</body>
</html>