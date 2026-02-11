// ==============================
// 0. 基本設定 & 外部データ連携
// ==============================
const GAS_URL = "https://script.google.com/macros/s/AKfycbxoFy4gbs3xzGDhbgVcOE1OMLa4g2rbAxXSdgQxJziYCjokOzV0jpbKIiUtj8-cq7Py/exec";
const PRIORITY_LOSE_THRESHOLD = 3;

const IDOL_KEY = "idolTableData";
const PERF_KEY = "performerTableData";
const VOL_STORAGE_KEY = "volCount";
const VOL_STR_KEY = "volStringConfig";
const LOT_KEY = "lotteryTableData";

const PUCHUN_TOGGLE_KEY = "puchunEnabled";
const BRAND_TOGGLE_KEY = "brandEnabled";
const MUTE_TOGGLE_KEY = "muteEnabled";
const puchunToggle = document.getElementById("puchun-toggle");
const brandTggle = document.getElementById("brand-toggle");
const muteTggle = document.getElementById("mute-toggle");

let idolList = JSON.parse(localStorage.getItem(IDOL_KEY) || "[]");
let performerList = JSON.parse(localStorage.getItem(PERF_KEY) || "[]");
let count = Number(localStorage.getItem(VOL_STORAGE_KEY)) || 0;
let volConfig = JSON.parse(localStorage.getItem(VOL_STR_KEY) || '{"enabled":false, "text":""}');

let idolSortKey = "id", idolSortAsc = true;
let perfSortKey = "name", perfSortAsc = true;

// --- 保存処理 ---
function saveData() {
    localStorage.setItem(IDOL_KEY, JSON.stringify(idolList));
    localStorage.setItem(PERF_KEY, JSON.stringify(performerList));
    localStorage.setItem(VOL_STORAGE_KEY, count);
    localStorage.setItem(VOL_STR_KEY, JSON.stringify(volConfig));
    if (puchunToggle) {
        puchunToggle.checked = localStorage.getItem(PUCHUN_TOGGLE_KEY) === "true";
        puchunToggle.addEventListener("change", () => {
            localStorage.setItem(PUCHUN_TOGGLE_KEY, puchunToggle.checked);
        });
    }
    if (brandTggle) {
        brandTggle.checked = localStorage.getItem(BRAND_TOGGLE_KEY) === "true";
        brandTggle.addEventListener("change", () => {
            localStorage.setItem(BRAND_TOGGLE_KEY, brandTggle.checked);
        });
    }
    if (muteTggle) {
        muteTggle.checked = localStorage.getItem(MUTE_TOGGLE_KEY) === "true";
        muteTggle.addEventListener("change", () => {
            localStorage.setItem(MUTE_TOGGLE_KEY, muteTggle.checked);
        });
    }
}

// 抽選テーブル保存（ボタンの状態は保存せず、読み込み時に再構築する）
function saveLotteryTable() {
    const data = [];
    // 全ての #lottery-table 内の行を順番に取得
    const allRows = document.querySelectorAll("#lottery-table tbody tr");
    allRows.forEach(tr => {
        const idolHtml = tr.cells[1].querySelector("button") ? "" : tr.cells[1].innerHTML;
        data.push({
            winner: tr.cells[0].textContent,
            idol: idolHtml
        });
    });
    localStorage.setItem(LOT_KEY, JSON.stringify(data));
    
    const semiSelect = document.getElementById("semi-regular-select");
    if (semiSelect) localStorage.setItem("selectedSemiRegular", semiSelect.value);
}

// --- GAS連携 ---
async function loadFromSpreadsheet() {
    try {
        const response = await fetch(GAS_URL);
        const data = await response.json();
        
        if (data.idols) {
            idolList = data.idols.map(newItem => {
                const old = idolList.find(o => o.id === newItem.id);
                return { ...newItem, prev: old ? old.prev : false, done: old ? old.done : false };
            });
        }
        if (data.performers) {
            performerList = data.performers.map(p => {
                const loseCount = Number(p.loseCount) || 0;
                const lastWin = Number(p.lastWin) || 0;
                const lastBackup = Number(p.lastBackup) || 0;
                const lastJoin = Number(p.lastJoin) || 0;
                return {
                    exclude: (p.exclude === true || p.exclude === "TRUE"),
                    priority: (loseCount >= PRIORITY_LOSE_THRESHOLD || lastBackup > lastJoin),
                    confirmed: (lastWin > lastJoin),
                    name: p.name || "",
                    twitterId: p.twitterId || "",
                    joinCount: p.joinCount || 0,
                    loseCount: loseCount,
                    lastWin: lastWin,
                    lastBackup: lastBackup,
                    lastJoin: lastJoin
                };
            });
        }
        saveData();
        renderIdolTable();
        renderPerfTable();
        console.log("GAS同期完了");
    } catch (e) { console.error("GAS同期失敗:", e); }
}

