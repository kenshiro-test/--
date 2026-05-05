/**
 * Dream Planner - Main App Logic (V6 - Multi-Plan & One Screen)
 */

// 互換性重視 (ES5)
var selectedDate = new Date().toISOString().split('T')[0];
var currentMode = 'select'; 
var pixelsPerMinute = 1; 

var COLORS = [
    '#6c5ce7', '#e84393', '#00cec9', '#fab1a0', '#00b894', 
    '#0984e3', '#fdcb6e', '#fd79a8', '#55efc4', '#74b9ff'
];

var ELEMENTS = {};

// 成功時にエラーバーを隠す
function hideError() {
    var err = document.getElementById('error-display');
    if (err) err.style.display = 'none';
}

function showError(msg) {
    var err = document.getElementById('error-display');
    var msgSpan = document.getElementById('error-message');
    if (err && msgSpan) {
        err.style.display = 'block';
        msgSpan.innerText = "エラー: " + msg;
    }
}

window.onerror = function(msg, url, line) {
    showError(msg + " (Line: " + line + ")");
    return false;
};

window.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded");
    init();
});

function init() {
    try {
        hideError(); // ここまで来ればJSは動いている
        // 要素の取得（DOM準備完了後）
        ELEMENTS = {
            planDate: document.getElementById('plan-date'),
            parkOpen: document.getElementById('plan-park-open'),
            parkClose: document.getElementById('plan-park-close'),
            btnConfirmHours: document.getElementById('btn-confirm-hours'),
            btnConfig: document.getElementById('btn-config'),
            configPanel: document.getElementById('config-panel'),
            btnCloseConfig: document.getElementById('btn-close-config'),
            masterEventList: document.getElementById('master-event-list'),
            btnAddEvent: document.getElementById('btn-add-event'),
            patternList: document.getElementById('pattern-list'),
            btnAddPattern: document.getElementById('btn-add-pattern'),
            timelineTitle: document.getElementById('timeline-title'),
            modeBtns: {
                select: document.getElementById('btn-mode-select'),
                refine: document.getElementById('btn-mode-refine')
            },
            btnSaveImage: document.getElementById('btn-save-image'),
            timelineContainer: document.getElementById('items-win'),
            timelineRuler: document.getElementById('ruler-win'),
            captureArea: document.getElementById('capture-area'),
            modal: document.getElementById('schedule-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalInputs: document.getElementById('modal-inputs'),
            btnConfirmAdd: document.getElementById('btn-confirm-add'),
            btnCancelAdd: document.getElementById('btn-cancel-add')
        };

        if (ELEMENTS.planDate) ELEMENTS.planDate.value = selectedDate;
        
        const hours = dataManager.getParkHours();
        if (ELEMENTS.parkOpen) ELEMENTS.parkOpen.value = hours.open;
        if (ELEMENTS.parkClose) ELEMENTS.parkClose.value = hours.close;

        renderPatternList();
        renderMasterEvents();
        
        setTimeout(() => {
            renderTimeline();
        }, 200);

        setupEventListeners();
    } catch (e) {
        console.error("Initialization failed:", e);
    }
}

function setupEventListeners() {
    const reg = (id, event, fn) => {
        const el = document.getElementById(id);
        if (el) el.addEventListener(event, fn);
    };

    reg('plan-date', 'change', (e) => {
        selectedDate = e.target.value;
        renderPatternList();
        renderTimeline();
    });

    reg('btn-confirm-hours', 'click', () => {
        dataManager.setParkHours(ELEMENTS.parkOpen.value, ELEMENTS.parkClose.value);
        renderTimeline();
    });

    if (ELEMENTS.btnConfig) {
        ELEMENTS.btnConfig.onclick = () => ELEMENTS.configPanel.classList.remove('hidden');
    }
    if (ELEMENTS.btnCloseConfig) {
        ELEMENTS.btnCloseConfig.onclick = () => ELEMENTS.configPanel.classList.add('hidden');
    }

    reg('btn-add-pattern', 'click', () => {
        const name = prompt("パターンの名前を入力してください");
        if (name) {
            const newId = dataManager.addPattern(selectedDate, name);
            dataManager.setCurrentPatternId(newId);
            renderPatternList();
            renderTimeline();
        }
    });

    if (ELEMENTS.modeBtns.select) ELEMENTS.modeBtns.select.onclick = () => setMode('select');
    if (ELEMENTS.modeBtns.refine) ELEMENTS.modeBtns.refine.onclick = () => setMode('refine');

    if (ELEMENTS.btnSaveImage) ELEMENTS.btnSaveImage.onclick = saveAsImage;

    reg('btn-reset-data', 'click', () => {
        if (confirm("本当に初期化しますか？")) {
            localStorage.clear();
            location.reload();
        }
    });

    if (ELEMENTS.btnAddEvent) ELEMENTS.btnAddEvent.onclick = addMasterEvent;
    if (ELEMENTS.btnCancelAdd) ELEMENTS.btnCancelAdd.onclick = () => ELEMENTS.modal.classList.add('hidden');
}

// --- Utils ---

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function checkOverlap(items, newItem) {
    const startA = timeToMinutes(newItem.time);
    const endA = startA + (newItem.duration || 30);

    for (const item of items) {
        // 同じマスタの別の時間は許可しない（選択肢の中から一つ選ぶため）
        // ただしカスタム項目同士は許可する
        const startB = timeToMinutes(item.time);
        const endB = startB + (item.duration || 30);

        if (startA < endB && endA > startB) {
            return item.name; // 重複している項目の名前を返す
        }
    }
    return null;
}

// --- Rendering ---

function setMode(mode) {
    currentMode = mode;
    ELEMENTS.modeBtns.select.classList.toggle('active', mode === 'select');
    ELEMENTS.modeBtns.refine.classList.toggle('active', mode === 'refine');
    ELEMENTS.timelineTitle.innerText = mode === 'select' ? 'ショー・パレードを選択' : '予定を追加してしおりを完成';
    renderTimeline();
}

function renderPatternList() {
    const patterns = dataManager.getPlans(selectedDate);
    ELEMENTS.patternList.innerHTML = patterns.map(p => `
        <button class="pattern-btn ${p.id === dataManager.currentPatternId ? 'active' : ''}" 
                onclick="switchPattern(${p.id})">
            ${p.name}
            ${patterns.length > 1 ? `<span onclick="deletePattern(event, ${p.id})" style="margin-left:5px; opacity:0.5;">×</span>` : ''}
        </button>
    `).join('');
}

window.switchPattern = (id) => {
    dataManager.setCurrentPatternId(id);
    renderPatternList();
    renderTimeline();
};

window.deletePattern = (e, id) => {
    e.stopPropagation();
    if (confirm("このパターンを削除しますか？")) {
        dataManager.removePattern(selectedDate, id);
        dataManager.setCurrentPatternId(0);
        renderPatternList();
        renderTimeline();
    }
};

function renderTimeline() {
    console.log("Starting renderTimeline...");
    const patterns = dataManager.getPlans(selectedDate);
    const pattern = patterns.find(p => p.id === dataManager.currentPatternId) || patterns[0] || { items: [] };
    const masterEvents = dataManager.getMasterEvents() || [];
    const parkHours = dataManager.getParkHours() || { open: "09:00", close: "21:00" };
    
    const startTotalMinutes = timeToMinutes(parkHours.open);
    const endTotalMinutes = timeToMinutes(parkHours.close);
    const durationMinutes = Math.max(endTotalMinutes - startTotalMinutes, 60);

    // 1画面に収めるためのスケール計算
    const viewArea = document.querySelector('.timeline-view');
    let containerHeight = viewArea ? viewArea.clientHeight : 0;
    if (containerHeight <= 0) containerHeight = window.innerHeight - 200;
    if (containerHeight <= 0) containerHeight = 600; // 最終手段の固定値

    const headerHeight = 100;
    const availableHeight = Math.max(containerHeight - headerHeight, 300); 
    pixelsPerMinute = availableHeight / durationMinutes;

    // Ruler描画
    let rulerHtml = `<div class="ruler-spacer" style="height:${headerHeight}px"></div>`;
    for (let m = startTotalMinutes; m <= endTotalMinutes; m += 60) {
        const top = (m - startTotalMinutes) * pixelsPerMinute + headerHeight;
        rulerHtml += `<div class="hour-mark" style="top:${top}px">${Math.floor(m/60)}:00</div>`;
    }
    ELEMENTS.timelineRuler.innerHTML = rulerHtml;

    // Lanes描画
    ELEMENTS.timelineContainer.innerHTML = '';
    
    if (currentMode === 'select') {
        masterEvents.forEach((master, index) => {
            const lane = createLane(master, index, headerHeight);
            const itemsArea = lane.querySelector('.lane-items');
            
            master.times.forEach(time => {
                const isSelected = pattern.items.some(p => p.masterId === master.id && p.time === time);
                renderItem(itemsArea, { ...master, time, masterId: master.id }, isSelected, startTotalMinutes, -1);
            });
            ELEMENTS.timelineContainer.appendChild(lane);
        });
    } else {
        // 予定追加モード：選択された項目があるレーンのみ表示
        masterEvents.forEach((master, index) => {
            const showItems = pattern.items.filter(item => item.masterId === master.id);
            if (showItems.length > 0) {
                const lane = createLane(master, index, headerHeight);
                const itemsArea = lane.querySelector('.lane-items');
                showItems.forEach(item => {
                    renderItem(itemsArea, { ...item }, true, startTotalMinutes, pattern.items.indexOf(item));
                });
                ELEMENTS.timelineContainer.appendChild(lane);
            }
        });

        // 「その他」レーン
        const otherItems = pattern.items.filter(item => !masterEvents.find(m => m.id === item.masterId));
        if (otherItems.length > 0) {
            const lane = createLane({ name: "その他", imageUrl: "" }, 99, headerHeight);
            const itemsArea = lane.querySelector('.lane-items');
            otherItems.forEach(item => {
                renderItem(itemsArea, { ...item }, true, startTotalMinutes, pattern.items.indexOf(item));
            });
            ELEMENTS.timelineContainer.appendChild(lane);
        }
    }
}

function createLane(master, index, headerHeight) {
    const color = COLORS[index % COLORS.length];
    const lane = document.createElement('div');
    lane.className = 'timeline-lane';
    lane.innerHTML = `
        <div class="lane-label" style="height:${headerHeight}px">
            <div class="label-row-1">
                ${master.imageUrl ? `<img src="${master.imageUrl}" alt="">` : '<div style="width:50px;height:50px;background:#222;border-radius:4px;"></div>'}
            </div>
            <div class="label-row-2">
                <div class="show-name" style="color:${color}">${master.name}</div>
                ${master.duration ? `<div class="show-meta">⏱️${master.duration}分</div>` : ''}
            </div>
        </div>
        <div class="lane-items"></div>
    `;
    if (currentMode === 'refine') {
        lane.querySelector('.lane-items').onclick = (e) => {
            if (e.target === e.currentTarget) openAddModal();
        };
    }
    return lane;
}

function renderItem(container, item, isSelected, startTotalMinutes, realIndex) {
    const itemMinutes = timeToMinutes(item.time);
    const duration = item.duration || 30;
    const top = (itemMinutes - startTotalMinutes) * pixelsPerMinute;
    const height = duration * pixelsPerMinute;

    const div = document.createElement('div');
    div.className = `scheduled-item ${isSelected ? 'selected' : 'unselected'}`;
    div.style.top = `${top}px`;
    div.style.height = `${Math.max(height, 20)}px`;
    
    const masterEvents = dataManager.getMasterEvents();
    const masterIndex = masterEvents.findIndex(m => m.id === item.masterId);
    const color = COLORS[masterIndex >= 0 ? masterIndex % COLORS.length] : '#999';
    
    if (isSelected) {
        div.style.backgroundColor = color;
    } else {
        div.style.borderColor = color;
        div.style.color = color;
    }

    const endTime = formatTime(itemMinutes + duration);

    div.innerHTML = `
        <div class="item-content">
            <span class="item-time">${item.time}${currentMode === 'refine' ? ` - ${endTime}` : ''}</span>
            ${currentMode === 'refine' ? `<span class="item-name">${item.name}</span>` : ''}
        </div>
        ${realIndex !== -1 ? `<span class="btn-remove" onclick="removeItem(${realIndex})">×</span>` : ''}
    `;

    div.onclick = (e) => {
        e.stopPropagation();
        if (e.target.classList.contains('btn-remove')) return;
        
        if (currentMode === 'select') {
            toggleSelection(item);
        } else if (realIndex !== -1) {
            openEditModal(realIndex, item);
        }
    };

    container.appendChild(div);
}

function toggleSelection(item) {
    const patterns = dataManager.getPlans(selectedDate);
    const patternIdx = patterns.findIndex(p => p.id === dataManager.currentPatternId);
    const pattern = patterns[patternIdx >= 0 ? patternIdx : 0];
    
    const idx = pattern.items.findIndex(p => p.masterId === item.masterId && p.time === item.time);
    
    if (idx === -1) {
        const overlapName = checkOverlap(pattern.items, item);
        if (overlapName) {
            alert(`「${overlapName}」と時間が重なっているため選択できません。`);
            return;
        }
        pattern.items.push({ ...item });
    } else {
        pattern.items.splice(idx, 1);
    }
    
    pattern.items.sort((a, b) => a.time.localeCompare(b.time));
    dataManager.savePlan(selectedDate, patterns); // 変更済みの配列全体を保存
    renderTimeline();
}

window.removeItem = (index) => {
    const patterns = dataManager.getPlans(selectedDate);
    const pattern = patterns.find(p => p.id === dataManager.currentPatternId) || patterns[0];
    pattern.items.splice(index, 1);
    dataManager.savePlan(selectedDate, patterns);
    renderTimeline();
};

// --- Modals ---

function openAddModal() {
    renderModalInputs(null);
    ELEMENTS.modalTitle.innerText = "予定を追加";
    ELEMENTS.modal.classList.remove('hidden');
    ELEMENTS.btnConfirmAdd.onclick = () => saveCustomItem(-1);
}

function openEditModal(index, item) {
    renderModalInputs(item);
    ELEMENTS.modalTitle.innerText = "予定を編集";
    ELEMENTS.modal.classList.remove('hidden');
    ELEMENTS.btnConfirmAdd.onclick = () => saveCustomItem(index);
}

function renderModalInputs(item) {
    ELEMENTS.modalInputs.innerHTML = `
        <div class="input-group">
            <label>予定名</label>
            <input type="text" id="modal-name" value="${item ? item.name : ''}" placeholder="昼食、アトラクションなど">
        </div>
        <div class="input-group">
            <label>開始時間</label>
            <input type="time" id="modal-time" value="${item ? item.time : ''}">
        </div>
        <div class="input-group">
            <label>所要時間（分）</label>
            <input type="number" id="modal-duration" value="${item ? item.duration : 30}">
        </div>
    `;
}

function saveCustomItem(index) {
    const name = document.getElementById('modal-name').value;
    const time = document.getElementById('modal-time').value;
    const duration = parseInt(document.getElementById('modal-duration').value);

    if (!name || !time) return;

    const patterns = dataManager.getPlans(selectedDate);
    const patternIdx = patterns.findIndex(p => p.id === dataManager.currentPatternId);
    const pattern = patterns[patternIdx >= 0 ? patternIdx : 0];

    const newItem = { name, time, duration, masterId: Date.now(), isCustom: true };

    if (index === -1) {
        const overlapName = checkOverlap(pattern.items, newItem);
        if (overlapName) {
            alert(`「${overlapName}」と時間が重なっています。`);
            return;
        }
        pattern.items.push(newItem);
    } else {
        const otherItems = pattern.items.filter((_, i) => i !== index);
        const overlapName = checkOverlap(otherItems, newItem);
        if (overlapName) {
            alert(`「${overlapName}」と時間が重なっています。`);
            return;
        }
        pattern.items[index] = newItem;
    }

    pattern.items.sort((a, b) => a.time.localeCompare(b.time));
    dataManager.savePlan(selectedDate, patterns); // 変更済みの配列全体を保存
    ELEMENTS.modal.classList.add('hidden');
    renderTimeline();
}

// --- Others ---

function saveAsImage() {
    const area = ELEMENTS.captureArea;
    html2canvas(area, {
        backgroundColor: "#000",
        scale: 2
    }).then(canvas => {
        const link = document.createElement('a');
        link.download = `dream_plan_${selectedDate}.png`;
        link.href = canvas.toDataURL();
        link.click();
    });
}

function renderMasterEvents() {
    const events = dataManager.getMasterEvents();
    ELEMENTS.masterEventList.innerHTML = events.map(e => `
        <li>
            <span>${e.name}</span>
            <button onclick="deleteMasterEvent(${e.id})">🗑️</button>
        </li>
    `).join('');
}

function addMasterEvent() {
    const name = document.getElementById('new-event-name').value;
    const times = document.getElementById('new-event-times').value.split(',').map(t => t.trim());
    const duration = parseInt(document.getElementById('new-event-duration').value);
    const imageUrl = document.getElementById('new-event-image').value;
    const isLottery = document.getElementById('new-event-lottery').checked;

    if (!name || !times[0]) return;

    dataManager.addMasterEvent({ name, times, duration, imageUrl, isLottery });
    renderMasterEvents();
    renderTimeline();
}

window.deleteMasterEvent = (id) => {
    dataManager.removeMasterEvent(id);
    renderMasterEvents();
    renderTimeline();
};

window.onresize = renderTimeline;

// 起動
// init(); // DOMContentLoadedで実行するためコメントアウト
