/* ═══════════════════════════════════════════
   TollOS — Dashboard JavaScript
   Complete & Production-Ready
═══════════════════════════════════════════ */

// ── State ──
let lanesData       = {};
let initialRenderDone = {};
let sparkData       = { cars: [], buses: [], trucks: [], wait: [] };
let pieChart        = null;
let barChart        = null;
let sparklineCharts = {};
let searchQuery     = '';

// ── Init ──
window.addEventListener('load', () => {
    fetchData();
    initCharts();
    setInterval(fetchData, 1000);
});

// ── Fetch ──
async function fetchData() {
    try {
        const res  = await fetch('/api/data');
        const data = await res.json();
        lanesData  = data.lanes;
        updateDashboard(data);
    } catch (err) {
        console.error('Fetch error:', err);
    }
}

// ── Dashboard ──
function updateDashboard(data) {
    // KPI values
    const totalCars   = Object.values(data.lanes).reduce((s,l) => s + (l.vehicles?.car   || 0), 0);
    const totalBuses  = Object.values(data.lanes).reduce((s,l) => s + (l.vehicles?.bus   || 0), 0);
    const totalTrucks = Object.values(data.lanes).reduce((s,l) => s + (l.vehicles?.truck || 0), 0);

    const waitTimes   = Object.values(data.lanes).map(l => l.waiting_time || 0);
    const avgWait     = waitTimes.length ? Math.round(waitTimes.reduce((s,v) => s+v, 0) / waitTimes.length) : 0;

    animateCount('totalCars',   totalCars);
    animateCount('totalBuses',  totalBuses);
    animateCount('totalTrucks', totalTrucks);
    animateCount('avgWaitTime', avgWait);

    // Sparkline data
    sparkData.cars.push(totalCars);
    sparkData.buses.push(totalBuses);
    sparkData.trucks.push(totalTrucks);
    sparkData.wait.push(avgWait);
    ['cars','buses','trucks','wait'].forEach(k => { if (sparkData[k].length > 20) sparkData[k].shift(); });
    updateSparklines();

    // Champion banner
    const bestLaneName = document.getElementById('bestLaneName');
    const bestLaneTime = document.getElementById('bestLaneTime');
    if (data.best_lane) {
        bestLaneName.textContent = data.best_lane;
        if (bestLaneTime) animateCount('bestLaneTime', data.best_time || 0);
    } else {
        bestLaneName.textContent = 'No Active Lanes';
        if (bestLaneTime) bestLaneTime.textContent = '0';
    }

    // Counts
    const activeLanesCount = Object.values(data.lanes).filter(l => l.active && !l.video_ended).length;
    const totalEl = document.getElementById('totalLanes');
    if (totalEl) totalEl.textContent = data.total_lanes;
    const navBadge = document.getElementById('navLaneCount');
    if (navBadge) navBadge.textContent = data.total_lanes;
    animateCount('activeLanes', activeLanesCount);

    renderLanes(data.lanes, data.best_lane);
    updateCharts(data.lanes);
    updateStatsTable(data.lanes);
}