async function syncToSpreadsheet() {
    try {
        const payload = idolList.map(i => ({ name: i.name, winCount: i.winCount || 0 }));
        await fetch(GAS_URL, { method: "POST", body: JSON.stringify(payload) });
    } catch (e) { console.error("GAS書き出し失敗:", e); }
}

// ==============================
// 1. UI描画
// ==============================

function updateView() {
    const countSpan = document.querySelector(".vol-count");
    const volLabel = document.querySelector(".vol-label");
    const vIn = document.getElementById("vol-string-input");
    const vEn = document.getElementById("vol-string-enable");
    const cInput = document.getElementById("count-input");

    if (cInput) count = Number(cInput.value);
    if (countSpan) countSpan.textContent = count;
    
    if (vEn && vIn && volLabel) {
        volConfig = { enabled: vEn.checked, text: vIn.value };
        if (volConfig.enabled && volConfig.text.trim() !== "") {
            volLabel.textContent = volConfig.text;
            if (countSpan) countSpan.style.display = "none";
        } else {
            volLabel.textContent = "Vol.";
            if (countSpan) countSpan.style.display = "inline";
        }
    }
    saveData();
}

function updateBackgroundColor(tabName) {
    const color = (tabName === "view") ? "#BCE981" : "#F4F4F4";
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
}

