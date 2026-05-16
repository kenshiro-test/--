
        var DEFAULT_EVENTS = {
            land: [
                { id: 1, name: "ハーモニー・イン・カラー", times: ["12:45"], isLottery: true, imageUrl: "", duration: 45 },
                { id: 2, name: "エレクトリカルパレード", times: ["18:15"], isLottery: false, imageUrl: "", duration: 45 },
                { id: 4, name: "ジャンボリミッキー！", times: ["10:45", "12:00", "13:45", "15:00"], isLottery: true, imageUrl: "", duration: 15 },
                { id: 5, name: "マジカルミュージックワールド", times: ["10:50", "12:15", "13:40", "15:45", "17:10"], isLottery: true, imageUrl: "", duration: 25 },
                { id: 6, name: "クラブマウスビート", times: ["12:20", "13:45", "15:10", "17:15", "18:40"], isLottery: true, imageUrl: "", duration: 25 }
            ],
            sea: [
                { id: 3, name: "リーチ・フォー・ザ・スターズ", times: ["17:50", "20:15"], isLottery: true, imageUrl: "", duration: 20 },
                { id: 7, name: "ビリーヴ！〜シー・オブ・ドリームス〜", times: ["19:30"], isLottery: true, imageUrl: "", duration: 30 }
            ]
        };

        var DataManager = function () {
            this.key = 'dream_v3';
            this.init();
        };
        DataManager.prototype.init = function () {
            var s = localStorage.getItem(this.key);
            if (!s) { this.reset(); } else {
                try {
                    var p = JSON.parse(s);
                    // パーク別構造への移行
                    if (!p.parks) this.reset();
                    if (!p.parkHours || !p.parkHours.open || !p.parkHours.close) {
                        p.parkHours = { open: "09:00", close: "21:00" };
                    }
                    if (!p.parks.land) p.parks.land = {};
                    if (!p.parks.sea) p.parks.sea = {};
                    if (!Array.isArray(p.parks.land.masterEvents)) p.parks.land.masterEvents = DEFAULT_EVENTS.land;
                    if (!Array.isArray(p.parks.sea.masterEvents)) p.parks.sea.masterEvents = DEFAULT_EVENTS.sea;
                    if (!p.parks.land.plans) p.parks.land.plans = {};
                    if (!p.parks.sea.plans) p.parks.sea.plans = {};
                    if (!p.parks.land.dailySchedules) p.parks.land.dailySchedules = {};
                    if (!p.parks.sea.dailySchedules) p.parks.sea.dailySchedules = {};
                    if (!p.userNotes) {
                        p.userNotes = [];
                    }
                    localStorage.setItem(this.key, JSON.stringify(p));
                } catch (e) { this.reset(); }
            }
        };
        DataManager.prototype.reset = function () {
            var d = {
                parkHours: { open: "09:00", close: "21:00" },
                userNotes: [],
                parks: {
                    land: { masterEvents: DEFAULT_EVENTS.land, plans: {}, dailySchedules: {} },
                    sea: { masterEvents: DEFAULT_EVENTS.sea, plans: {}, dailySchedules: {} }
                }
            };
            this.save(d);
        };
        DataManager.prototype.get = function () { return JSON.parse(localStorage.getItem(this.key)); };
        DataManager.prototype.save = function (d) {
            localStorage.setItem(this.key, JSON.stringify(d));
            fetch('/api/data', { method: 'POST', body: JSON.stringify(d) }).catch(function (e) { });
        };
        DataManager.prototype.syncWithServer = function (callback) {
            var self = this;
            fetch('/api/data').then(function (res) { return res.json(); }).then(function (d) {
                if (d && d.parks) {
                    localStorage.setItem(self.key, JSON.stringify(d));
                }
                if (callback) callback();
            }).catch(function (e) {
                if (callback) callback();
            });
        };

        // パーク別データアクセスヘルパー
        function getParkData(d) {
            if (!d.parks) d.parks = {};
            if (!d.parks[state.park]) d.parks[state.park] = {};
            var pd = d.parks[state.park];
            if (!Array.isArray(pd.masterEvents)) pd.masterEvents = DEFAULT_EVENTS[state.park];
            if (!pd.plans) pd.plans = {};
            if (!pd.dailySchedules) pd.dailySchedules = {};
            return pd;
        }

        var dm = new DataManager();
        var state = {
            date: new Date().toISOString().split('T')[0],
            mode: 'select',
            pId: 0,
            px: 1,
            isAdmin: false,
            adminRequested: false,
            park: 'land',
            adminPark: 'land',
            adminShowId: null,
            adminDraftSchedules: {},// { showId: { date: [times] } }
            step: 'home',
            pickedShowIds: [], // ユーザーが選択したショーのID
            homePlanTab: 'all',
            homePreviewKey: null,
            homePreviewPlanIndex: {},
            calYear: new Date().getFullYear(),
            calMonth: new Date().getMonth(),
            steps7Editing: false
        };
        var COLORS = [
            '#4834d4', // 濃い紫
            '#be2edd', // 濃いピンク
            '#0097e6', // 鮮やかな青
            '#e67e22', // 濃いオレンジ
            '#27ae60', // 濃い緑
            '#2980b9', // 落ち着いた青
            '#c0392b', // 濃い赤
            '#8e44ad', // 濃い紫
            '#16a085', // 濃いティール
            '#2c3e50'  // ダークグレー
        ];

        function normalizeTimeInput(value) {
            var raw = String(value || '').trim();
            if (/^\d{4}$/.test(raw)) {
                raw = raw.slice(0, 2) + ':' + raw.slice(2);
            }
            if (!/^\d{1,2}:\d{2}$/.test(raw)) return '';
            var p = raw.split(':');
            var h = parseInt(p[0], 10);
            var m = parseInt(p[1], 10);
            if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return '';
            return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        }

        function timeToInputDigits(t) {
            var normalized = normalizeTimeInput(t);
            return normalized ? normalized.replace(':', '') : '';
        }

        function timeToMin(t) { var p = normalizeTimeInput(t).split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); }
        function minToTime(m) { var h = Math.floor(m / 60), n = m % 60; return (h < 10 ? '0' + h : h) + ':' + (n < 10 ? '0' + n : n); }
        function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

        function formatPlanDate(dateStr) {
            var d = new Date(dateStr + 'T00:00:00');
            if (isNaN(d)) return dateStr;
            var week = ['日', '月', '火', '水', '木', '金', '土'];
            return (d.getMonth() + 1) + '月' + d.getDate() + '日(' + week[d.getDay()] + ')';
        }

        function countPlanItems(plans) {
            var total = 0;
            (plans || []).forEach(function (p) { total += (p.items || []).length; });
            return total;
        }

        function defaultSteps7() {
            return [
                { no: 1, enabled: true, title: 'DPA（アトラクション有料パス）', memo: '' },
                { no: 2, enabled: true, title: 'スタンバイパス', memo: '' },
                { no: 3, enabled: true, title: 'プライオリティパス（アトラクション無料パス）', memo: '' },
                { no: 4, enabled: true, title: 'DPA（ショー&パレード有料パス）', memo: '' },
                { no: 5, enabled: true, title: 'レストラン当日予約', memo: '' },
                { no: 6, enabled: true, title: 'レストラン、モバイルオーダー', memo: '' },
                { no: 7, enabled: true, title: 'ショーエントリー抽選', memo: '' }
            ];
        }

        function escapeHtml(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function formatStepTitleDisplay(title) {
            return escapeHtml(String(title || ''));
        }

        function checkAdminStatus(callback) {
            fetch('/api/admin/status', { cache: 'no-store' })
                .then(function (res) { return res.json(); })
                .then(function (status) { callback(status || { available: false, authenticated: false }); })
                .catch(function () { callback({ available: false, authenticated: false }); });
        }

        function loginAdmin(password, callback) {
            fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: password })
            })
                .then(function (res) {
                    if (!res.ok) return res.json().then(function (body) { throw body; });
                    return res.json();
                })
                .then(function () { callback(true); })
                .catch(function () { callback(false); });
        }

        function logoutAdmin() {
            fetch('/api/admin/logout', { method: 'POST' }).catch(function () { });
            state.isAdmin = false;
            state.adminShowId = null;
            document.getElementById('admin-dashboard').style.display = 'none';
            if (state.adminRequested) {
                showAdminLogin('');
            } else {
                document.getElementById('btn-admin').style.display = 'none';
                document.getElementById('btn-admin-entry').style.display = 'none';
                document.querySelector('.add-show-btn').style.display = 'none';
            }
        }

        function hidePublicScreens() {
            document.querySelectorAll('.step-container').forEach(function (el) { el.style.display = 'none'; });
            document.getElementById('app-main').style.display = 'none';
            document.getElementById('btn-admin-entry').style.display = 'none';
        }

        function showAdminLogin(message) {
            hidePublicScreens();
            document.getElementById('admin-dashboard').style.display = 'none';
            document.getElementById('admin-login-screen').style.display = 'flex';
            document.getElementById('admin-login-error').innerText = message || '';
            var input = document.getElementById('admin-login-password');
            input.value = '';
            setTimeout(function () { input.focus(); }, 0);
        }

        function hideAdminLogin() {
            document.getElementById('admin-login-screen').style.display = 'none';
        }

        function submitAdminLogin() {
            var input = document.getElementById('admin-login-password');
            var password = input.value;
            if (!password) {
                document.getElementById('admin-login-error').innerText = 'パスワードを入力してください。';
                return;
            }
            loginAdmin(password, function (ok) {
                if (ok) {
                    enableAdminUi();
                    openAdminDashboard();
                } else {
                    document.getElementById('admin-login-error').innerText = 'パスワードが違います。';
                    input.focus();
                }
            });
        }

        function enableAdminUi() {
            state.isAdmin = true;
            hideAdminLogin();
            var adminBtn = document.getElementById('btn-admin');
            var adminEntryBtn = document.getElementById('btn-admin-entry');
            adminBtn.style.display = '';
            adminBtn.onclick = openAdminDashboard;
            adminEntryBtn.style.display = '';
            adminEntryBtn.onclick = openAdminDashboard;
            document.querySelector('.add-show-btn').style.display = '';
            render();
        }

        function configureAdminEntry(isRequested) {
            var adminBtn = document.getElementById('btn-admin');
            var adminEntryBtn = document.getElementById('btn-admin-entry');
            var addShowBtn = document.querySelector('.add-show-btn');
            adminBtn.style.display = 'none';
            adminEntryBtn.style.display = 'none';
            addShowBtn.style.display = 'none';
            state.isAdmin = false;

            if (!isRequested) return;

            hidePublicScreens();
            checkAdminStatus(function (status) {
                if (!status.available) {
                    console.warn('Admin mode is disabled. Set ADMIN_PASSWORD on the server to enable it.');
                    showAdminLogin('管理者モードがサーバーで有効化されていません。');
                    return;
                }

                if (status.authenticated) {
                    enableAdminUi();
                    openAdminDashboard();
                    return;
                }

                showAdminLogin('');
                var requestLogin = function () {
                    submitAdminLogin();
                };
                adminBtn.onclick = requestLogin;
                adminEntryBtn.onclick = requestLogin;
            });
        }

        function init() {
            dm.syncWithServer(function () {
                var urlParams = new URLSearchParams(window.location.search);
                var adminRequested = urlParams.get('admin') === 'true';
                state.adminRequested = adminRequested;

                document.getElementById('app-main').style.visibility = 'visible';
                document.getElementById('plan-date').value = state.date;
                document.getElementById('plan-date').onchange = function (e) { state.date = e.target.value; render(); };
                document.getElementById('btn-config').onclick = function () { document.getElementById('modal-config').classList.remove('hidden'); };
                document.getElementById('btn-admin-login-submit').onclick = submitAdminLogin;
                document.getElementById('admin-login-password').onkeydown = function (e) {
                    if (e.key === 'Enter') submitAdminLogin();
                };

                document.getElementById('btn-park-land').onclick = function () { state.park = 'land'; state.pId = 0; updateParkButtons(); render(); };
                document.getElementById('btn-park-sea').onclick = function () { state.park = 'sea'; state.pId = 0; updateParkButtons(); render(); };

                configureAdminEntry(adminRequested);

                document.getElementById('btn-save-image').onclick = saveImage;
                document.getElementById('btn-share-image').onclick = shareImage;
                if (!adminRequested) renderHome();
            });
        }

        // --- Onboarding Logic ---
        function setHomePlanTab(tab) {
            state.homePlanTab = tab;
            document.getElementById('tab-all').classList.toggle('active', tab === 'all');
            document.getElementById('tab-current').classList.toggle('active', tab === 'current');
            document.getElementById('tab-past').classList.toggle('active', tab === 'past');
            renderHomePlans();
        }

        function openExistingPlan(date, park) {
            state.date = date;
            state.park = park || 'land';
            state.pId = 0;
            state.mode = 'refine';
            document.getElementById('plan-date').value = state.date;
            updateParkButtons();
            document.querySelectorAll('.step-container').forEach(function (el) { el.style.display = 'none'; });
            document.getElementById('app-main').style.display = 'flex';
            document.getElementById('app-main').style.visibility = 'visible';
            render();
        }

        function deleteSavedPlan(date, park) {
            if (!confirm(formatPlanDate(date) + 'を削除しますか？')) return;
            var d = dm.get();
            if (d.parks[park] && d.parks[park].plans) {
                delete d.parks[park].plans[date];
                dm.save(d);
            }
            renderHome();
        }

        function renderHome() {
            state.step = 'home';
            document.querySelectorAll('.step-container').forEach(function (el) { el.style.display = 'none'; });
            document.getElementById('step-home').style.display = 'flex';
            document.getElementById('app-main').style.display = 'none';
            renderHomePlans();
            renderHomeMemos7();
            renderHomeCalendar();
        }

        function renderHomePlans() {
            var d = dm.get();
            var list = document.getElementById('home-plan-list');
            var rows = [];
            ['land', 'sea'].forEach(function (park) {
                var plansByDate = d.parks[park].plans || {};
                Object.keys(plansByDate).forEach(function (date) {
                    var plans = plansByDate[date] || [];
                    if (plans.length === 0) return;
                    rows.push({ park: park, date: date, plans: plans, itemCount: countPlanItems(plans) });
                });
            });
            rows.sort(function (a, b) { return b.date.localeCompare(a.date); });
            var today = new Date().toISOString().split('T')[0];
            rows = rows.filter(function (row) {
                if (state.homePlanTab === 'current') return row.date >= today;
                if (state.homePlanTab === 'past') return row.date < today;
                return true;
            });
            if (rows.length === 0) {
                list.innerHTML = '<div class="home-empty">まだ予定がありません。カレンダーから日付を選んで作成できます。</div>';
                return;
            }
            list.innerHTML = rows.map(function (row) {
                var parkName = row.park === 'land' ? 'ランド' : 'シー';
                var parkIcon = row.park === 'land' ? '🏰' : '🌊';
                var key = row.park + '|' + row.date;
                var isPreviewOpen = state.homePreviewKey === key;
                return '<div class="plan-card ' + row.park + '">' +
                    '<div class="plan-row ' + row.park + '">' +
                    '<div><div class="plan-row-title">' + parkIcon + ' ' + formatPlanDate(row.date) + 'の予定</div>' +
                    '<div class="plan-row-meta">' + parkName + ' / ' + row.plans.length + 'パターン / ' + row.itemCount + '件の予定</div></div>' +
                    '<div class="plan-row-actions">' +
                    '<button class="mini-btn open" onclick="openExistingPlan(\'' + row.date + '\', \'' + row.park + '\')">開く</button>' +
                    '<button class="mini-btn preview" onclick="toggleHomePlanPreview(\'' + row.date + '\', \'' + row.park + '\')">' + (isPreviewOpen ? '閉じる' : '表示') + '</button>' +
                    '<button class="mini-btn delete" onclick="deleteSavedPlan(\'' + row.date + '\', \'' + row.park + '\')">削除</button>' +
                    '</div></div>' +
                    (isPreviewOpen ? renderHomePlanPreview(row.date, row.park, row.plans) : '') +
                    '</div>';
            }).join('');
        }

        function toggleHomePlanPreview(date, park) {
            var key = park + '|' + date;
            state.homePreviewKey = state.homePreviewKey === key ? null : key;
            if (state.homePreviewKey && state.homePreviewPlanIndex[key] === undefined) {
                state.homePreviewPlanIndex[key] = 0;
            }
            renderHomePlans();
        }

        function setHomePreviewPattern(date, park, idx) {
            var key = park + '|' + date;
            state.homePreviewKey = key;
            state.homePreviewPlanIndex[key] = idx;
            renderHomePlans();
        }

        function renderHomePlanPreview(date, park, plans) {
            var key = park + '|' + date;
            var activeIdx = state.homePreviewPlanIndex[key] || 0;
            if (activeIdx < 0 || activeIdx >= plans.length) activeIdx = 0;
            state.homePreviewPlanIndex[key] = activeIdx;
            var tabs = '';
            if (plans.length > 1) {
                tabs = '<div class="home-preview-tabs">' + plans.map(function (p, idx) {
                    return '<button class="home-preview-tab' + (idx === activeIdx ? ' active' : '') + '" onclick="setHomePreviewPattern(\'' + date + '\', \'' + park + '\', ' + idx + ')">' + escapeHtml(p.name || ('予定' + (idx + 1))) + '</button>';
                }).join('') + '</div>';
            }
            return '<div class="home-plan-preview">' + tabs + renderHomeMiniSchedule(plans[activeIdx]) + '</div>';
        }

        function renderHomeMiniSchedule(plan) {
            var d = dm.get();
            var open = d.parkHours && d.parkHours.open ? d.parkHours.open : '09:00';
            var close = d.parkHours && d.parkHours.close ? d.parkHours.close : '21:00';
            var start = timeToMin(open);
            var end = timeToMin(close);
            var items = (plan && Array.isArray(plan.items) ? plan.items : []).slice().sort(function (a, b) {
                return a.time.localeCompare(b.time);
            });
            var timePoints = [start, end];
            items.forEach(function (item) {
                if (!item.time) return;
                var s = timeToMin(item.time);
                var e = s + (item.duration || 30);
                if (!timePoints.includes(s)) timePoints.push(s);
                if (!timePoints.includes(e)) timePoints.push(e);
            });
            timePoints.sort(function (a, b) { return a - b; });
            var heights = [];
            for (var i = 0; i < timePoints.length - 1; i++) {
                var sTime = timePoints[i];
                var eTime = timePoints[i + 1];
                var dur = eTime - sTime;
                var hasItem = items.some(function (item) { return timeToMin(item.time) === sTime; });
                heights[i] = hasItem ? 58 : Math.max(dur * 0.26, 34);
            }
            var html = '<div class="home-mini-schedule">';
            var pos = 0;
            while (pos < timePoints.length - 1) {
                var cur = timePoints[pos];
                var item = items.find(function (candidate) { return timeToMin(candidate.time) === cur; });
                if (item) {
                    var durItem = item.duration || 30;
                    var itemEnd = cur + durItem;
                    var itemH = 0;
                    var itemSpan = 0;
                    while (pos + itemSpan < timePoints.length - 1 && timePoints[pos + itemSpan] < itemEnd) {
                        itemH += heights[pos + itemSpan];
                        itemSpan++;
                    }
                    html += '<div class="home-mini-cell" style="height:' + itemH + 'px;">' + renderHomeMiniItem(item) + '</div>';
                    pos += Math.max(itemSpan, 1);
                } else {
                    var nextItem = items.filter(function (candidate) { return timeToMin(candidate.time) > cur; })
                        .sort(function (a, b) { return timeToMin(a.time) - timeToMin(b.time); })[0];
                    var gapEnd = nextItem ? timeToMin(nextItem.time) : end;
                    var gapDur = gapEnd - cur;
                    var gapH = 0;
                    var gapSpan = 0;
                    while (pos + gapSpan < timePoints.length - 1 && timePoints[pos + gapSpan] < gapEnd) {
                        gapH += heights[pos + gapSpan];
                        gapSpan++;
                    }
                    html += '<div class="home-mini-cell" style="height:' + gapH + 'px;">' + renderHomeMiniGap(gapDur) + '</div>';
                    pos += Math.max(gapSpan, 1);
                }
            }
            html += '</div>';
            return html;
        }

        function renderHomeMiniItem(item) {
            var catColors = { show: '#6c5ce7', attraction: '#0097e6', food: '#e67e22', rest: '#95a5a6', other: '#27ae60' };
            var catIcons = { show: '🎶', attraction: '🎢', food: '🍽️', rest: '😴', other: '📌' };
            var color = catColors[item.cat] || catColors.other;
            var icon = catIcons[item.cat] || catIcons.other;
            var dur = item.duration || 30;
            return '<div class="home-mini-item" style="background:' + color + ';">' +
                '<div class="home-mini-item-top"><span class="home-mini-time">' + escapeHtml(item.time) + ' - ' + escapeHtml(minToTime(timeToMin(item.time) + dur)) + '</span><span>' + dur + '分</span></div>' +
                '<div class="home-mini-name">' + icon + ' ' + escapeHtml(item.name || '') + '</div>' +
                '</div>';
        }

        function renderHomeMiniGap(gapMin) {
            if (gapMin <= 0) return '';
            return '<div class="home-mini-gap">' +
                '<div class="home-mini-gap-line"><span style="position:absolute; top:-10px; left:50%; transform:translateX(-50%); font-size:10px; color:rgba(0,0,0,0.25);">▲</span><span style="position:absolute; bottom:-10px; left:50%; transform:translateX(-50%); font-size:10px; color:rgba(0,0,0,0.25);">▼</span></div>' +
                '<div class="home-mini-gap-label">' + gapMin + '分</div>' +
                '</div>';
        }

        function renderHomeMemos7() {
            var d = dm.get();
            if (!d.userNotes || typeof d.userNotes !== 'object' || Array.isArray(d.userNotes)) {
                d.userNotes = {};
            }
            if (!Array.isArray(d.userNotes.steps7) || d.userNotes.steps7.length === 0) {
                d.userNotes.steps7 = defaultSteps7();
                dm.save(d);
            }
            if (!d.userNotes.steps7ResetV2) {
                d.userNotes.steps7 = defaultSteps7();
                d.userNotes.steps7ResetV2 = true;
                dm.save(d);
            }
            var list = document.getElementById('home-memo-list7');
            var editing = !!state.steps7Editing;
            var rows = d.userNotes.steps7.filter(function (s) {
                return !!s.enabled;
            }).sort(function (a, b) { return a.no - b.no; });
            var editBtn = document.getElementById('btn-steps7-edit');
            if (editBtn) editBtn.innerText = editing ? '編集完了' : '編集';
            list.innerHTML = rows.map(function (s) {
                var actionHtml = editing
                    ? '<button class="mini-btn delete" onclick="deleteStep7Item(' + s.no + ')">削除</button>' +
                    '<button class="mini-btn open" onclick="moveStep7(' + s.no + ', -1)">↑</button>' +
                    '<button class="mini-btn open" onclick="moveStep7(' + s.no + ', 1)">↓</button>' +
                    '<button class="mini-btn open memo-add-btn7" onclick="addMemoToStep7(' + s.no + ')">メモ追加</button>' +
                    '<button class="mini-btn delete" onclick="clearMemoStep7(' + s.no + ')">メモ削除</button>'
                    : '<button class="mini-btn open memo-add-btn7" onclick="addMemoToStep7(' + s.no + ')">メモ追加</button>' +
                    '<button class="mini-btn delete" onclick="clearMemoStep7(' + s.no + ')">メモ削除</button>';
                return '<div class="task-row7">' +
                    '<div class="task-main7">' +
                    '<div class="task-no7">' + s.no + '</div>' +
                    '<div>' +
                    (editing
                        ? '<input class="task-input7" value="' + escapeHtml(s.title || '') + '" placeholder="例: DPA" oninput="updateStep7(' + s.no + ', \'title\', this.value)">'
                        : '<div class="task-title7">' + formatStepTitleDisplay(s.title || '') + '</div>') +
                    (editing || String(s.memo || '').trim() !== ''
                        ? (editing
                            ? '<input class="task-memo7" value="' + escapeHtml(s.memo || '') + '" placeholder="メモ" oninput="updateStep7(' + s.no + ', \'memo\', this.value)">'
                            : '<div class="task-memo-view7" onclick="addMemoToStep7(' + s.no + ')">' + escapeHtml(s.memo || '') + '</div>')
                        : '') +
                    '</div>' +
                    '</div>' +
                    '<div class="task-actions7">' + actionHtml + '</div>' +
                    '</div>';
            }).join('');
            if (rows.length === 0) list.innerHTML = '';
        }

        function updateStep7(no, key, value) {
            var d = dm.get();
            var step = (d.userNotes.steps7 || []).find(function (s) { return s.no === no; });
            if (!step) return;
            step[key] = value;
            dm.save(d);
        }

        function clearMemoStep7(no) {
            var d = dm.get();
            var step = (d.userNotes.steps7 || []).find(function (s) { return s.no === no; });
            if (!step) return;
            step.memo = '';
            dm.save(d);
            renderHomeMemos7();
        }

        function deleteStep7Item(no) {
            if (!confirm('この項目を削除しますか？')) return;
            var d = dm.get();
            var arr = (d.userNotes.steps7 || []).slice().sort(function (a, b) { return a.no - b.no; });
            arr = arr.filter(function (s) { return s.no !== no; });
            arr.forEach(function (s, idx) { s.no = idx + 1; });
            d.userNotes.steps7 = arr;
            dm.save(d);
            renderHomeMemos7();
        }

        function restoreStep7() {
            var d = dm.get();
            var step = (d.userNotes.steps7 || []).find(function (s) { return !s.enabled; });
            if (step) {
                step.enabled = true;
            } else {
                var maxNo = (d.userNotes.steps7 || []).reduce(function (m, s) { return Math.max(m, s.no || 0); }, 0);
                d.userNotes.steps7.push({ no: maxNo + 1, enabled: true, title: '', memo: '' });
            }
            dm.save(d);
            renderHomeMemos7();
        }

        function moveStep7(no, dir) {
            var d = dm.get();
            var arr = (d.userNotes.steps7 || []).slice().sort(function (a, b) { return a.no - b.no; });
            var idx = arr.findIndex(function (s) { return s.no === no; });
            if (idx === -1) return;
            var target = idx + dir;
            if (target < 0 || target >= arr.length) return;
            var tmp = arr[idx].no;
            arr[idx].no = arr[target].no;
            arr[target].no = tmp;
            d.userNotes.steps7 = arr;
            dm.save(d);
            renderHomeMemos7();
        }

        function toggleSteps7Edit() {
            state.steps7Editing = !state.steps7Editing;
            renderHomeMemos7();
        }

        function resetSteps7() {
            if (!confirm('入園後やることメモを初期状態に戻しますか？')) return;
            var d = dm.get();
            if (!d.userNotes || typeof d.userNotes !== 'object' || Array.isArray(d.userNotes)) d.userNotes = {};
            d.userNotes.steps7 = defaultSteps7();
            d.userNotes.steps7ResetV2 = true;
            dm.save(d);
            renderHomeMemos7();
        }

        function addMemoToStep7(no) {
            var d = dm.get();
            var step = (d.userNotes.steps7 || []).find(function (s) { return s.no === no; });
            if (!step) return;
            var next = prompt('メモを入力してください', step.memo || '');
            if (next === null) return;
            step.memo = next;
            dm.save(d);
            renderHomeMemos7();
        }

        function isHoliday(dateStr) {
            var ymd = ['2026-01-01', '2026-01-12', '2026-02-11', '2026-02-23', '2026-03-20', '2026-04-29', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06', '2026-07-20', '2026-08-11', '2026-09-21', '2026-09-22', '2026-09-23', '2026-10-12', '2026-11-03', '2026-11-23'];
            return ymd.includes(dateStr);
        }

        function renderHomeCalendar() {
            var wrap = document.getElementById('home-calendar');
            var year = state.calYear;
            var month = state.calMonth;
            var first = new Date(year, month, 1);
            var lastDate = new Date(year, month + 1, 0).getDate();
            var d = dm.get();
            var planDates = new Set();
            ['land', 'sea'].forEach(function (park) {
                Object.keys(d.parks[park].plans || {}).forEach(function (dt) { planDates.add(dt); });
            });
            var week = ['日', '月', '火', '水', '木', '金', '土'];
            var html = '<div class="cal-topbar" style="grid-column:1 / -1;">' +
                '<button class="home-btn secondary" onclick="moveCalendarMonth(-1)">◀</button>' +
                '<div class="cal-month">' + year + '年' + (month + 1) + '月</div>' +
                '<button class="home-btn secondary" onclick="moveCalendarMonth(1)">▶</button>' +
                '</div>';
            html += week.map(function (w, idx) {
                var cls = 'cal-week';
                if (idx === 0) cls += ' sun';
                if (idx === 6) cls += ' sat';
                return '<div class="' + cls + '">' + w + '</div>';
            }).join('');
            for (var i = 0; i < first.getDay(); i++) html += '<div></div>';
            for (var day = 1; day <= lastDate; day++) {
                var cur = new Date(year, month, day);
                var ds = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                var cls = 'cal-day';
                if (cur.getDay() === 0) cls += ' sun';
                if (cur.getDay() === 6) cls += ' sat';
                if (isHoliday(ds)) cls += ' holiday';
                if (planDates.has(ds)) cls += ' has-plan';
                html += '<button class="' + cls + '" onclick="selectCalendarDate(\'' + ds + '\')">' + day + '</button>';
            }
            wrap.innerHTML = html;
        }

        function moveCalendarMonth(delta) {
            state.calMonth += delta;
            if (state.calMonth < 0) { state.calMonth = 11; state.calYear -= 1; }
            if (state.calMonth > 11) { state.calMonth = 0; state.calYear += 1; }
            renderHomeCalendar();
        }

        function hasMissingAdminSchedules(ds) {
            var data = dm.get();
            var parks = ['land', 'sea'];
            for (var i = 0; i < parks.length; i++) {
                var park = parks[i];
                var pd = data.parks[park];
                var map = pd.dailySchedules && pd.dailySchedules[ds] ? pd.dailySchedules[ds] : {};
                for (var j = 0; j < pd.masterEvents.length; j++) {
                    var m = pd.masterEvents[j];
                    if (!Object.prototype.hasOwnProperty.call(map, String(m.id))) return true;
                }
            }
            return false;
        }

        function selectCalendarDate(ds) {
            if (hasMissingAdminSchedules(ds)) {
                alert('この日付はショー・パレードのスケジュールがまだ登録されていないため、予定を作成できません。');
                return;
            }
            var shouldOpen = true;
            try {
                if (typeof window.confirm === 'function') {
                    shouldOpen = window.confirm(formatPlanDate(ds) + 'の予定を作成しますか？');
                }
            } catch (e) {
                shouldOpen = true;
            }
            if (!shouldOpen) return;
            state.date = ds;
            state.pId = 0;
            state.mode = 'select';
            state.pickedShowIds = [];
            try {
                var dateInput = document.getElementById('plan-date');
                if (dateInput) dateInput.value = ds;
                openParkStepFromCalendar();
            } catch (e) {
                console.error('Failed to open park step:', e);
                renderHome();
            }
        }

        function openParkStepFromCalendar() {
            var home = document.getElementById('step-home');
            var park = document.getElementById('step-park');
            var appMain = document.getElementById('app-main');
            if (!home || !park) {
                alert('画面遷移に失敗しました。ページを再読み込みしてください。');
                return;
            }
            if (appMain) appMain.style.display = 'none';
            home.style.display = 'none';
            park.style.display = 'flex';
            state.step = 'park';
        }

        function nextStep(s) {
            if (s === 'home') {
                renderHome();
                return;
            }
            document.querySelectorAll('.step-container').forEach(function (el) { el.style.display = 'none'; });
            state.step = s;
            if (s === 'planner') {
                document.getElementById('app-main').style.display = 'flex';
                document.getElementById('app-main').style.visibility = 'visible';
                render();
            } else {
                document.getElementById('app-main').style.display = 'none';
                document.getElementById('step-' + s).style.display = 'flex';
                if (s === 'show-pick') renderShowPicker();
            }
        }

        function prevStep(s) {
            nextStep(s);
        }

        function selectStepPark(p) {
            state.park = p;
            document.getElementById('choice-land').className = 'park-choice-card' + (p === 'land' ? ' active' : '');
            document.getElementById('choice-sea').className = 'park-choice-card' + (p === 'sea' ? ' active' : '');
            updateParkButtons();
            setTimeout(function () { nextStep('show-pick'); }, 400);
        }

        function renderShowPicker() {
            var d = dm.get();
            var pd = getParkData(d);
            var dailyTimes = pd.dailySchedules[state.date] || {};
            var list = document.getElementById('show-picker-list');
            list.innerHTML = '';
            pd.masterEvents.forEach(function (m) {
                var item = document.createElement('div');
                item.className = 'show-picker-item';
                var isPicked = state.pickedShowIds.includes(m.id);

                var times = dailyTimes[m.id] || m.times;
                var timeStr = (times && times.length > 0) ? times.join('/') : '公演情報なし';
                var lotteryStr = m.isLottery ? '<span style="color:#f38ba8; margin-left:8px; font-size:11px; background:rgba(243,139,168,0.1); padding:2px 6px; border-radius:4px;">抽選要</span>' : '';

                item.innerHTML = '<input type="checkbox" ' + (isPicked ? 'checked' : '') + '>' +
                    '<div style="flex:1;">' +
                    '<div style="font-size:15px; font-weight:bold; color:var(--text-main);">' + m.name + '</div>' +
                    '<div style="font-size:12px; color:var(--text-dim); margin-top:4px; display:flex; align-items:center; flex-wrap:wrap;">' +
                    '🕒 ' + timeStr + lotteryStr +
                    '</div>' +
                    '</div>';

                item.onclick = function (e) {
                    var cb = item.querySelector('input');
                    if (e.target !== cb) cb.checked = !cb.checked;
                    if (cb.checked) {
                        if (!state.pickedShowIds.includes(m.id)) state.pickedShowIds.push(m.id);
                    } else {
                        state.pickedShowIds = state.pickedShowIds.filter(function (id) { return id !== m.id; });
                    }
                };
                list.appendChild(item);
            });
        }

        function toggleAllShows() {
            var d = dm.get();
            var pd = getParkData(d);
            var allIds = pd.masterEvents.map(function (m) { return m.id; });
            if (state.pickedShowIds.length === allIds.length) {
                state.pickedShowIds = [];
                document.getElementById('btn-select-all').innerText = '全選択';
            } else {
                state.pickedShowIds = allIds.slice();
                document.getElementById('btn-select-all').innerText = '全解除';
            }
            renderShowPicker();
        }

        function updateParkButtons() {
            document.getElementById('btn-park-land').className = 'pattern-btn' + (state.park === 'land' ? ' active' : '');
            document.getElementById('btn-park-sea').className = 'pattern-btn' + (state.park === 'sea' ? ' active' : '');
        }

        function showFatalError(message) {
            var box = document.getElementById('error-display');
            var text = document.getElementById('error-message');
            if (box && text) {
                text.innerText = String(message || '不明なエラーが発生しました');
                box.style.display = 'block';
            }
        }

        function render() {
            try {
                document.getElementById('error-display').style.display = 'none';
                var d = dm.get();
                if (!d.parkHours || !d.parkHours.open || !d.parkHours.close) {
                    d.parkHours = { open: "09:00", close: "21:00" };
                    dm.save(d);
                }
                var pd = getParkData(d);
                var plans = pd.plans[state.date] || [{ id: 0, name: "予定①", items: [] }];
                if (!Array.isArray(plans) || plans.length === 0) {
                    plans = [{ id: 0, name: "予定①", items: [] }];
                    pd.plans[state.date] = plans;
                    dm.save(d);
                }
                refreshPlanNames(plans); // 常に最新の連番に更新

                var activePlan = plans[0];
                for (var i = 0; i < plans.length; i++) { if (plans[i].id === state.pId) activePlan = plans[i]; }

                // モード別UI表示制御
                var parkSel = document.getElementById('park-selector');
                var planDate = document.getElementById('plan-date');
                if (state.mode === 'select') {
                    parkSel.style.display = 'none';
                    planDate.style.display = 'none';
                } else {
                    parkSel.style.display = 'none';
                    planDate.style.display = 'none';
                }

                var activePlan = plans[0];
                for (var i = 0; i < plans.length; i++) { if (plans[i].id === state.pId) activePlan = plans[i]; }

                var selTitle = document.getElementById('header-select-title');
                if (selTitle) selTitle.innerText = "ショー選択 (" + activePlan.name + ")";

                // Header Toggle
                document.getElementById('header-select').style.display = (state.mode === 'select' ? 'flex' : 'none');
                document.getElementById('header-refine').style.display = (state.mode === 'refine' ? 'flex' : 'none');

                // Tabs (Show only in select mode to switch plans)
                var tabs = document.getElementById('pattern-list');
                if (tabs) {
                    if (state.mode === 'select' && plans.length > 1) {
                        tabs.style.display = 'flex';
                        tabs.innerHTML = '';
                        plans.forEach(function (p) {
                            var b = document.createElement('button');
                            b.className = 'pattern-btn' + (p.id === state.pId ? ' active' : '');
                            b.innerText = p.name;
                            b.onclick = function () { state.pId = p.id; render(); };
                            tabs.appendChild(b);
                        });
                    } else {
                        tabs.style.display = 'none';
                    }
                }

                // Ruler & Pixels (Used in Select Mode)
                var ruler = document.getElementById('ruler-win');
                var start = timeToMin(d.parkHours.open), end = timeToMin(d.parkHours.close);
                var headerH = 150;

                // スクロールなしで1画面にすべて収めるための高さ計算
                var frame = document.querySelector('.view-frame');
                var h = frame.clientHeight;
                if (h < 300) h = 300; // 異常に小さい場合のみ最小値を保証
                state.px = (h - headerH) / (end - start);

                var win = document.getElementById('content-win');
                if (state.mode === 'select') {
                    ruler.style.display = 'block';
                    var rHtml = '<div style="height:' + headerH + 'px"></div>';
                    var gridHtml = '';
                    for (var m = start; m <= end; m += 60) {
                        var top = (m - start) * state.px + headerH;
                        rHtml += '<div class="hour-mark" style="top:' + top + 'px">' + Math.floor(m / 60) + ':00</div>';
                        gridHtml += '<div style="position:absolute; top:' + top + 'px; left:0; right:0; height:1px; background:rgba(0,0,0,0.05); z-index:1; pointer-events:none;"></div>';
                    }
                    ruler.innerHTML = rHtml;
                    win.innerHTML = gridHtml;
                    win.style.background = 'none';

                    var totalH = (end - start) * state.px + headerH + 20;
                    win.style.height = totalH + 'px';
                    ruler.style.height = totalH + 'px';

                    var maxBottom = totalH;
                    var dailyTimes = pd.dailySchedules[state.date] || {};
                    pd.masterEvents.forEach(function (m, idx) {
                        // ユーザーが選択したショーのみを表示（オンボーディングで選択）
                        if (state.pickedShowIds.length > 0 && !state.pickedShowIds.includes(m.id)) return;

                        var times = dailyTimes[m.id] || m.times;
                        // 当日の公演時間が1つも設定されていない場合は表示しない
                        if (!times || times.length === 0) return;

                        var lane = document.createElement('div'); lane.className = 'lane';
                        lane.innerHTML = '<div class="lane-label" style="height:' + headerH + 'px; justify-content:center;">' +
                            '<div class="show-name" style="color:' + COLORS[idx % COLORS.length] + '">' + m.name + '</div>' +
                            '<div class="show-info">⏱️' + m.duration + '分' + (m.isLottery ? ' | 🎟️要抽選' : '') + '</div></div>' +
                            '<div class="items-container"></div>';
                        if (state.isAdmin) {
                            lane.querySelector('.lane-label').onclick = function () { openMasterModal(idx); };
                        } else {
                            lane.querySelector('.lane-label').style.cursor = 'default';
                        }

                        var area = lane.querySelector('.items-container');
                        times.forEach(function (t) {
                            var isSel = activePlan.items.some(function (it) { return it.masterId === m.id && it.time === t; });
                            var boxBottom = renderItemBox(area, m, t, isSel, start, idx, false, activePlan.id);
                            if (boxBottom && (boxBottom + headerH + 20 > maxBottom)) {
                                maxBottom = boxBottom + headerH + 20;
                            }
                        });
                        win.appendChild(lane);
                    });

                    if (maxBottom > totalH) {
                        win.style.height = maxBottom + 'px';
                        ruler.style.height = maxBottom + 'px';
                        var extraMin = Math.ceil((maxBottom - totalH) / state.px);
                        var extraGrid = '';
                        var extraRuler = '';
                        for (var mx = end + 60; mx <= end + extraMin + 60; mx += 60) {
                            var eTop = (mx - start) * state.px + headerH;
                            extraRuler += '<div class="hour-mark" style="top:' + eTop + 'px">' + Math.floor(mx / 60) + ':00</div>';
                            extraGrid += '<div style="position:absolute; top:' + eTop + 'px; left:0; right:0; height:1px; background:rgba(0,0,0,0.05); z-index:1; pointer-events:none;"></div>';
                        }
                        if (extraGrid) {
                            ruler.innerHTML += extraRuler;
                            win.insertAdjacentHTML('beforeend', extraGrid);
                        }
                    }
                } else {
                    // Refine Mode: Synchronized Multi-column Grid
                    ruler.style.display = 'block';
                    win.innerHTML = '';
                    win.style.background = 'none';

                    // 1. Collect all time boundaries from all patterns
                    var timePoints = [start, end];
                    plans.forEach(function (p) {
                        p.items.forEach(function (it) {
                            var s = timeToMin(it.time);
                            var e = s + (it.duration || 30);
                            if (!timePoints.includes(s)) timePoints.push(s);
                            if (!timePoints.includes(e)) timePoints.push(e);
                        });
                    });
                    timePoints.sort(function (a, b) { return a - b; });

                    // 2. Render Ruler
                    var rHtml = '<div style="height:' + headerH + 'px"></div>';
                    timePoints.forEach(function (tp, idx) {
                        // We don't use absolute positioning here anymore, we'll sync with flex rows
                        // But we'll create a side-ruler column in the grid instead for better sync
                    });
                    ruler.innerHTML = ''; // We'll render ruler inside the win for perfect sync

                    // 3. Create Grid Structure
                    var grid = document.createElement('div');
                    grid.style.cssText = 'display:flex; flex-direction:column; min-width:100%;';

                    // Header Row
                    var hRow = document.createElement('div');
                    hRow.style.cssText = 'display:flex; position:sticky; top:0; z-index:100; background:var(--bg-dark);';
                    hRow.innerHTML = '<div style="width:50px; flex-shrink:0; background:var(--glass); border-bottom:1px solid var(--glass-border);"></div>'; // Corner
                    plans.forEach(function (p, pIdx) {
                        var h = document.createElement('div');
                        h.className = 'category-lane';
                        h.style.cssText = 'flex:1; min-width:240px; border-right:1px solid var(--glass-border); position:relative;';
                        h.innerHTML = '<div class="cat-header" style="height:' + headerH + 'px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; border-bottom:1px solid var(--glass-border); padding:6px;">' +
                            '<div style="display:flex; align-items:center; gap:8px;">' +
                            '<div style="font-size:14px; color:var(--accent); font-weight:bold;">' + p.name + '</div>' +
                            (plans.length > 1 ? '<button class="del-plan-btn" style="background:none; border:none; cursor:pointer; font-size:12px; opacity:0.5;">🗑️</button>' : '') +
                            '</div>' +
                            '<div style="background:rgba(0,0,0,0.03); border-radius:15px; padding:8px; display:flex; flex-direction:column; align-items:center; gap:5px; width:90%;">' +
                            '<div style="font-size:11px; color:var(--text-dim); font-weight:bold;">▼ 予定を追加 ▼</div>' +
                            '<div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:center;">' +
                            '<button class="cat-add-btn" data-cat="show" style="background:#6c5ce7; color:white; border:none; padding:6px 10px; border-radius:12px; font-size:11px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">🎶ショー</button>' +
                            '<button class="cat-add-btn" data-cat="attraction" style="background:#0097e6; color:white; border:none; padding:6px 10px; border-radius:12px; font-size:11px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">🎢アトラクション</button>' +
                            '<button class="cat-add-btn" data-cat="food" style="background:#e67e22; color:white; border:none; padding:6px 10px; border-radius:12px; font-size:11px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">🍽️食事</button>' +
                            '<button class="cat-add-btn" data-cat="rest" style="background:#95a5a6; color:white; border:none; padding:6px 10px; border-radius:12px; font-size:11px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">😴休憩</button>' +
                            '<button class="cat-add-btn" data-cat="other" style="background:#27ae60; color:white; border:none; padding:6px 10px; border-radius:12px; font-size:11px; font-weight:bold; cursor:pointer; box-shadow:0 2px 4px rgba(0,0,0,0.1);">📌その他</button>' +
                            '</div>' +
                            '</div></div>';

                        h.querySelectorAll('.cat-add-btn').forEach(function (btn) {
                            btn.onclick = function () { openItemModal(-1, btn.getAttribute('data-cat'), '', p.id); };
                        });
                        var delBtn = h.querySelector('.del-plan-btn');
                        if (delBtn) {
                            delBtn.onclick = function () {
                                if (confirm(p.name + "を削除しますか？")) {
                                    plans.splice(pIdx, 1);
                                    refreshPlanNames(plans); // 削除後に連番を振り直し
                                    pd.plans[state.date] = plans;
                                    dm.save(d);
                                    if (state.pId === p.id) state.pId = plans[0].id;
                                    render();
                                }
                            };
                        }
                        hRow.appendChild(h);
                    });
                    grid.appendChild(hRow);

                    // 4. Calculate Segment Heights
                    var segmentHeights = [];
                    for (var i = 0; i < timePoints.length - 1; i++) {
                        var sTime = timePoints[i];
                        var eTime = timePoints[i + 1];
                        var dur = eTime - sTime;
                        var anyEventStarts = plans.some(function (p) { return p.items.some(function (it) { return timeToMin(it.time) === sTime; }); });
                        segmentHeights[i] = anyEventStarts ? 108 : Math.max(dur * 0.6, 60);
                    }

                    // Create the Flex-Row container for Columns
                    var columnsContainer = document.createElement('div');
                    columnsContainer.style.cssText = 'display:flex; flex-direction:row; width:100%;';

                    // Ruler Column
                    var rulerCol = document.createElement('div');
                    rulerCol.style.cssText = 'width:50px; flex-shrink:0; border-right:1px solid var(--glass-border); background:rgba(0,0,0,0.02); display:flex; flex-direction:column;';
                    for (var i = 0; i < timePoints.length - 1; i++) {
                        var rCell = document.createElement('div');
                        rCell.style.cssText = 'height:' + segmentHeights[i] + 'px; border-bottom:1px dashed rgba(0,0,0,0.1); font-size:10px; color:var(--text-dim); padding-top:4px; font-weight:bold; text-align:center; box-sizing:border-box;';
                        rCell.innerText = minToTime(timePoints[i]);
                        rulerCol.appendChild(rCell);
                    }
                    var rLastCell = document.createElement('div');
                    rLastCell.style.cssText = 'height:30px; font-size:10px; color:var(--text-dim); padding-top:4px; font-weight:bold; text-align:center; box-sizing:border-box;';
                    rLastCell.innerText = minToTime(timePoints[timePoints.length - 1]);
                    rulerCol.appendChild(rLastCell);
                    columnsContainer.appendChild(rulerCol);

                    // Pattern Columns
                    plans.forEach(function (p) {
                        var col = document.createElement('div');
                        col.style.cssText = 'flex:1; min-width:240px; border-right:1px solid var(--glass-border); display:flex; flex-direction:column;';

                        var i = 0;
                        while (i < timePoints.length - 1) {
                            var sTime = timePoints[i];
                            var item = p.items.find(function (it) { return timeToMin(it.time) === sTime; });

                            if (item) {
                                var itemDur = item.duration || 30;
                                var endT = sTime + itemDur;
                                var h = 0;
                                var span = 0;
                                while (i + span < timePoints.length - 1 && timePoints[i + span] < endT) {
                                    h += segmentHeights[i + span];
                                    span++;
                                }
                                if (span === 0) span = 1;

                                var cell = document.createElement('div');
                                cell.style.cssText = 'height:' + h + 'px; border-bottom:1px dashed rgba(255,255,255,0.05); padding:6px; box-sizing:border-box; position:relative; overflow:hidden;';

                                var mIdx = -1;
                                if (item.masterId !== 999 && item.masterId !== 888) {
                                    mIdx = pd.masterEvents.findIndex(function (m) { return m.id === item.masterId; });
                                }
                                renderItemBoxFlow(cell, item, item.time, start, (mIdx >= 0 ? mIdx : 99), p.id);
                                col.appendChild(cell);
                                i += span;
                            } else {
                                var isInside = p.items.some(function (it) {
                                    var s = timeToMin(it.time);
                                    var e = s + (it.duration || 30);
                                    return sTime >= s && sTime < e;
                                });

                                if (!isInside) {
                                    var nextItem = p.items.filter(function (it) { return timeToMin(it.time) > sTime; })
                                        .sort(function (a, b) { return timeToMin(a.time) - timeToMin(b.time); })[0];
                                    var gapEnd = nextItem ? timeToMin(nextItem.time) : end;
                                    var gapDur = gapEnd - sTime;

                                    if (gapDur > 0) {
                                        var h = 0;
                                        var span = 0;
                                        while (i + span < timePoints.length - 1 && timePoints[i + span] < gapEnd) {
                                            h += segmentHeights[i + span];
                                            span++;
                                        }
                                        if (span === 0) span = 1;
                                        var cell = document.createElement('div');
                                        cell.style.cssText = 'height:' + h + 'px; border-bottom:1px dashed rgba(0,0,0,0.1); box-sizing:border-box; position:relative; overflow:hidden;';
                                        renderGapInfoFlowFixed(cell, sTime, gapDur, p.id);
                                        col.appendChild(cell);
                                        i += span;
                                    } else {
                                        var cell = document.createElement('div');
                                        cell.style.cssText = 'height:' + segmentHeights[i] + 'px; border-bottom:1px dashed rgba(0,0,0,0.1); box-sizing:border-box;';
                                        col.appendChild(cell);
                                        i++;
                                    }
                                } else {
                                    var cell = document.createElement('div');
                                    cell.style.cssText = 'height:' + segmentHeights[i] + 'px; border-bottom:1px dashed rgba(255,255,255,0.05); box-sizing:border-box;';
                                    col.appendChild(cell);
                                    i++;
                                }
                            }
                        }
                        columnsContainer.appendChild(col);
                    });

                    grid.appendChild(columnsContainer);
                    win.appendChild(grid);
                    ruler.style.display = 'none'; // We integrated it into the grid

                    var totalH = headerH + 30;
                    for (var i = 0; i < segmentHeights.length; i++) totalH += segmentHeights[i];
                    win.style.height = totalH + 'px';
                }
            } catch (e) {
                console.error('render failed', e);
                showFatalError(e && e.message ? e.message : e);
                document.getElementById('app-main').style.display = 'none';
                document.getElementById('step-home').style.display = 'flex';
            }
        }

        function renderItemBoxFlow(area, it, t, startMin, mIdx, pId) {
            var dur = it.duration || 30;
            var div = document.createElement('div');

            // 過去データ互換性: catが未設定でmasterIdがショーらしい場合はshowとする
            if (!it.cat && (it.masterId === 888 || String(it.masterId).match(/^[sp]\d+/))) {
                it.cat = 'show';
            }

            // ジャンル別カラー & アイコン
            var catColors = { show: '#6c5ce7', attraction: '#0097e6', food: '#e67e22', rest: '#95a5a6', other: '#27ae60' };
            var catIcons = { show: '🎶', attraction: '🎢', food: '🍽️', rest: '😴', other: '📌' };
            var color = catColors[it.cat] || catColors.other;
            var icon = catIcons[it.cat] || catIcons.other;
            div.style.cssText = 'height:100%; min-height:0; padding:9px; border-radius:10px; background:' + color + '; color:white; cursor:pointer; position:relative; box-shadow:0 4px 10px rgba(0,0,0,0.22); z-index:10; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; overflow:hidden;';

            div.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">' +
                '<div style="font-size:12px; font-weight:800; background:rgba(255,255,255,0.3); color:#263238; padding:3px 7px; border-radius:6px; white-space:nowrap;">' + t + ' - ' + minToTime(timeToMin(t) + dur) + '</div>' +
                '<div style="display:flex; align-items:center; gap:5px; flex-shrink:0;">' +
                '<div style="font-size:10px; opacity:0.9; font-weight:bold; white-space:nowrap;">' + dur + '分</div>' +
                '<button class="item-del-btn" style="background:rgba(255,255,255,0.3); border:none; color:white; width:26px; height:26px; border-radius:13px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; transition:0.2s; flex-shrink:0;">✕</button>' +
                '</div>' +
                '</div>' +
                '<div style="font-size:14px; font-weight:bold; line-height:1.25; letter-spacing:0; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">' + icon + ' ' + it.name + '</div>';

            div.querySelector('.item-del-btn').onclick = function (e) {
                e.stopPropagation();
                if (confirm(it.name + "を削除しますか？")) {
                    var d = dm.get();
                    var pd = getParkData(d);
                    var plans = pd.plans[state.date] || [];
                    var p = plans.find(function (plan) { return plan.id === pId; });
                    if (p) {
                        var realIdx = p.items.findIndex(function (item) {
                            return item.name === it.name && item.time === it.time;
                        });
                        if (realIdx !== -1) {
                            p.items.splice(realIdx, 1);
                            pd.plans[state.date] = plans;
                            dm.save(d);
                            render();
                        }
                    }
                }
            };

            div.onclick = function () {
                var d = dm.get();
                var pd = d.parks[state.park];
                var plans = pd.plans[state.date] || [];
                var p = plans.find(function (plan) { return plan.id === pId; });
                if (p) {
                    var realIdx = p.items.findIndex(function (item) {
                        return item.name === it.name && item.time === it.time;
                    });
                    if (realIdx !== -1) openItemModal(realIdx, it.cat, null, pId);
                }
            };
            area.appendChild(div);
        }

        function renderGapInfoFlowFixed(area, gapStartMin, gapMin, pId) {
            var gapDiv = document.createElement('div');
            gapDiv.style.cssText = 'height:100%; position:absolute; top:0; left:0; right:0; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; z-index:1;';
            gapDiv.title = 'この空き時間に予定を追加';

            var line = document.createElement('div');
            line.style.cssText = 'position:absolute; top:8px; bottom:8px; left:50%; border-left:2px dashed rgba(0,0,0,0.16); transform:translateX(-50%); pointer-events:none;';
            gapDiv.appendChild(line);

            var topArrow = document.createElement('div');
            topArrow.innerText = '▲'; topArrow.style.cssText = 'position:absolute; top:-10px; left:50%; transform:translateX(-50%); font-size:11px; color:rgba(0,0,0,0.25);';
            line.appendChild(topArrow);

            var bottomArrow = document.createElement('div');
            bottomArrow.innerText = '▼'; bottomArrow.style.cssText = 'position:absolute; bottom:-10px; left:50%; transform:translateX(-50%); font-size:11px; color:rgba(0,0,0,0.25);';
            line.appendChild(bottomArrow);

            var label = document.createElement('div');
            label.style.cssText = 'z-index:2; background:#ffffff; padding:5px 14px; border-radius:20px; border:1px solid rgba(108,92,231,0.55); color:var(--text-main); font-size:14px; font-weight:900; box-shadow:0 4px 12px rgba(108, 92, 231, 0.16);';
            label.innerText = gapMin + '分';
            gapDiv.appendChild(label);

            gapDiv.onclick = function () {
                var startText = minToTime(gapStartMin);
                var endText = minToTime(gapStartMin + gapMin);
                if (confirm(startText + '〜' + endText + '（' + gapMin + '分）に予定を作成しますか？')) {
                    openItemModal(-1, 'attraction', startText, pId, gapMin);
                }
            };

            area.appendChild(gapDiv);
        }

        function renderGapInfo(area, gapStartMin, gapDurMin, startMin) {
            var gapDiv = document.createElement('div');
            gapDiv.style.position = 'absolute';
            gapDiv.style.top = (gapStartMin - startMin) * state.px + 'px';
            gapDiv.style.height = (gapDurMin * state.px) + 'px';
            gapDiv.style.left = '0';
            gapDiv.style.right = '0';
            gapDiv.style.display = 'flex';
            gapDiv.style.flexDirection = 'column';
            gapDiv.style.alignItems = 'center';
            gapDiv.style.justifyContent = 'center';
            gapDiv.style.pointerEvents = 'none';
            gapDiv.style.zIndex = 5;

            // Stretching Line with Arrow Symbols
            var line = document.createElement('div');
            line.style.position = 'absolute';
            line.style.top = '5px';
            line.style.bottom = '5px';
            line.style.left = '50%';
            line.style.borderLeft = '2px dashed rgba(0,0,0,0.15)';
            line.style.transform = 'translateX(-50%)';
            gapDiv.appendChild(line);

            var topArrow = document.createElement('div');
            topArrow.innerText = '▲';
            topArrow.style.position = 'absolute';
            topArrow.style.top = '-8px';
            topArrow.style.left = '50%';
            topArrow.style.transform = 'translateX(-50%) scaleX(1.2)';
            topArrow.style.fontSize = '8px';
            topArrow.style.color = 'rgba(0,0,0,0.2)';
            line.appendChild(topArrow);

            var bottomArrow = document.createElement('div');
            bottomArrow.innerText = '▼';
            bottomArrow.style.position = 'absolute';
            bottomArrow.style.bottom = '-8px';
            bottomArrow.style.left = '50%';
            bottomArrow.style.transform = 'translateX(-50%) scaleX(1.2)';
            bottomArrow.style.fontSize = '8px';
            bottomArrow.style.color = 'rgba(0,0,0,0.2)';
            line.appendChild(bottomArrow);

            var label = document.createElement('div');
            label.style.zIndex = 6;
            label.style.background = 'var(--bg-dark)';
            label.style.padding = '4px 10px';
            label.style.borderRadius = '20px';
            label.style.border = '1px solid var(--accent)';
            label.style.color = 'var(--text-main)';
            label.style.fontSize = '14px'; // Larger
            label.style.fontWeight = '800';
            label.style.boxShadow = '0 0 10px rgba(108, 92, 231, 0.4)';
            label.innerText = gapDurMin + '分';
            gapDiv.appendChild(label);

            area.appendChild(gapDiv);
        }

        function renderItemBox(area, it, t, isSel, start, mIdx, isRefine, pId) {
            var mStart = timeToMin(t), dur = it.duration || 30;
            var div = document.createElement('div');
            div.className = 'item-box ' + (isSel ? 'selected' : 'unselected');

            var h = 60 * state.px;
            var top = (mStart - start) * state.px;

            // Check previous siblings to avoid overlap
            var lastChild = area.lastElementChild;
            if (lastChild) {
                var lastTop = parseFloat(lastChild.style.top);
                var lastH = parseFloat(lastChild.style.height);
                var lastBottom = lastTop + lastH;
                if (top < lastBottom) {
                    top = lastBottom + 2; // Shift down
                }
            }

            div.style.top = top + 'px';
            div.style.height = h + 'px';

            var color = COLORS[mIdx % COLORS.length] || '#999';
            if (isSel) div.style.backgroundColor = color;
            else { div.style.borderColor = color; div.style.color = color; }

            // 文字サイズも大きく見やすくする
            var textStyle = 'font-size:11px; font-weight:bold;';
            if (!isSel) {
                textStyle += ' text-shadow: 1px 1px 0 #fff, -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 0 0 4px #fff;';
            }
            div.innerHTML = '<span style="' + textStyle + '">' + t + ' ~ ' + minToTime(mStart + dur) + '</span>';
            div.onclick = function () { toggleSelection(it, t, pId); };

            area.appendChild(div);
            return top + h;
        }

        function toggleSelection(m, t, pId) {
            var d = dm.get(); var pd = getParkData(d); var plans = pd.plans[state.date] || [{ id: 0, name: "予定①", items: [] }];
            var p = plans.find(function (it) { return it.id === pId; });
            var idx = p.items.findIndex(function (it) { return it.masterId === m.id && it.time === t; });
            if (idx === -1) {
                var start1 = timeToMin(t);
                var end1 = start1 + m.duration;
                var overlap = p.items.find(function (it) {
                    var s2 = timeToMin(it.time);
                    var e2 = s2 + (it.duration || 30);
                    return (start1 < e2 && end1 > s2);
                });
                if (overlap) {
                    alert("他の予定（" + overlap.name + "）と時間が重複しているため追加できません。");
                    return;
                }
                p.items.push({ masterId: m.id, name: m.name, time: t, duration: m.duration, cat: 'show' });
            } else {
                p.items.splice(idx, 1);
            }
            pd.plans[state.date] = plans; dm.save(d); render();
        }

        function openItemModal(idx, cat, initialTime, pId, initialDuration) {
            var d = dm.get(); var pd = getParkData(d); var plans = pd.plans[state.date];
            var targetPId = pId !== undefined ? pId : state.pId;
            var p = plans.find(function (it) { return it.id === targetPId; });

            var catNames = { show: 'ショー・パレード', attraction: 'アトラクション', food: '食事', rest: '休憩', other: 'その他' };
            var catIcons = { show: '🎶', attraction: '🎢', food: '🍽️', rest: '😴', other: '📌' };
            var defaultName = idx === -1 ? (catNames[cat] || 'その他') : '';
            var it = idx === -1 ? { name: defaultName, time: initialTime || '', duration: initialDuration || 30, cat: cat || 'other' } : p.items[idx];
            var selectedCat = it.cat || cat || 'other';

            var endTime = it.time ? minToTime(timeToMin(it.time) + (it.duration || 30)) : '';
            var catIcon = catIcons[selectedCat] || '📌';
            var catLabel = catNames[selectedCat] || 'その他';

            var html = '<div class="item-modal-layout">' +
                '<div class="item-form-panel">' +
                '<div id="it-cat-label" style="background:rgba(108,92,231,0.08); padding:8px 12px; border-radius:10px; margin-bottom:12px; font-size:13px; font-weight:bold;">' + catIcon + ' ' + catLabel + '</div>' +
                '<div class="input-group"><label>ジャンル</label><select id="it-cat">' +
                '<option value="show"' + (selectedCat === 'show' ? ' selected' : '') + '>🎶 ショー・パレード</option>' +
                '<option value="attraction"' + (selectedCat === 'attraction' ? ' selected' : '') + '>🎢 アトラクション</option>' +
                '<option value="food"' + (selectedCat === 'food' ? ' selected' : '') + '>🍽️ 食事</option>' +
                '<option value="rest"' + (selectedCat === 'rest' ? ' selected' : '') + '>😴 休憩</option>' +
                '<option value="other"' + (selectedCat === 'other' ? ' selected' : '') + '>📌 その他</option>' +
                '</select></div>' +
                '<div class="input-group"><label>名称</label><input id="it-name" value="' + escapeHtml(it.name) + '"></div>' +
                '<div style="display:flex; gap:10px;">' +
                '<div class="input-group" style="flex:1;"><label>開始時間（4桁）</label><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" id="it-time" value="' + timeToInputDigits(it.time) + '" placeholder="0930"></div>' +
                '<div class="input-group" style="flex:1;"><label>終了時間（4桁）</label><input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" id="it-end" value="' + timeToInputDigits(endTime) + '" placeholder="1030"></div>' +
                '</div>' +
                '</div>' +
                '<div class="item-preview-panel">' +
                '<div class="item-preview-title">' + escapeHtml(p.name || 'この予定') + 'の予定プレビュー</div>' +
                '<div id="item-preview-list" style="height:calc(100% - 38px); overflow:auto;"></div>' +
                '</div>' +
                '</div>';

            document.getElementById('modal-item-inputs').innerHTML = html;
            document.getElementById('modal-item-title').innerText = idx === -1 ? '予定の追加' : '予定の編集';
            document.getElementById('btn-item-delete').style.display = idx === -1 ? 'none' : 'block';
            document.getElementById('modal-item').classList.remove('hidden');

            function renderItemModalPreview() {
                var nameVal = document.getElementById('it-name').value || defaultName || '新しい予定';
                var catVal = document.getElementById('it-cat').value || selectedCat;
                var startVal = normalizeTimeInput(document.getElementById('it-time').value);
                var endVal = normalizeTimeInput(document.getElementById('it-end').value);
                var catLabelEl = document.getElementById('it-cat-label');
                if (catLabelEl) catLabelEl.innerText = (catIcons[catVal] || '📌') + ' ' + (catNames[catVal] || 'その他');
                var draftItems = p.items.map(function (item, itemIdx) {
                    var copy = Object.assign({}, item);
                    copy._sourceIndex = itemIdx;
                    return copy;
                }).filter(function (item) {
                    return idx === -1 || item._sourceIndex !== idx;
                });
                if (startVal && endVal && timeToMin(endVal) > timeToMin(startVal)) {
                    draftItems.push({
                        name: nameVal,
                        time: startVal,
                        duration: timeToMin(endVal) - timeToMin(startVal),
                        cat: catVal,
                        _draft: true
                    });
                }
                draftItems.sort(function (a, b) { return a.time.localeCompare(b.time); });

                var preview = document.getElementById('item-preview-list');
                if (!preview) return;
                var start = timeToMin(d.parkHours.open);
                var end = timeToMin(d.parkHours.close);
                var timePoints = [start, end];
                draftItems.forEach(function (item) {
                    if (!item.time) return;
                    var s = timeToMin(item.time);
                    var e = s + (item.duration || 30);
                    if (!timePoints.includes(s)) timePoints.push(s);
                    if (!timePoints.includes(e)) timePoints.push(e);
                });
                timePoints.sort(function (a, b) { return a - b; });
                var segmentHeights = [];
                for (var i = 0; i < timePoints.length - 1; i++) {
                    var sTime = timePoints[i];
                    var eTime = timePoints[i + 1];
                    var dur = eTime - sTime;
                    var anyEventStarts = draftItems.some(function (item) { return timeToMin(item.time) === sTime; });
                    segmentHeights[i] = anyEventStarts ? 108 : Math.max(dur * 0.6, 60);
                }
                preview.innerHTML = '<div style="display:flex; min-height:100%; width:100%; background:#fff;">' +
                    '<div id="item-preview-ruler" style="width:50px; flex-shrink:0; border-right:1px solid var(--glass-border); background:rgba(0,0,0,0.02);"></div>' +
                    '<div id="item-preview-col" style="flex:1; min-width:0;"></div>' +
                    '</div>';
                var rulerEl = document.getElementById('item-preview-ruler');
                var colEl = document.getElementById('item-preview-col');
                for (var r = 0; r < timePoints.length - 1; r++) {
                    var rCell = document.createElement('div');
                    rCell.style.cssText = 'height:' + segmentHeights[r] + 'px; border-bottom:1px dashed rgba(0,0,0,0.1); font-size:10px; color:var(--text-dim); padding-top:4px; font-weight:bold; text-align:center; box-sizing:border-box;';
                    rCell.innerText = minToTime(timePoints[r]);
                    rulerEl.appendChild(rCell);
                }
                var rLast = document.createElement('div');
                rLast.style.cssText = 'height:30px; font-size:10px; color:var(--text-dim); padding-top:4px; font-weight:bold; text-align:center; box-sizing:border-box;';
                rLast.innerText = minToTime(timePoints[timePoints.length - 1]);
                rulerEl.appendChild(rLast);

                var pos = 0;
                while (pos < timePoints.length - 1) {
                    var curTime = timePoints[pos];
                    var item = draftItems.find(function (candidate) { return timeToMin(candidate.time) === curTime; });
                    if (item) {
                        var itemDur = item.duration || 30;
                        var itemEnd = curTime + itemDur;
                        var itemH = 0;
                        var itemSpan = 0;
                        while (pos + itemSpan < timePoints.length - 1 && timePoints[pos + itemSpan] < itemEnd) {
                            itemH += segmentHeights[pos + itemSpan];
                            itemSpan++;
                        }
                        var itemCell = document.createElement('div');
                        itemCell.style.cssText = 'height:' + itemH + 'px; border-bottom:1px dashed rgba(255,255,255,0.05); padding:6px; box-sizing:border-box; position:relative; overflow:hidden;';
                        renderPreviewItemBox(itemCell, item);
                        colEl.appendChild(itemCell);
                        pos += Math.max(itemSpan, 1);
                    } else {
                        var nextItem = draftItems.filter(function (candidate) { return timeToMin(candidate.time) > curTime; })
                            .sort(function (a, b) { return timeToMin(a.time) - timeToMin(b.time); })[0];
                        var gapEnd = nextItem ? timeToMin(nextItem.time) : end;
                        var gapDur = gapEnd - curTime;
                        var gapH = 0;
                        var gapSpan = 0;
                        while (pos + gapSpan < timePoints.length - 1 && timePoints[pos + gapSpan] < gapEnd) {
                            gapH += segmentHeights[pos + gapSpan];
                            gapSpan++;
                        }
                        var gapCell = document.createElement('div');
                        gapCell.style.cssText = 'height:' + gapH + 'px; border-bottom:1px dashed rgba(0,0,0,0.1); box-sizing:border-box; position:relative; overflow:hidden;';
                        renderPreviewGap(gapCell, gapDur);
                        colEl.appendChild(gapCell);
                        pos += Math.max(gapSpan, 1);
                    }
                }
            }

            ['it-cat', 'it-name', 'it-time', 'it-end'].forEach(function (id) {
                document.getElementById(id).oninput = renderItemModalPreview;
            });
            renderItemModalPreview();

            document.getElementById('btn-item-save').onclick = function () {
                it.name = document.getElementById('it-name').value;
                it.time = normalizeTimeInput(document.getElementById('it-time').value);
                var endVal = normalizeTimeInput(document.getElementById('it-end').value);
                if (!it.name || !it.time || !endVal) { alert('名称・開始時間・終了時間を入力してください'); return; }
                it.duration = timeToMin(endVal) - timeToMin(it.time);
                if (it.duration <= 0) { alert('終了時間は開始時間より後にしてください'); return; }
                it.cat = document.getElementById('it-cat').value || 'other';

                var start1 = timeToMin(it.time);
                var end1 = start1 + it.duration;
                var overlap = p.items.find(function (other, oIdx) {
                    if (idx !== -1 && p.items[idx] === other) return false;
                    var s2 = timeToMin(other.time);
                    var e2 = s2 + (other.duration || 30);
                    return (start1 < e2 && end1 > s2);
                });

                if (overlap) {
                    alert("他の予定（" + overlap.name + "）と時間が重複しています。");
                    return;
                }

                if (it.cat === 'show') {
                    if (it.masterId === undefined) it.masterId = 888;
                } else {
                    if (it.masterId === undefined) it.masterId = 999;
                }
                if (idx === -1) p.items.push(it);
                p.items.sort(function (a, b) { return a.time.localeCompare(b.time); });
                dm.save(d); closeModal('modal-item'); render();
            };
            document.getElementById('btn-item-delete').onclick = function () { p.items.splice(idx, 1); dm.save(d); closeModal('modal-item'); render(); };
        }

        function renderPreviewItemBox(area, it) {
            var dur = it.duration || 30;
            var catColors = { show: '#6c5ce7', attraction: '#0097e6', food: '#e67e22', rest: '#95a5a6', other: '#27ae60' };
            var catIcons = { show: '🎶', attraction: '🎢', food: '🍽️', rest: '😴', other: '📌' };
            var color = catColors[it.cat] || catColors.other;
            var icon = catIcons[it.cat] || catIcons.other;
            var div = document.createElement('div');
            div.style.cssText = 'height:100%; min-height:0; padding:9px; border-radius:10px; background:' + color + '; color:white; position:relative; box-shadow:0 4px 10px rgba(0,0,0,0.22); z-index:10; box-sizing:border-box; display:flex; flex-direction:column; justify-content:center; overflow:hidden;' + (it._draft ? ' outline:3px solid rgba(255,255,255,0.85);' : '');
            div.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">' +
                '<div style="font-size:12px; font-weight:800; background:rgba(255,255,255,0.3); color:#263238; padding:3px 7px; border-radius:6px; white-space:nowrap;">' + it.time + ' - ' + minToTime(timeToMin(it.time) + dur) + '</div>' +
                '<div style="font-size:10px; opacity:0.9; font-weight:bold; white-space:nowrap;">' + dur + '分</div>' +
                '</div>' +
                '<div style="font-size:14px; font-weight:bold; line-height:1.25; letter-spacing:0; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">' + (it._draft ? '追加予定 ' : '') + icon + ' ' + escapeHtml(it.name || '名称未入力') + '</div>';
            area.appendChild(div);
        }

        function renderPreviewGap(area, gapMin) {
            if (gapMin <= 0) return;
            var gapDiv = document.createElement('div');
            gapDiv.style.cssText = 'height:100%; position:absolute; top:0; left:0; right:0; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:1;';
            var line = document.createElement('div');
            line.style.cssText = 'position:absolute; top:8px; bottom:8px; left:50%; border-left:2px dashed rgba(0,0,0,0.16); transform:translateX(-50%);';
            gapDiv.appendChild(line);
            var topArrow = document.createElement('div');
            topArrow.innerText = '▲';
            topArrow.style.cssText = 'position:absolute; top:-10px; left:50%; transform:translateX(-50%); font-size:11px; color:rgba(0,0,0,0.25);';
            line.appendChild(topArrow);
            var bottomArrow = document.createElement('div');
            bottomArrow.innerText = '▼';
            bottomArrow.style.cssText = 'position:absolute; bottom:-10px; left:50%; transform:translateX(-50%); font-size:11px; color:rgba(0,0,0,0.25);';
            line.appendChild(bottomArrow);
            var label = document.createElement('div');
            label.style.cssText = 'z-index:2; background:#ffffff; padding:5px 14px; border-radius:20px; border:1px solid rgba(108,92,231,0.55); color:var(--text-main); font-size:14px; font-weight:900; box-shadow:0 4px 12px rgba(108, 92, 231, 0.16);';
            label.innerText = gapMin + '分';
            gapDiv.appendChild(label);
            area.appendChild(gapDiv);
        }

        function openMasterModal(idx) {
            if (!state.isAdmin) {
                alert("管理者ログインが必要です。");
                return;
            }
            var d = dm.get();
            var isAdminUI = document.getElementById('admin-dashboard').style.display === 'flex';
            var parkKey = isAdminUI ? state.adminPark : state.park;
            var pd = d.parks[parkKey];
            var m = idx === -1 ? { id: Date.now(), name: '', duration: 30, isLottery: false, imageUrl: '', times: [] } : pd.masterEvents[idx];

            document.getElementById('mst-name').value = m.name;
            document.getElementById('mst-dur').value = m.duration;
            document.getElementById('mst-lottery').value = m.isLottery ? "1" : "0";
            document.getElementById('mst-times').value = m.times.join(',');

            document.getElementById('modal-master-title').innerText = idx === -1 ? 'ショーの新規追加' : 'ショー情報の編集';
            document.getElementById('btn-master-delete').style.display = idx === -1 ? 'none' : 'block';
            document.getElementById('modal-master').classList.remove('hidden');

            document.getElementById('btn-master-save').onclick = function () {
                m.name = document.getElementById('mst-name').value;
                m.duration = parseInt(document.getElementById('mst-dur').value);
                m.isLottery = document.getElementById('mst-lottery').value === "1";
                m.times = document.getElementById('mst-times').value.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
                if (!m.name) return;
                if (idx === -1) {
                    pd.masterEvents.push(m);
                    state.adminShowId = m.id;
                }
                dm.save(d);
                closeModal('modal-master');
                if (isAdminUI) renderAdminDashboard();
                else render();
            };
            document.getElementById('btn-master-delete').onclick = function () {
                if (confirm("このショー自体をリストから削除しますか？")) {
                    pd.masterEvents.splice(idx, 1);
                    dm.save(d);
                    closeModal('modal-master');
                    if (isAdminUI) {
                        state.adminShowId = null;
                        renderAdminDashboard();
                    } else render();
                }
            };
        }

        // --- Admin Dashboard Logic ---

        function openAdminDashboard() {
            if (!state.isAdmin) {
                alert("管理者ログインが必要です。");
                return;
            }
            document.getElementById('admin-dashboard').style.display = 'flex';
            document.body.style.overflow = 'hidden';
            // Draftに現在のデータをコピー
            var d = dm.get();
            state.adminDraftSchedules = {};
            ['land', 'sea'].forEach(function (p) {
                var pd = d.parks[p];
                pd.masterEvents.forEach(function (m) {
                    state.adminDraftSchedules[m.id] = JSON.parse(JSON.stringify(pd.dailySchedules));
                });
            });
            var activeParkData = d.parks[state.adminPark];
            if (!state.adminShowId && activeParkData.masterEvents.length > 0) {
                state.adminShowId = activeParkData.masterEvents[0].id;
            }
            renderAdminDashboard();
        }

        function closeAdminDashboard() {
            document.getElementById('admin-dashboard').style.display = 'none';
            document.body.style.overflow = 'auto';
            if (state.adminRequested) {
                window.location.href = window.location.pathname;
                return;
            }
            render();
        }

        function setAdminPark(p) {
            state.adminPark = p;
            state.adminShowId = null;
            renderAdminDashboard();
        }

        function renderAdminDashboard() {
            document.getElementById('admin-park-land').className = 'admin-park-btn' + (state.adminPark === 'land' ? ' active' : '');
            document.getElementById('admin-park-sea').className = 'admin-park-btn' + (state.adminPark === 'sea' ? ' active' : '');

            var d = dm.get();
            var pd = d.parks[state.adminPark];
            if (!state.adminShowId && pd.masterEvents.length > 0) {
                state.adminShowId = pd.masterEvents[0].id;
            }
            var sidebar = document.getElementById('admin-sidebar');
            sidebar.innerHTML = '<div class="admin-sidebar-head">' +
                '<strong>' + (state.adminPark === 'land' ? 'ランド' : 'シー') + 'のショー・パレード（' + pd.masterEvents.length + '件）</strong>' +
                '<button onclick="openMasterModal(-1)" class="btn-admin-action btn-primary" style="width:100%;">新規追加</button>' +
                '</div>';

            pd.masterEvents.forEach(function (m) {
                var div = document.createElement('div');
                div.className = 'sidebar-item' + (state.adminShowId === m.id ? ' active' : '');
                div.innerHTML = '<div style="font-weight:bold;">' + m.name + '</div>' +
                    '<div style="font-size:10px; opacity:0.7;">' + (m.isLottery ? '抽選あり' : '抽選なし') + ' / ' + m.duration + '分</div>';
                div.onclick = function () { selectAdminShow(m.id); };
                sidebar.appendChild(div);
            });

            if (state.adminShowId) {
                document.getElementById('admin-empty-state').style.display = 'none';
                document.getElementById('admin-show-editor').style.display = 'block';
                renderShowSchedule();
            } else {
                document.getElementById('admin-empty-state').style.display = 'flex';
                document.getElementById('admin-show-editor').style.display = 'none';
            }
        }

        function selectAdminShow(id) {
            state.adminShowId = id;
            renderAdminDashboard();
        }

        function renderShowSchedule() {
            var d = dm.get();
            var pd = d.parks[state.adminPark];
            var m = pd.masterEvents.find(function (it) { return it.id === state.adminShowId; });
            if (!m) {
                state.adminShowId = null;
                renderAdminDashboard();
                return;
            }
            document.getElementById('admin-show-name').innerText = m.name;
            document.getElementById('admin-show-summary').innerHTML =
                '<span class="admin-pill">' + (m.isLottery ? '抽選あり' : '抽選なし') + '</span>' +
                '<span class="admin-pill">' + (m.duration || 0) + '分</span>' +
                '<span class="admin-pill">' + ((m.times && m.times.length) ? m.times.length : 0) + '回 / 基本日</span>';
            document.getElementById('admin-default-times').innerText =
                '基本公演時間: ' + ((m.times && m.times.length) ? m.times.join(', ') : '未設定');

            var list = document.getElementById('date-schedule-list');
            list.innerHTML = '';

            // 今後30日間を表示
            var today = new Date();
            for (var i = 0; i < 30; i++) {
                var curr = new Date(today);
                curr.setDate(today.getDate() + i);
                var ds = curr.toISOString().split('T')[0];

                var row = document.createElement('div');
                var scheds = state.adminDraftSchedules[m.id] && state.adminDraftSchedules[m.id][ds] ? state.adminDraftSchedules[m.id][ds][m.id] : null;
                if (!scheds) scheds = m.times; // デフォルト

                var isMissing = !state.adminDraftSchedules[m.id] || !state.adminDraftSchedules[m.id][ds] || !state.adminDraftSchedules[m.id][ds][m.id] || state.adminDraftSchedules[m.id][ds][m.id].length === 0;

                row.className = 'schedule-row' + (isMissing ? ' missing' : '');
                row.innerHTML = '<div class="schedule-date">' + formatAdminDate(ds) + '</div>' +
                    '<input class="schedule-input" data-date="' + ds + '" value="' + (scheds ? scheds.join(', ') : '') + '" placeholder="例: 10:30, 14:15">';

                row.querySelector('input').onchange = function (e) {
                    var date = e.target.getAttribute('data-date');
                    var val = e.target.value.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
                    updateDraft(state.adminShowId, date, val);
                };

                list.appendChild(row);
            }
        }

        function formatAdminDate(ds) {
            var weekdays = ['日', '月', '火', '水', '木', '金', '土'];
            var date = new Date(ds + 'T00:00:00');
            return ds + '（' + weekdays[date.getDay()] + '）';
        }

        function updateDraft(showId, date, times) {
            if (!state.adminDraftSchedules[showId]) state.adminDraftSchedules[showId] = {};
            if (!state.adminDraftSchedules[showId][date]) state.adminDraftSchedules[showId][date] = {};
            state.adminDraftSchedules[showId][date][showId] = times;
            // 未入力判定のために再描画
            renderShowSchedule();
        }

        function applyBulkEdit() {
            var datesText = document.getElementById('bulk-dates').value;
            var timesText = document.getElementById('bulk-times').value;
            if (!datesText || !timesText) return alert("日付と公演時間を入力してください");

            var times = timesText.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
            var parts = datesText.split(/[,\n]/).map(function (s) { return s.trim(); }).filter(function (s) { return s; });

            var targets = [];
            parts.forEach(function (p) {
                if (p.indexOf('~') !== -1) {
                    var range = p.split('~').map(function (s) { return s.trim(); });
                    if (range.length === 2) {
                        var curr = new Date(range[0]);
                        var end = new Date(range[1]);
                        if (!isNaN(curr) && !isNaN(end)) {
                            while (curr <= end) {
                                var y = curr.getFullYear();
                                var m = ("0" + (curr.getMonth() + 1)).slice(-2);
                                var d = ("0" + curr.getDate()).slice(-2);
                                targets.push(y + '-' + m + '-' + d);
                                curr.setDate(curr.getDate() + 1);
                            }
                        }
                    }
                } else {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(p)) targets.push(p);
                }
            });

            targets.forEach(function (ds) {
                updateDraft(state.adminShowId, ds, times);
            });
            alert(targets.length + "件の日付に適用しました。保存ボタンを押すまで反映されません。");
            renderShowSchedule();
        }

        function fillNext30Dates() {
            var dates = [];
            var today = new Date();
            for (var i = 0; i < 30; i++) {
                var curr = new Date(today);
                curr.setDate(today.getDate() + i);
                var y = curr.getFullYear();
                var m = ("0" + (curr.getMonth() + 1)).slice(-2);
                var d = ("0" + curr.getDate()).slice(-2);
                dates.push(y + '-' + m + '-' + d);
            }
            document.getElementById('bulk-dates').value = dates.join('\n');
        }

        function useDefaultTimesForBulk() {
            var d = dm.get();
            var pd = d.parks[state.adminPark];
            var m = pd.masterEvents.find(function (it) { return it.id === state.adminShowId; });
            if (!m) return;
            document.getElementById('bulk-times').value = (m.times || []).join(', ');
        }

        function clearSelectedShowSchedules() {
            if (!state.adminShowId) return;
            if (!confirm("このショーの日別スケジュールをすべて消去しますか？基本情報の時間は残ります。")) return;
            state.adminDraftSchedules[state.adminShowId] = {};
            renderShowSchedule();
        }

        function deleteSelectedMaster() {
            if (!state.adminShowId) return;
            var d = dm.get();
            var pd = d.parks[state.adminPark];
            var idx = pd.masterEvents.findIndex(function (m) { return m.id === state.adminShowId; });
            if (idx === -1) return;
            var name = pd.masterEvents[idx].name;
            if (!confirm(name + "を削除しますか？予定に追加済みの同名データは残ります。")) return;
            pd.masterEvents.splice(idx, 1);
            delete state.adminDraftSchedules[state.adminShowId];
            state.adminShowId = pd.masterEvents.length ? pd.masterEvents[0].id : null;
            dm.save(d);
            renderAdminDashboard();
        }

        function saveAdminChanges() {
            if (!state.isAdmin) {
                alert("管理者ログインが必要です。");
                return;
            }
            var d = dm.get();
            var touchedDates = {};
            // Draftから実データへ反映。まず対象ショーの日別設定を消してから、入力済みの値を書き戻す。
            Object.keys(state.adminDraftSchedules).forEach(function (showId) {
                var schedules = state.adminDraftSchedules[showId];
                ['land', 'sea'].forEach(function (pKey) {
                    var pd = d.parks[pKey];
                    var hasShow = pd.masterEvents.some(function (m) { return m.id == showId; });
                    if (hasShow) {
                        Object.keys(pd.dailySchedules).forEach(function (date) {
                            if (pd.dailySchedules[date]) delete pd.dailySchedules[date][showId];
                        });
                    }
                });
                Object.keys(schedules).forEach(function (date) {
                    touchedDates[date] = true;
                    // どのパークのショーか探す
                    ['land', 'sea'].forEach(function (pKey) {
                        var pd = d.parks[pKey];
                        var hasShow = pd.masterEvents.some(function (m) { return m.id == showId; });
                        if (hasShow) {
                            if (!pd.dailySchedules[date]) pd.dailySchedules[date] = {};
                            if (schedules[date] && schedules[date][showId] && schedules[date][showId].length > 0) {
                                pd.dailySchedules[date][showId] = schedules[date][showId];
                            }
                        }
                    });
                });
            });

            dm.save(d);
            var dateKeys = Object.keys(touchedDates).sort();
            if (dateKeys.length > 0) {
                alert("すべての変更を保存しました。\n保存対象: " + formatPlanDate(dateKeys[0]) + "〜" + formatPlanDate(dateKeys[dateKeys.length - 1]));
            } else {
                alert("すべての変更を保存しました。");
            }
        }

        function openMasterModalFromAdmin() {
            if (!state.adminShowId) return;
            var d = dm.get();
            var pd = d.parks[state.adminPark];
            var idx = pd.masterEvents.findIndex(function (m) { return m.id === state.adminShowId; });
            openMasterModal(idx);
        }

        // 既存のopenAdminModalは削除 (呼び出し元もinitで修正済み)


        function changeMode(m) {
            state.mode = m;
            render();
        }

        function refreshPlanNames(plans) {
            var circleNums = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
            plans.forEach(function (p, i) {
                p.name = "予定" + (circleNums[i] || (i + 1));
            });
        }

        function createNewPattern() {
            var d = dm.get();
            var pd = getParkData(d);
            var plans = pd.plans[state.date] || [{ id: 0, name: "予定①", items: [] }];

            // 新しいパターンを追加
            plans.push({ id: Date.now(), name: "", items: [] });
            refreshPlanNames(plans); // 追加後に連番を振り直し

            pd.plans[state.date] = plans;
            dm.save(d);
            state.pId = plans[plans.length - 1].id;
            state.mode = 'select'; // ショー選択画面へ遷移
            render();
        }

        function resetAllData() {
            if (confirm("予定パターンをすべて初期化しますか？（ショーの時間などは保持されます）")) {
                var d = dm.get();
                d.parks.land.plans = {};
                d.parks.sea.plans = {};
                dm.save(d);
                state.pickedShowIds = [];
                state.pId = 0;
                closeModal('modal-config');
                renderHome();
            }
        }
        function saveImage() {
            var frame = document.querySelector('.view-frame');
            var container = frame.querySelector('.grid-container');
            // スクロール全体を撮るため一時的にoverflow/heightを解除
            var origFrameOverflow = frame.style.overflow;
            var origFrameHeight = frame.style.height;
            var origContainerOverflow = container ? container.style.overflow : '';
            frame.style.overflow = 'visible';
            frame.style.height = 'auto';
            if (container) container.style.overflow = 'visible';

            var target = container || frame;
            html2canvas(target, { backgroundColor: "#f4f6f9", scale: 2, scrollY: 0, windowHeight: target.scrollHeight }).then(function (canvas) {
                // 元に戻す
                frame.style.overflow = origFrameOverflow;
                frame.style.height = origFrameHeight;
                if (container) container.style.overflow = origContainerOverflow;
                var link = document.createElement('a'); link.download = 'dream_plan_' + state.date + '.png'; link.href = canvas.toDataURL(); link.click();
            }).catch(function () {
                frame.style.overflow = origFrameOverflow;
                frame.style.height = origFrameHeight;
                if (container) container.style.overflow = origContainerOverflow;
            });
        }

        function shareImage() {
            var frame = document.querySelector('.view-frame');
            var container = frame.querySelector('.grid-container');
            var origFrameOverflow = frame.style.overflow;
            var origFrameHeight = frame.style.height;
            var origContainerOverflow = container ? container.style.overflow : '';
            frame.style.overflow = 'visible';
            frame.style.height = 'auto';
            if (container) container.style.overflow = 'visible';

            var target = container || frame;
            html2canvas(target, { backgroundColor: "#f4f6f9", scale: 2, scrollY: 0, windowHeight: target.scrollHeight }).then(async function (canvas) {
                frame.style.overflow = origFrameOverflow;
                frame.style.height = origFrameHeight;
                if (container) container.style.overflow = origContainerOverflow;

                try {
                    var blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/png'); });
                    var file = new File([blob], 'dream_plan_' + state.date + '.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ title: 'Dream Schedule Plan', files: [file] });
                    } else {
                        var link = document.createElement('a');
                        link.download = file.name;
                        link.href = canvas.toDataURL();
                        link.click();
                        alert('この端末では共有が使えないため、画像保存に切り替えました。');
                    }
                } catch (e) {
                    var link = document.createElement('a');
                    link.download = 'dream_plan_' + state.date + '.png';
                    link.href = canvas.toDataURL();
                    link.click();
                }
            }).catch(function () {
                frame.style.overflow = origFrameOverflow;
                frame.style.height = origFrameHeight;
                if (container) container.style.overflow = origContainerOverflow;
            });
        }

        window.onerror = function (message) {
            var box = document.getElementById('error-display');
            var text = document.getElementById('error-message');
            if (box && text) {
                text.innerText = String(message || '不明なエラーが発生しました');
                box.style.display = 'block';
            }
        };

        var check = setInterval(function () {
            if (document.getElementById('plan-date')) {
                clearInterval(check);
                init();
            }
        }, 100);
    