// ── Lanes Render ──
function renderLanes(lanes, bestLane) {
    const containers = [
        document.getElementById('lanesContainer'),
        document.getElementById('lanesContainerAlt')
    ].filter(Boolean);

    const laneIds = Object.keys(lanes).filter(id =>
        !searchQuery || id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    containers.forEach(container => {
        const noLanes = container.querySelector('.empty-state') || document.getElementById('noLanes');

        if (laneIds.length === 0) {
            if (noLanes) noLanes.style.display = 'flex';
            container.querySelectorAll('.lane-card').forEach(c => c.remove());
            return;
        }
        if (noLanes) noLanes.style.display = 'none';

        laneIds.forEach(laneId => {
            const laneData = lanes[laneId];
            let card = document.getElementById(`card-${laneId}-${container.id}`);

            if (!card) {
                card = createLaneCard(laneId, laneData, container.id);
                container.appendChild(card);
                initialRenderDone[laneId] = true;
                setTimeout(() => {
                    const img = document.getElementById(`video-${laneId}-${container.id}`);
                    if (img) img.src = `/video_feed/${laneId}`;
                }, 100);
            }

            updateLaneData(laneId, laneData, bestLane, container.id);
        });

        container.querySelectorAll('.lane-card').forEach(card => {
            const cid = card.id.replace('card-', '').replace(`-${container.id}`, '');
            if (!lanes[cid]) {
                delete initialRenderDone[cid];
                card.remove();
            }
        });
    });
}

// ── Create Lane Card ──
function createLaneCard(laneId, laneData, containerId) {
    const card = document.createElement('div');
    card.className = 'lane-card';
    card.id = `card-${laneId}-${containerId}`;

    card.innerHTML = `
        <div class="lane-header">
            <div class="lane-title">
                <div class="title-icon"><i class="fas fa-road"></i></div>
                <span>${laneId}</span>
                <span class="badge" id="badge-${laneId}-${containerId}">
                    <i class="fas fa-crown"></i> FASTEST
                </span>
                <span class="status-indicator inactive" id="status-${laneId}-${containerId}">
                    <span class="dot"></span> Inactive
                </span>
            </div>
            <div class="lane-actions">
                <input type="file" id="file-${laneId}-${containerId}" accept="video/*" class="hidden"
                    onchange="handleFileSelect('${laneId}', this)">
                <button class="btn-small btn-upload"
                    onclick="document.getElementById('file-${laneId}-${containerId}').click()" title="Upload">
                    <i class="fas fa-cloud-upload-alt"></i> Upload
                </button>
                <button class="btn-small btn-refresh" onclick="refreshLane('${laneId}', '${containerId}')" title="Refresh">
                    <i class="fas fa-sync-alt"></i>
                </button>
                <button class="btn-small btn-fullscreen" onclick="toggleFullscreen('${laneId}', '${containerId}')" title="Fullscreen">
                    <i class="fas fa-expand"></i>
                </button>
                <button class="btn-small btn-remove" onclick="deleteLane('${laneId}')" title="Delete">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>

        <div class="video-wrapper" id="wrapper-${laneId}-${containerId}">
            <img id="video-${laneId}-${containerId}" class="video-frame" src="" alt="${laneId}">
            <div id="placeholder-${laneId}-${containerId}" class="video-placeholder">
                <div class="placeholder-content">
                    <div class="placeholder-icon"><i class="fas fa-video"></i></div>
                    <p>No Video Uploaded</p>
                    <span class="placeholder-hint">Click Upload to add video</span>
                </div>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-item cars">
                <div class="icon-wrapper"><i class="fas fa-car"></i></div>
                <div class="stat-content">
                    <div class="label">Cars</div>
                    <div class="value" id="cars-${laneId}-${containerId}">0</div>
                </div>
            </div>
            <div class="stat-item buses">
                <div class="icon-wrapper"><i class="fas fa-bus"></i></div>
                <div class="stat-content">
                    <div class="label">Buses</div>
                    <div class="value" id="buses-${laneId}-${containerId}">0</div>
                </div>
            </div>
            <div class="stat-item trucks">
                <div class="icon-wrapper"><i class="fas fa-truck"></i></div>
                <div class="stat-content">
                    <div class="label">Trucks</div>
                    <div class="value" id="trucks-${laneId}-${containerId}">0</div>
                </div>
            </div>
        </div>

        <div class="waiting-display">
            <div class="progress-bar">
                <div class="progress-fill" id="progress-${laneId}-${containerId}" style="width:0%"></div>
            </div>
            <div class="time-info">
                <div class="label"><i class="fas fa-hourglass-half"></i> Wait Time</div>
                <div class="time"><span id="time-${laneId}-${containerId}">0</span>s</div>
            </div>
        </div>
    `;
    return card;
}

// ── Update Lane Data ──
function updateLaneData(laneId, laneData, bestLane, containerId) {
    const card      = document.getElementById(`card-${laneId}-${containerId}`);
    if (!card) return;

    const badge     = document.getElementById(`badge-${laneId}-${containerId}`);
    const statusEl  = document.getElementById(`status-${laneId}-${containerId}`);
    const carsEl    = document.getElementById(`cars-${laneId}-${containerId}`);
    const busesEl   = document.getElementById(`buses-${laneId}-${containerId}`);
    const trucksEl  = document.getElementById(`trucks-${laneId}-${containerId}`);
    const timeEl    = document.getElementById(`time-${laneId}-${containerId}`);
    const progress  = document.getElementById(`progress-${laneId}-${containerId}`);
    const videoImg  = document.getElementById(`video-${laneId}-${containerId}`);
    const placeholder = document.getElementById(`placeholder-${laneId}-${containerId}`);

    // Best lane
    if (laneId === bestLane && !laneData.video_ended) {
        card.classList.add('best-lane');
        if (badge) badge.style.display = 'inline-flex';
    } else {
        card.classList.remove('best-lane');
        if (badge) badge.style.display = 'none';
    }

    // Video ended
    laneData.video_ended
        ? card.classList.add('video-ended')
        : card.classList.remove('video-ended');

    // Status
    if (statusEl) {
        if (laneData.video_ended) {
            statusEl.className = 'status-indicator ended';
            statusEl.innerHTML = '<span class="dot"></span> Ended';
        } else if (laneData.active) {
            statusEl.className = 'status-indicator active';
            statusEl.innerHTML = '<span class="dot"></span> Active';
        } else {
            statusEl.className = 'status-indicator inactive';
            statusEl.innerHTML = '<span class="dot"></span> Inactive';
        }
    }

    if (carsEl)   carsEl.textContent   = laneData.vehicles?.car   || 0;
    if (busesEl)  busesEl.textContent  = laneData.vehicles?.bus   || 0;
    if (trucksEl) trucksEl.textContent = laneData.vehicles?.truck || 0;

    const waitTime = laneData.waiting_time || 0;
    if (timeEl)   timeEl.textContent = waitTime;
    if (progress) progress.style.width = Math.min((waitTime / 120) * 100, 100) + '%';

    if (laneData.active || laneData.video_ended) {
        if (videoImg)   videoImg.style.display    = 'block';
        if (placeholder) placeholder.style.display = 'none';
    }
}

// ── Charts ──
function initCharts() {
    const chartDefaults = {
        color: '#7e8fac',
        font: { family: 'DM Sans, sans-serif', size: 12 }
    };
    Chart.defaults.color = chartDefaults.color;
    Chart.defaults.font  = chartDefaults.font;

    // Pie
    const pieCtx = document.getElementById('pieChart');
    if (pieCtx) {
        pieChart = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: ['Cars', 'Buses', 'Trucks'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['rgba(62,207,142,0.8)', 'rgba(244,185,62,0.8)', 'rgba(232,68,90,0.8)'],
                    borderColor: ['#3ecf8e', '#f4b93e', '#e8445a'],
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                cutout: '68%',
                plugins: {
                    legend: { position: 'bottom', labels: { padding: 16, usePointStyle: true, pointStyle: 'circle' } }
                }
            }
        });
    }

    // Bar
    const barCtx = document.getElementById('barChart');
    if (barCtx) {
        barChart = new Chart(barCtx, {
            type: 'bar',
            data: { labels: [], datasets: [{
                label: 'Wait Time (s)',
                data: [],
                backgroundColor: 'rgba(79,156,249,0.6)',
                borderColor: '#4f9cf9',
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]},
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { stepSize: 10 }
                    },
                    x: {
                        grid: { display: false }
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}

function updateCharts(lanes) {
    if (!pieChart || !barChart) return;

    const totalCars   = Object.values(lanes).reduce((s,l) => s + (l.vehicles?.car   || 0), 0);
    const totalBuses  = Object.values(lanes).reduce((s,l) => s + (l.vehicles?.bus   || 0), 0);
    const totalTrucks = Object.values(lanes).reduce((s,l) => s + (l.vehicles?.truck || 0), 0);

    pieChart.data.datasets[0].data = [totalCars, totalBuses, totalTrucks];
    pieChart.update('none');

    const laneIds = Object.keys(lanes);
    barChart.data.labels = laneIds;
    barChart.data.datasets[0].data = laneIds.map(id => lanes[id].waiting_time || 0);
    barChart.update('none');
}

function initSparkline(id, color) {
    const canvas = document.getElementById(id);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(20).fill(''),
            datasets: [{ data: Array(20).fill(0), borderColor: color, borderWidth: 2, fill: false, pointRadius: 0, tension: 0.4 }]
        },
        options: {
            responsive: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            scales: { x: { display: false }, y: { display: false } },
            animation: false
        }
    });
    sparklineCharts[id] = chart;
}