// アイドルテーブル
function renderIdolTable() {
    const tbody = document.querySelector("#idol-table tbody");
    if(!tbody) return;
    
    let displayList = [...idolList];
    const fPrev = document.getElementById("filter-prev")?.value || "all";
    const fDone = document.getElementById("filter-done")?.value || "all";
    const fBrand = document.getElementById("filter-brand")?.value || "all";

    displayList = displayList.filter(i => {
        if (fPrev !== "all" && String(i.prev) !== fPrev) return false;
        if (fDone !== "all" && String(i.done) !== fDone) return false;
        if (fBrand !== "all" && i.brand !== fBrand) return false;
        return true;
    });

    displayList.sort((a, b) => {
        let valA = a[idolSortKey], valB = b[idolSortKey];
        if (idolSortKey === "id" || idolSortKey === "winCount") {
            valA = Number(valA); valB = Number(valB);
        }
        return idolSortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    tbody.innerHTML = "";
    displayList.forEach(i => {
        const tr = document.createElement("tr");
        tr.dataset.id = i.id;
        tr.innerHTML = `
            <td><input type="checkbox" ${i.prev ? 'checked' : ''} onchange="updateIdolFlag('${i.id}', 'prev', this.checked)"></td>
            <td><input type="checkbox" ${i.done ? 'checked' : ''} onchange="updateIdolFlag('${i.id}', 'done', this.checked)"></td>
            <td>${i.name}</td>
            <td>${i.brand}</td>
            <td>${i.winCount || 0}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateIdolFlag(id, field, value) {
    const idol = idolList.find(i => String(i.id) === String(id));
    if (idol) { idol[field] = value; saveData(); }
}

// 演者テーブル
function renderPerfTable() {
    const tbody = document.querySelector("#performer-table tbody");
    if(!tbody) return;
    tbody.innerHTML = "";
    
    let displayList = [...performerList];
    displayList.sort((a, b) => {
        let valA = a[perfSortKey] || "", valB = b[perfSortKey] || "";
        return perfSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });

    displayList.forEach(p => {
        const tr = document.createElement("tr");
        tr.dataset.name = p.name;
        tr.innerHTML = `
            <td><input type="checkbox" class="exclude-btn" ${p.exclude ? 'checked' : ''}></td>
            <td><input type="checkbox" class="priority-btn" ${p.priority ? 'checked' : ''}></td>
            <td><input type="checkbox" class="confirmed-btn" ${p.confirmed ? 'checked' : ''}></td>
            <td>${p.name}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ==============================
// 2. 抽選ロジック
// ==============================

// 【修正】アイドルを3名（最大）選出して文字列で返す
function pickThreeIdols() {
    const candidates = idolList.filter(i => !i.prev && !i.done);
    if (candidates.length === 0) return "候補なし";
    
    const selectedNames = [];
    const selectedWinner = [];
    const countToPick = Math.min(3, candidates.length); // 最大3人、候補が少なければその人数

    const puchunEnabled = localStorage.getItem(PUCHUN_TOGGLE_KEY) === "true";
    const brandEnabled = localStorage.getItem(BRAND_TOGGLE_KEY) === "true";
    const randomFlg = Math.random() < 0.5;
    
    for (let i = 0; i < countToPick; i++) {
        // 毎回候補を再計算しないと、同じリストから重複して引く可能性があるため、
        // インデックス指定でspliceするのが確実ですが、今回は簡易的にランダムPick＆除外で実装
        const currentCandidates = idolList.filter(item => !item.prev && !item.done); // 直前のループでdoneになった人を除外
        if(currentCandidates.length === 0) break;
        
        const randomIndex = Math.floor(Math.random() * currentCandidates.length);
        const winner = currentCandidates[randomIndex];
        
        winner.done = true;
        winner.winCount = (winner.winCount || 0) + 1;
        selectedWinner.push(winner)
        selectedNames.push(getIdolDisplayHTML(winner, brandEnabled));
    }
    // デバッグ用
    console.log("抽選されたアイドル:", selectedWinner);

    // 封筒
    showDeresuteMovie(selectedWinner.some(item => item.id === 2046) && puchunEnabled && randomFlg);
    
    saveData();
    renderIdolTable();
    syncToSpreadsheet(); 
    return selectedNames.join(" / ");
}

// アイコン用HTML作成
function getIdolDisplayHTML(idol, brandFlg) {
    const iconBase = Math.floor(idol.id / 1000) * 1000;
    const fallbackPath = `image/etc/${iconBase}.png`;
    const idolPath = `image/idol/${idol.id}.png`;

    const iconPath = brandFlg ? fallbackPath : idolPath;

    return `
        <span class="idol-with-icon">
            <span class="idol-name">${idol.name}</span>
            <img
                src="${iconPath}"
                class="idol-icon"
                onerror="this.onerror=null;this.src='${fallbackPath}';"
            >
        </span>
    `;
}

// 封筒
function showDeresuteMovie(puchunFlg) {
    const overlay = document.getElementById("deresute-overlay");
    const deresute = document.getElementById("deresute-video");
    const muteEnabled = localStorage.getItem(MUTE_TOGGLE_KEY) === "true";
    if (!overlay || !deresute) return;

    overlay.style.display = "flex";

    deresute.currentTime = 0;
    deresute.muted = muteEnabled;   // オンオフ
    deresute.play();

    // 封筒終了 -> プチュン判定
    deresute.onended = () => {
        overlay.style.display = "none";
        if (puchunFlg) {
            showPuchunMovie()
        }
    };
}

// プチュン
function showPuchunMovie() {
    const overlay = document.getElementById("puchun-overlay");
    const puchun = document.getElementById("puchun-video");
    const muteEnabled = localStorage.getItem(MUTE_TOGGLE_KEY) === "true";
    if (!overlay || !puchun) return;

    overlay.style.display = "flex";
    
    puchun.currentTime = 0;
    puchun.muted = muteEnabled;   // オンオフ
    puchun.play();
    // ★ プチュン終了 -> click演出
    puchun.onended = () => {
        overlay.style.display = "none";
        showClickMovie();
    };
    // プチュン中クリックは無効（誤操作防止）
    overlay.onclick = null;
}

// CLICK
function showClickMovie() {
    const overlay = document.getElementById("click-overlay");
    const click = document.getElementById("click-video");
    const muteEnabled = localStorage.getItem(MUTE_TOGGLE_KEY) === "true";
    if (!overlay || !click) return;

    overlay.style.display = "flex";

    click.currentTime = 0;
    click.muted = muteEnabled;   // 自動再生対策
    click.loop = true;    // ★ ループ
    click.play();

    // クリックで終了
    overlay.onclick = () => {
        click.pause();
        overlay.style.display = "none";
    };
}


// 演者候補
function getCandidates(type) {
    let list = performerList.filter(p => p.name && p.name.trim() !== "" && !p.exclude);
    if (type === 'confirmed') return list.filter(p => p.confirmed);
    if (type === 'priority') return list.filter(p => p.priority);
    return list;
}

// 重複除外
function filterExistingWinners(candidates) {
    const currentWinners = Array.from(document.querySelectorAll("#lottery-table tbody tr"))
                                .map(r => r.cells[0].textContent.trim());
    return candidates.filter(p => !currentWinners.includes(p.name));
}

// 「抽選」ボタンをセルに配置する関数
function setLotteryButton(cell) {
    cell.innerHTML = '<button class="lottery-execution-btn">アイドル抽選</button>';
}

// 確定抽選（一括）
function executeLotteryBatch(candidates) {
    const rows = document.querySelectorAll("#lottery-table tbody tr");
    let available = filterExistingWinners(candidates);

    rows.forEach((row, idx) => {
        if (idx === 0) return; 
        if (row.cells[0].textContent.trim() === "" && available.length > 0) {
            row.cells[0].textContent = available.shift().name;
            setLotteryButton(row.cells[1]); // 文字ではなくボタンHTMLをセット
        }
    });
    saveLotteryTable();
}

// 優先・通常抽選（単発）
function executeLotterySingle(candidates) {
    const allRows = document.querySelectorAll("#lottery-table tbody tr");
    let available = filterExistingWinners(candidates);

    if (available.length === 0) {
        alert("候補者がいないか、全員選出済みです");
        return;
    }

    // 全てのテーブル行を上から順に見て、空いているところに一人入れる
    for (let i = 0; i < allRows.length; i++) {
        const row = allRows[i];
        // 1行目が準レギュラーで既に埋まっている場合はスキップされる
        if (row.cells[0].textContent.trim() === "") {
            const winner = available[Math.floor(Math.random() * available.length)];
            row.cells[0].textContent = winner.name;
            setLotteryButton(row.cells[1]);
            saveLotteryTable();
            return;
        }
    }
    alert("空いている枠がありません");
}

// ==============================
// 3. イベント設定
// ==============================
function initAllEvents() {
    // タブ切り替え
    document.querySelectorAll(".tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".tab, .tab-content").forEach(el => el.classList.remove("active"));
            tab.classList.add("active");
            const target = tab.getAttribute("data-tab");
            document.getElementById(`tab-${target}`).classList.add("active");
            updateBackgroundColor(target);
        });
    });

    // 準レギュラー設定
    document.getElementById("semi-regular-select")?.addEventListener("change", (e) => {
        // ID指定で当選枠の1行目を取得
        const mainTable = document.getElementById("lottery-table");
        const rows = mainTable ? mainTable.querySelectorAll("tbody tr") : [];
        if (rows.length > 0) {
            const val = e.target.value;
            rows[0].cells[0].textContent = val;
            if (val) {
                setLotteryButton(rows[0].cells[1]);
            } else {
                rows[0].cells[1].innerHTML = "";
            }
            saveLotteryTable();
        }
    });

    // 抽選実行ボタン（一括・単発）
    document.getElementById("btn-lot-confirmed")?.addEventListener("click", () => executeLotteryBatch(getCandidates('confirmed')));
    document.getElementById("btn-lot-priority")?.addEventListener("click", () => executeLotterySingle(getCandidates('priority')));
    document.getElementById("btn-lot-regular")?.addEventListener("click", () => executeLotterySingle(getCandidates('all')));

    // 結果リセット
    document.getElementById("clear-lottery")?.addEventListener("click", () => {
        if(!confirm("結果をリセットしますか？")) return;
        // 両方のテーブルの行を取得
        const rows = document.querySelectorAll("#lottery-table tbody tr, #lottery-table-backup tbody tr");
        rows.forEach((row, idx) => {
            row.cells[1].innerHTML = ""; 
            if (idx > 0) {
                row.cells[0].textContent = "";
            } else {
                // 準レギュラー（1行目）の復元判定
                if (row.cells[0].textContent.trim() !== "") {
                    setLotteryButton(row.cells[1]);
                }
            }
        });
        saveLotteryTable();
    });

    // 【重要】テーブル内の「抽選」ボタンクリック処理（イベント委譲）
    // 親要素の lottery-container で検知することで補欠枠のボタンにも対応
    document.getElementById("lottery-container")?.addEventListener("click", (e) => {
        if (e.target.tagName === "BUTTON" && e.target.textContent === "アイドル抽選") {
            const cell = e.target.closest("td");
            const name = cell.previousElementSibling.textContent.trim();
            
            if (name !== "") {
                const result = pickThreeIdols(); 
                cell.innerHTML = result; 
                saveLotteryTable();
            }
        }
    });

    // GAS連携ボタン
    document.getElementById("btn-import")?.addEventListener("click", loadFromSpreadsheet);
    document.getElementById("btn-export")?.addEventListener("click", async () => {
        if(confirm("GASへ同期しますか？")) { await syncToSpreadsheet(); alert("完了"); }
    });

    // 管理操作
    document.getElementById("clear-performer-table")?.addEventListener("click", () => {
        if(confirm("全削除しますか？")) { performerList = []; saveData(); renderPerfTable(); }
    });
    document.getElementById("clear-idol-checkboxes")?.addEventListener("click", () => {
        idolList.forEach(i => {
            i.prev = false;
            i.done = false;
        });
        saveData();
        renderIdolTable();
    });
    document.getElementById("reset-sort-id")?.addEventListener("click", () => {
        idolSortKey = "id"; idolSortAsc = true; renderIdolTable();
    });

    // CSVインポート
    const csvInput = document.getElementById("csv-file");
    if(csvInput) {
        csvInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const lines = ev.target.result.split(/\r\n|\n/).slice(1);
                performerList = lines.map(line => {
                    const cols = line.split(",");
                    if(cols.length < 1) return null;
                    return { name: cols[0].trim(), exclude:false, priority:false, confirmed:false };
                }).filter(x=>x);
                saveData(); renderPerfTable();
                alert("CSVインポート完了");
            };
            reader.readAsText(file);
        });
    }

    // ソートとフィルタの初期化
    document.querySelectorAll("th[data-sort]").forEach(th => {
        th.addEventListener("click", () => {
            const tableId = th.closest("table").id;
            const key = th.dataset.sort;
            if (tableId === "idol-table") {
                if (idolSortKey === key) idolSortAsc = !idolSortAsc;
                else { idolSortKey = key; idolSortAsc = true; }
                renderIdolTable();
            } else if (tableId === "performer-table") {
                if (perfSortKey === key) perfSortAsc = !perfSortAsc;
                else { perfSortKey = key; perfSortAsc = true; }
                renderPerfTable();
            }
        });
    });

    ["filter-prev", "filter-done", "filter-brand"].forEach(id => {
        document.getElementById(id)?.addEventListener("change", renderIdolTable);
    });
}

