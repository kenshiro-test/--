const DEFAULT_EVENTS = [
    { id: 1, name: "ディズニー・ハーモニー・イン・カラー", times: ["12:45"], isLottery: true, imageUrl: "ハーモニーインカラー.jpg", duration: 45 },
    { id: 2, name: "東京ディズニーランド・エレクトリカルパレード", times: ["18:15"], isLottery: false, imageUrl: "エレクトリカルパレード.jpg", duration: 45 },
    { id: 3, name: "リーチ・フォー・ザ・スターズ", times: ["17:50", "20:15"], isLottery: true, imageUrl: "リーチフォーザスターズ.jpg", duration: 20 },
    { id: 4, name: "ジャンボリミッキー！レッツ・ダンス！", times: ["10:45", "12:00", "13:45", "15:00"], isLottery: true, imageUrl: "ジャンボリミッキー.jpg", duration: 15 },
    { id: 5, name: "ミッキーのマジカルミュージックワールド", times: ["10:50", "12:15", "13:40", "15:45", "17:10"], isLottery: true, imageUrl: "マジカルミュージックワールド.jpg", duration: 25 },
    { id: 6, name: "クラブマウスビート", times: ["12:20", "13:45", "15:10", "17:15", "18:40"], isLottery: true, imageUrl: "クラブマウスビート.jpg", duration: 25 }
];

var DataManager = function() {
    this.storageKey = 'dream_shiori_v2';
    this.currentPatternId = 0;
    this.init();
};

DataManager.prototype.init = function() {
    var data = localStorage.getItem(this.storageKey);
    if (!data) {
        this.resetToDefault();
    } else {
        try {
            var parsed = JSON.parse(data);
            if (!parsed.parkHours || !parsed.masterEvents || !parsed.plans) {
                this.resetToDefault();
            }
        } catch (e) {
            this.resetToDefault();
        }
    }
};

DataManager.prototype.resetToDefault = function() {
    var initialData = {
        parkHours: { open: "09:00", close: "21:00" },
        masterEvents: DEFAULT_EVENTS,
        plans: {} 
    };
    this.save(initialData);
};

DataManager.prototype.get = function() {
    return JSON.parse(localStorage.getItem(this.storageKey));
};

DataManager.prototype.save = function(data) {
    localStorage.setItem(this.storageKey, JSON.stringify(data));
};

DataManager.prototype.getParkHours = function() {
    var data = this.get();
    return (data && data.parkHours) ? data.parkHours : { open: "09:00", close: "21:00" };
};

DataManager.prototype.setParkHours = function(open, close) {
    var data = this.get() || { plans: {} };
    data.parkHours = { open, close };
    this.save(data);
};

DataManager.prototype.getMasterEvents = function() {
    var data = this.get();
    return (data && data.masterEvents) ? data.masterEvents : DEFAULT_EVENTS;
};

DataManager.prototype.getPlans = function(date) {
    var data = this.get();
    if (!data.plans[date]) {
        data.plans[date] = [
            { id: 0, name: "パターンA", items: [] }
        ];
        this.save(data);
    }
    return data.plans[date];
};

DataManager.prototype.savePlan = function(date, patterns) {
    var data = this.get();
    data.plans[date] = patterns;
    this.save(data);
};

DataManager.prototype.getCurrentPattern = function(date) {
    var patterns = this.getPlans(date);
    var self = this;
    var found = patterns.filter(function(p) { return p.id === self.currentPatternId; })[0];
    return found || patterns[0];
};

DataManager.prototype.setCurrentPatternId = function(id) {
    this.currentPatternId = id;
};

DataManager.prototype.addPattern = function(date, name) {
    var data = this.get();
    var patterns = data.plans[date] || [];
    var newPattern = {
        id: Date.now(),
        name: name || "パターン" + String.fromCharCode(65 + patterns.length),
        items: []
    };
    patterns.push(newPattern);
    data.plans[date] = patterns;
    this.save(data);
    return newPattern.id;
};

DataManager.prototype.removePattern = function(date, id) {
    var data = this.get();
    if (data.plans[date]) {
        data.plans[date] = data.plans[date].filter(function(p) { return p.id !== id; });
        if (data.plans[date].length === 0) {
            data.plans[date] = [{ id: 0, name: "パターンA", items: [] }];
        }
        this.save(data);
    }
};

var dataManager = new DataManager();