function updateSparklines() {
    if (Object.keys(sparklineCharts).length === 0) {
        initSparkline('sparkCars',   '#3ecf8e');
        initSparkline('sparkBuses',  '#f4b93e');
        initSparkline('sparkTrucks', '#e8445a');
        initSparkline('sparkWait',   '#a78bfa');
    }
    const map = { sparkCars: 'cars', sparkBuses: 'buses', sparkTrucks: 'trucks', sparkWait: 'wait' };
    Object.entries(map).forEach(([id, key]) => {
        const chart = sparklineCharts[id];
        if (!chart) return;
        const d = sparkData[key];
        chart.data.datasets[0].data = [...Array(20 - d.length).fill(0), ...d];
        chart.update('none');
    });
}

// ── Stats Table ──
function updateStatsTable(lanes) {
    const tbody = document.getElementById('statsTableBody');
    if (!tbody) return;

    if (Object.keys(lanes).length === 0) {
        tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No lane data available</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    Object.entries(lanes).forEach(([laneId, data]) => {
        const statusClass = data.active ? (data.video_ended ? 'ended' : 'active') : 'inactive';
        const statusText  = data.active ? (data.video_ended ? 'Ended' : 'Active') : 'Inactive';
        const total = (data.vehicles?.car || 0) + (data.vehicles?.bus || 0) + (data.vehicles?.truck || 0);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${laneId}</strong></td>
            <td><span class="table-status ${statusClass}"><span class="table-status-dot"></span>${statusText}</span></td>
            <td>${data.vehicles?.car   || 0}</td>
            <td>${data.vehicles?.bus   || 0}</td>
            <td>${data.vehicles?.truck || 0}</td>
            <td><strong>${data.waiting_time || 0}s</strong></td>
            <td><strong>${total}</strong></td>
        `;
        tbody.appendChild(row);
    });
}

// ── Hero Stats ──
function updateHeroStats() {
    const totalVehicles =
        (parseInt(document.getElementById('totalCars')?.textContent)   || 0) +
        (parseInt(document.getElementById('totalBuses')?.textContent)  || 0) +
        (parseInt(document.getElementById('totalTrucks')?.textContent) || 0);
    const activeLanes = parseInt(document.getElementById('activeLanes')?.textContent) || 0;
    const bestTime    = parseInt(document.getElementById('bestLaneTime')?.textContent) || 0;
    animateCount('heroTotalVehicles', totalVehicles);
    animateCount('heroActiveLanes',   activeLanes);
    animateCount('heroBestTime',      bestTime);
}

// ── Animate Counter ──
function animateCount(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const current = parseInt(el.textContent) || 0;
    if (current === target) return;
    el.textContent = target;
}

// ── Search / Filter ──
function filterLanes(query) {
    searchQuery = query.trim();
    renderLanes(lanesData, null);
}

// ── Navigation ──
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const section = item.dataset.section;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            item.classList.add('active');
            const sec = document.getElementById(`sec-${section}`);
            if (sec) sec.classList.add('active');
            if (window.innerWidth < 768) closeSidebar();
        });
    });
});

// ── Sidebar ──
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
}

// ── Theme ──
function toggleTheme() {
    const html  = document.documentElement;
    const isDark = html.getAttribute('data-theme') === 'dark';
    html.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('themeIcon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
}

// ── Activity Feed ──
function logActivity(message, type = 'info') {
    const list = document.getElementById('activityList');
    if (!list) return;

    const empty = list.querySelector('.activity-empty');
    if (empty) empty.remove();

    const item = document.createElement('div');
    item.className = 'activity-item';
    const now = new Date();
    const time = now.toLocaleTimeString();
    item.innerHTML = `
        <span class="activity-dot ${type}"></span>
        <div>
            <div class="activity-text">${message}</div>
            <div class="activity-time">${time}</div>
        </div>
    `;
    list.prepend(item);

    // Limit to 50 items
    const items = list.querySelectorAll('.activity-item');
    if (items.length > 50) items[items.length - 1].remove();
}

function clearActivity() {
    const list = document.getElementById('activityList');
    if (list) list.innerHTML = '<div class="activity-empty">Activity cleared.</div>';
}

// ── Toast ──
function showAlert(message, type = 'info') {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info} toast-icon"></i> ${message}`;
    container.appendChild(toast);

    logActivity(message, type === 'success' ? 'success' : type === 'error' ? 'error' : 'info');

    setTimeout(() => {
        toast.classList.add('out');
        setTimeout(() => toast.remove(), 300);
    }, 3200);
}

// ── File / Upload ──
function handleFileSelect(laneId, input) {
    const file = input.files[0];
    if (file) uploadVideo(laneId, file);
}

async function uploadVideo(laneId, file) {
    showAlert(`Uploading to ${laneId}…`, 'info');
    const formData = new FormData();
    formData.append('video', file);
    try {
        const res  = await fetch(`/api/upload/${laneId}`, { method: 'POST', body: formData });
        const data = await res.json();
        if (data.success) {
            showAlert(data.message, 'success');
            ['lanesContainer', 'lanesContainerAlt'].forEach(cid => {
                const videoImg   = document.getElementById(`video-${laneId}-${cid}`);
                const placeholder = document.getElementById(`placeholder-${laneId}-${cid}`);
                if (videoImg) { videoImg.style.display = 'block'; videoImg.src = `/video_feed/${laneId}?t=${Date.now()}`; }
                if (placeholder) placeholder.style.display = 'none';
            });
        } else {
            showAlert(data.message || 'Upload failed', 'error');
        }
    } catch {
        showAlert('Upload failed', 'error');
    }
}

function refreshLane(laneId, containerId) {
    const img = document.getElementById(`video-${laneId}-${containerId}`);
    if (img && lanesData[laneId]?.video_path) {
        img.src = `/video_feed/${laneId}?t=${Date.now()}`;
        showAlert(`${laneId} refreshed`, 'success');
    } else {
        showAlert(`No video to refresh for ${laneId}`, 'info');
    }
}

function toggleFullscreen(laneId, containerId) {
    const wrapper = document.getElementById(`wrapper-${laneId}-${containerId}`);
    if (!wrapper) return;
    if (!document.fullscreenElement) {
        wrapper.requestFullscreen().catch(e => showAlert(e.message, 'error'));
    } else {
        document.exitFullscreen();
    }
}

// ── Lane CRUD ──
async function addLane() {
    try {
        const res  = await fetch('/api/add_lane', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            showAlert(data.message, 'success');
            fetchData();
        } else {
            showAlert(data.message || 'Failed to add lane', 'error');
        }
    } catch {
        showAlert('Failed to add lane', 'error');
    }
}

async function deleteLane(laneId) {
    if (!confirm(`Delete ${laneId}?`)) return;
    try {
        const res  = await fetch(`/api/delete_lane/${laneId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showAlert(data.message, 'success');
            delete initialRenderDone[laneId];
            fetchData();
        }
    } catch {
        showAlert('Failed to delete lane', 'error');
    }
}

async function startAll() {
    showAlert('Starting all videos…', 'info');
    try {
        const res  = await fetch('/api/start_all', { method: 'POST' });
        const data = await res.json();
        showAlert(data.message, 'success');
        Object.keys(lanesData).forEach(laneId => {
            ['lanesContainer', 'lanesContainerAlt'].forEach(cid => {
                const img = document.getElementById(`video-${laneId}-${cid}`);
                const ph  = document.getElementById(`placeholder-${laneId}-${cid}`);
                if (img && lanesData[laneId]?.video_path) {
                    img.style.display = 'block';
                    img.src = `/video_feed/${laneId}?t=${Date.now()}`;
                }
                if (ph) ph.style.display = 'none';
            });
        });
    } catch {
        showAlert('Failed to start videos', 'error');
    }
}

async function stopAll() {
    try {
        const res  = await fetch('/api/stop_all', { method: 'POST' });
        const data = await res.json();
        showAlert(data.message, 'success');
    } catch {
        showAlert('Failed to stop', 'error');
    }
}

// ── Export Report ──
function exportReport() {
    const lanes  = lanesData;
    const laneIds = Object.keys(lanes);
    if (laneIds.length === 0) { showAlert('No data to export', 'info'); return; }

    const rows = [['Lane', 'Status', 'Cars', 'Buses', 'Trucks', 'Wait Time (s)', 'Total Vehicles']];
    laneIds.forEach(id => {
        const l = lanes[id];
        const status = l.active ? (l.video_ended ? 'Ended' : 'Active') : 'Inactive';
        const total  = (l.vehicles?.car || 0) + (l.vehicles?.bus || 0) + (l.vehicles?.truck || 0);
        rows.push([id, status, l.vehicles?.car || 0, l.vehicles?.bus || 0, l.vehicles?.truck || 0, l.waiting_time || 0, total]);
    });

    const csv  = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `tollos-report-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showAlert('Report exported', 'success');
}