// ==============================
// 4. 起動処理
// ==============================
window.addEventListener("DOMContentLoaded", async () => {
    initAllEvents();
    
    // UI復元
    const vIn = document.getElementById("vol-string-input");
    const vEn = document.getElementById("vol-string-enable");
    const cIn = document.getElementById("count-input");
    if(vIn) vIn.value = volConfig.text;
    if(vEn) vEn.checked = volConfig.enabled;
    if(cIn) cIn.value = count;
    [vIn, vEn, cIn].forEach(el => el?.addEventListener("input", updateView));

    // 抽選表の復元
    const savedLot = JSON.parse(localStorage.getItem(LOT_KEY) || "[]");
    const rows = document.querySelectorAll("#lottery-table tbody tr");
    rows.forEach((r, idx) => {
        if(savedLot[idx]) {
            r.cells[0].textContent = savedLot[idx].winner || "";
            // アイドル欄：保存されたテキストがあれば表示、なければ（かつ名前があれば）ボタンを出す
            if (savedLot[idx].idol) {
                r.cells[1].innerHTML = savedLot[idx].idol;
            } else if (r.cells[0].textContent !== "") {
                setLotteryButton(r.cells[1]);
            } else {
                r.cells[1].innerHTML = "";
            }
        }
    });

    const savedSemi = localStorage.getItem("selectedSemiRegular");
    const semiSelect = document.getElementById("semi-regular-select");
    if (semiSelect && savedSemi) semiSelect.value = savedSemi;

    updateView();
    renderIdolTable();
    renderPerfTable();
    updateBackgroundColor("view");

    await loadFromSpreadsheet();
});