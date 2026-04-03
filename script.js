// ─── Firebase ─────────────────────────────────────────────────────────────────

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getDatabase, ref, set, onValue } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

const firebaseConfig = {
  apiKey:            'AIzaSyCE2TxfDwkA9KB1S_B-EqhSPvFXY0npiTM',
  authDomain:        'fire-island-manager.firebaseapp.com',
  databaseURL:       'https://fire-island-manager-default-rtdb.firebaseio.com',
  projectId:         'fire-island-manager',
  storageBucket:     'fire-island-manager.firebasestorage.app',
  messagingSenderId: '864560145681',
  appId:             '1:864560145681:web:fc219be5b472ddb34998b0',
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getDatabase(firebaseApp);
const stateRef    = ref(db, 'shareState');

// ─── Data ─────────────────────────────────────────────────────────────────────

const WEEKS = [
  { id: 1, label: 'May',    dates: '5/28–6/4'   },
  { id: 2, label: 'June',   dates: '6/18–6/25'  },
  { id: 3, label: 'July',   dates: '7/9–7/16'   },
  { id: 4, label: 'August', dates: '8/13–8/20'  },
  { id: 5, label: 'Sept',   dates: '9/3–9/10'   },
];

const ROOMS = [
  { id: 1, owner: 'Rhys',    label: 'Room 1' },
  { id: 2, owner: 'Rhys',    label: 'Room 2' },
  { id: 3, owner: 'Chris',   label: 'Room 3' },
  { id: 4, owner: 'Michael', label: 'Room 4' },
];

const OWNERS = [
  { name: 'Rhys',    fronted: 16562.50, rooms: [1, 2], color: '#3b82f6' },
  { name: 'Chris',   fronted:  8281.25, rooms: [3],    color: '#8b5cf6' },
  { name: 'Michael', fronted:  8281.25, rooms: [4],    color: '#14b8a6' },
];

const GUEST_COLORS = [
  '#fb7185', '#fbbf24', '#84cc16', '#22d3ee',
  '#e879f9', '#fb923c', '#818cf8', '#f472b6',
  '#38bdf8', '#c084fc', '#2dd4bf', '#eab308',
];

const INTEREST_QUEUE = [
  { id: 1, name: 'Jamie & Paul',     initials: 'JP', spots: 2, weeks: ['July', 'August'], note: '2 spots · July & August' },
  { id: 2, name: 'Kouros',           initials: 'K',  spots: 1, weeks: ['May', 'June', 'July'], note: '1 spot · May, June & July' },
  { id: 3, name: 'Andrew & West',    initials: 'AW', spots: 2, weeks: ['June'], note: 'Full room · June' },
  { id: 4, name: 'Christian & Matt', initials: 'CM', spots: 2, weeks: ['May'],  note: 'Full room · May'  },
];

const COST  = 828.13;
const TOTAL = 33125;

const INITIALS_COLORS = ['#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e'];

const WEEK_TAG_CLASS = {
  May: 'tag-pink', June: 'tag-amber', July: 'tag-sky', August: 'tag-violet', Sept: 'tag-teal',
};

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  grid:          buildInitialGrid(),
  guestRegistry: {},
  activeTab:     'grid',
  modal:         null,
};

// Push current state up to Firebase
function persistState() {
  set(stateRef, {
    grid:          state.grid,
    guestRegistry: state.guestRegistry,
  });
}

// Restore numeric keys that Firebase converts to strings
function hydrateGrid(raw) {
  const grid = {};
  Object.keys(raw).forEach(wId => {
    grid[+wId] = {};
    Object.keys(raw[wId]).forEach(rId => {
      grid[+wId][+rId] = raw[wId][rId];
    });
  });
  return grid;
}

// Listen for changes from Firebase — fires on load and on every remote update
onValue(stateRef, snapshot => {
  const data = snapshot.val();
  if (data) {
    state.grid          = hydrateGrid(data.grid);
    state.guestRegistry = data.guestRegistry || {};
  } else {
    // Database is empty (first ever load) — push the blank initial state
    persistState();
  }
  render();
});

function buildInitialGrid() {
  const grid = {};
  WEEKS.forEach(w => {
    grid[w.id] = {};
    ROOMS.forEach(r => {
      grid[w.id][r.id] = [
        { name: r.owner, paid: false, isOwner: true },
        { name: r.owner, paid: false, isOwner: true },
      ];
    });
  });
  return grid;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getOwner  = name => OWNERS.find(o => o.name === name);
const getRoom   = id   => ROOMS.find(r => r.id === id);
const fmt       = n    => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct       = (a, b) => b > 0 ? Math.min(100, Math.round(a / b * 100)) : 0;
const esc       = s    => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function guestColor(name) {
  const idx = state.guestRegistry[name] ?? 0;
  return GUEST_COLORS[idx % GUEST_COLORS.length];
}

function ensureGuestColor(name) {
  if (state.guestRegistry[name] !== undefined) return;
  const used = Object.values(state.guestRegistry);
  let next = 0;
  while (used.includes(next)) next++;
  state.guestRegistry[name] = next;
}

// ─── Derived data ─────────────────────────────────────────────────────────────

function ownerStats() {
  return OWNERS.map(owner => {
    const rooms = ROOMS.filter(r => owner.rooms.includes(r.id));
    let recovered = 0, totalGuests = 0, paidGuests = 0;
    rooms.forEach(room => {
      WEEKS.forEach(week => {
        state.grid[week.id][room.id].forEach(slot => {
          if (!slot.isOwner) {
            totalGuests++;
            if (slot.paid) { recovered += COST; paidGuests++; }
          }
        });
      });
    });
    return { ...owner, recovered, remaining: owner.fronted - recovered, totalGuests, paidGuests };
  });
}

function guestRoster() {
  const map = {};
  WEEKS.forEach(week => {
    ROOMS.forEach(room => {
      state.grid[week.id][room.id].forEach(slot => {
        if (!slot.isOwner) {
          if (!map[slot.name]) map[slot.name] = { name: slot.name, slots: [] };
          map[slot.name].slots.push({ week: week.label, room: room.label, owner: room.owner, paid: slot.paid });
        }
      });
    });
  });
  return Object.values(map).map(e => ({
    ...e,
    color:     guestColor(e.name),
    totalOwed: e.slots.length * COST,
    totalPaid: e.slots.filter(s => s.paid).length * COST,
  }));
}

function reimbursements() {
  const list = [];
  WEEKS.forEach(week => {
    ROOMS.forEach(room => {
      state.grid[week.id][room.id].forEach((slot, slotIdx) => {
        if (!slot.isOwner) {
          list.push({
            guest: slot.name, week: week.label, dates: week.dates,
            room: room.label, owner: room.owner,
            ownerColor: getOwner(room.owner).color,
            amount: COST, paid: slot.paid,
          });
        }
      });
    });
  });
  return list;
}

// ─── Mutations ────────────────────────────────────────────────────────────────

function saveSlot(name, paid) {
  const { weekId, roomId, slotIdx } = state.modal;
  const room    = getRoom(roomId);
  const trimmed = name.trim();
  const isOwner = !trimmed;

  if (!isOwner) ensureGuestColor(trimmed);

  state.grid[weekId][roomId][slotIdx] = {
    name:    isOwner ? room.owner : trimmed,
    paid:    isOwner ? false : paid,
    isOwner,
  };

  persistState();
  closeModal();
  render();
}

function togglePaid(weekId, roomId, slotIdx) {
  const slot = state.grid[weekId][roomId][slotIdx];
  if (slot.isOwner) return;
  slot.paid = !slot.paid;
  persistState();
  render();
}

function moveGuest(src, dst) {
  if (src.weekId === dst.weekId && src.roomId === dst.roomId && src.slotIdx === dst.slotIdx) return;
  const srcSlot = { ...state.grid[src.weekId][src.roomId][src.slotIdx] };
  const dstSlot = { ...state.grid[dst.weekId][dst.roomId][dst.slotIdx] };

  if (dstSlot.isOwner) {
    state.grid[dst.weekId][dst.roomId][dst.slotIdx] = srcSlot;
    state.grid[src.weekId][src.roomId][src.slotIdx] = { name: getRoom(src.roomId).owner, paid: false, isOwner: true };
  } else {
    state.grid[dst.weekId][dst.roomId][dst.slotIdx] = srcSlot;
    state.grid[src.weekId][src.roomId][src.slotIdx] = dstSlot;
  }
  persistState();
  render();
}

// ─── Icons ────────────────────────────────────────────────────────────────────

const checkIcon = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M5 13l4 4L19 7"/></svg>`;
const minusIcon = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><path d="M5 12h14"/></svg>`;
const editIcon  = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="10" height="10"><path d="M15.232 5.232l3.536 3.536M9 11l6.536-6.536a2 2 0 012.828 2.828L11.828 13.828a4 4 0 01-1.414.94l-3.414.854.854-3.414a4 4 0 01.94-1.414z"/></svg>`;
const clockIcon = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
const trashIcon = () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/></svg>`;

// ─── Render: Dashboard ────────────────────────────────────────────────────────

function renderDashboard() {
  const stats     = ownerStats();
  const recovered = stats.reduce((s, o) => s + o.recovered, 0);
  const remaining = TOTAL - recovered;

  document.getElementById('dashboard').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="metric-row">
        <div class="card metric-card">
          <div class="metric-label">Season Cost</div>
          <div class="metric-value">$${TOTAL.toLocaleString()}</div>
          <div class="metric-sub">Rent + utils + fees</div>
        </div>
        <div class="card metric-card">
          <div class="metric-label">Recovered</div>
          <div class="metric-value green">$${fmt(recovered)}</div>
          <div class="metric-sub">${pct(recovered, TOTAL)}% of season</div>
        </div>
        <div class="card metric-card">
          <div class="metric-label">Still Owed</div>
          <div class="metric-value ${remaining > 0 ? 'red' : 'green'}">$${fmt(remaining)}</div>
          <div class="metric-sub">Across all owners</div>
        </div>
      </div>

      <div class="owner-row">
        ${stats.map(o => {
          const p = pct(o.recovered, o.fronted);
          return `
            <div class="card owner-card">
              <div class="owner-bar-track">
                <div class="owner-bar-fill" style="width:${p}%;background:${o.color}"></div>
              </div>
              <div class="owner-header">
                <div class="owner-name-row">
                  <span class="dot" style="background:${o.color}"></span>
                  <span class="owner-name">${o.name}</span>
                </div>
                <span class="owner-pct">${p}% back</span>
              </div>
              <dl class="owner-dl">
                <div class="dl-row"><dt>Fronted</dt><dd>$${fmt(o.fronted)}</dd></div>
                <div class="dl-row"><dt>Recovered</dt><dd class="green">+$${fmt(o.recovered)}</dd></div>
                <div class="dl-row dl-total">
                  <dt>Owed back</dt>
                  <dd class="${o.remaining > 0 ? 'red' : 'green'}">$${fmt(o.remaining)}</dd>
                </div>
              </dl>
              <div class="progress-bar">
                <div class="progress-fill" style="width:${p}%;background:${o.color}"></div>
              </div>
              <div class="owner-slots">${o.paidGuests} / ${o.totalGuests} guest slots paid</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ─── Render: Grid ─────────────────────────────────────────────────────────────

function slotHTML(slot, weekId, roomId, slotIdx) {
  if (slot.isOwner) {
    return `
      <div class="slot slot-empty"
           data-week="${weekId}" data-room="${roomId}" data-slot="${slotIdx}"
           data-action="open-modal" data-dropzone="true">
        <svg class="plus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>Add guest</span>
      </div>`;
  }

  const color       = guestColor(slot.name);
  const borderColor = slot.paid ? '#34d399' : '#fbbf24';
  const paidClass   = slot.paid ? 'slot-paid' : 'slot-unpaid';
  const statusClass = slot.paid ? 'status-paid' : 'status-unpaid';
  const btnClass    = slot.paid ? 'btn-paid' : 'btn-unpaid';

  return `
    <div class="slot slot-guest ${paidClass}"
         style="border-left-color:${borderColor}"
         draggable="true"
         data-week="${weekId}" data-room="${roomId}" data-slot="${slotIdx}"
         data-dropzone="true">
      <span class="dot" style="background:${color}"></span>
      <div class="slot-info">
        <div class="slot-name">${esc(slot.name)}</div>
        <div class="slot-status ${statusClass}">${slot.paid ? 'Paid' : 'Unpaid'} · $828</div>
      </div>
      <div class="slot-actions">
        <button class="slot-btn ${btnClass}"
                data-action="toggle-paid"
                data-week="${weekId}" data-room="${roomId}" data-slot="${slotIdx}"
                title="${slot.paid ? 'Mark unpaid' : 'Mark paid'}">
          ${slot.paid ? checkIcon() : minusIcon()}
        </button>
        <button class="slot-btn btn-edit"
                data-action="open-modal"
                data-week="${weekId}" data-room="${roomId}" data-slot="${slotIdx}"
                title="Edit">
          ${editIcon()}
        </button>
      </div>
    </div>`;
}

let dragSrc = null;

function renderGrid() {
  document.getElementById('tab-content').innerHTML = `
    <div class="card grid-card">
      <div class="grid-scroll">
        <table class="grid-table">
          <thead>
            <tr>
              <th class="week-col"><span class="col-label">Week</span></th>
              ${ROOMS.map(room => {
                const owner = getOwner(room.owner);
                return `
                  <th class="room-col">
                    <div class="room-header">
                      <span class="dot" style="background:${owner.color}"></span>
                      <div>
                        <div class="room-label">${room.label}</div>
                        <div class="room-owner">${room.owner}</div>
                      </div>
                    </div>
                  </th>`;
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${WEEKS.map((week, wi) => `
              <tr class="${wi % 2 === 1 ? 'row-alt' : ''}">
                <td class="week-cell">
                  <div class="week-label">${week.label}</div>
                  <div class="week-dates">${week.dates}</div>
                </td>
                ${ROOMS.map(room => `
                  <td class="slot-cell">
                    ${state.grid[week.id][room.id].map((slot, idx) =>
                      slotHTML(slot, week.id, room.id, idx)
                    ).join('')}
                  </td>`).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="grid-legend">
        <div class="legend-item"><span class="legend-line amber"></span>Unpaid guest</div>
        <div class="legend-item"><span class="legend-line green"></span>Paid guest</div>
        <div class="legend-item legend-dashed">+ Available slot</div>
        <div class="legend-item muted">Drag to rearrange</div>
      </div>
    </div>
  `;

  const content = document.getElementById('tab-content');

  // Click delegation
  content.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action } = el.dataset;
    const weekId = +el.dataset.week, roomId = +el.dataset.room, slotIdx = +el.dataset.slot;
    if (action === 'toggle-paid') { e.stopPropagation(); togglePaid(weekId, roomId, slotIdx); }
    else if (action === 'open-modal') openModal(weekId, roomId, slotIdx);
  });

  // Drag & drop delegation
  content.addEventListener('dragstart', e => {
    const el = e.target.closest('.slot-guest');
    if (!el) return;
    dragSrc = { weekId: +el.dataset.week, roomId: +el.dataset.room, slotIdx: +el.dataset.slot };
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  content.addEventListener('dragover', e => {
    const zone = e.target.closest('[data-dropzone]');
    if (!zone || !dragSrc) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    zone.classList.add('drag-over');
  });

  content.addEventListener('dragleave', e => {
    const zone = e.target.closest('[data-dropzone]');
    if (zone) zone.classList.remove('drag-over');
  });

  content.addEventListener('drop', e => {
    const zone = e.target.closest('[data-dropzone]');
    if (!zone || !dragSrc) return;
    e.preventDefault();
    zone.classList.remove('drag-over');
    moveGuest(dragSrc, { weekId: +zone.dataset.week, roomId: +zone.dataset.room, slotIdx: +zone.dataset.slot });
    dragSrc = null;
  });

  content.addEventListener('dragend', () => {
    dragSrc = null;
    document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });
}

// ─── Render: Guest Roster ─────────────────────────────────────────────────────

function renderGuestRoster() {
  const roster = guestRoster();
  const el     = document.getElementById('tab-content');

  if (roster.length === 0) {
    el.innerHTML = `<div class="card empty-state"><p class="empty-text">No guests yet — add them in the Grid.</p></div>`;
    return;
  }

  const totalOutstanding = roster.reduce((s, e) => s + (e.totalOwed - e.totalPaid), 0);

  el.innerHTML = `
    <div class="space-y">
      <div class="card">
        ${roster.map((entry, i) => {
          const paidCount    = entry.slots.filter(s => s.paid).length;
          const pendingCount = entry.slots.length - paidCount;
          return `
            ${i > 0 ? '<div class="divider"></div>' : ''}
            <div class="roster-row">
              <div class="roster-left">
                <div class="roster-name-row">
                  <span class="dot dot-lg" style="background:${entry.color}"></span>
                  <span class="roster-name">${esc(entry.name)}</span>
                </div>
                <div class="roster-tags">
                  ${entry.slots.map(s => `<span class="week-tag">${s.week}</span>`).join('')}
                </div>
                <div class="roster-details">
                  ${entry.slots.map(s => `
                    <div class="roster-detail">
                      ${s.room} · ${s.owner}
                      <span class="${s.paid ? 'detail-paid' : 'detail-pending'}"> · ${s.paid ? 'paid' : 'pending'}</span>
                    </div>`).join('')}
                </div>
              </div>
              <div class="roster-right">
                <div class="roster-total">$${fmt(entry.totalOwed)}</div>
                <div class="roster-breakdown">
                  ${paidCount    > 0 ? `<span class="green">${paidCount} paid</span>` : ''}
                  ${paidCount    > 0 && pendingCount > 0 ? ' · ' : ''}
                  ${pendingCount > 0 ? `<span class="amber">${pendingCount} pending</span>` : ''}
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>
      <div class="card summary-row">
        <span>Total outstanding across all guests</span>
        <span class="summary-amount amber">$${fmt(totalOutstanding)}</span>
      </div>
    </div>
  `;
}

// ─── Render: Interest Queue ───────────────────────────────────────────────────

function renderInterestQueue() {
  const totalPotential = INTEREST_QUEUE.reduce((s, p) => s + p.spots * p.weeks.length * COST, 0);

  document.getElementById('tab-content').innerHTML = `
    <div class="space-y">
      <div class="card">
        ${INTEREST_QUEUE.map((person, i) => {
          const total = person.spots * person.weeks.length * COST;
          return `
            ${i > 0 ? '<div class="divider"></div>' : ''}
            <div class="queue-row">
              <div class="avatar" style="background:${INITIALS_COLORS[i % INITIALS_COLORS.length]}">${person.initials}</div>
              <div class="queue-info">
                <div class="queue-name-row">
                  <span class="queue-name">${esc(person.name)}</span>
                  <span class="queue-note">${person.note}</span>
                </div>
                <div class="queue-tags">
                  ${person.weeks.map(w => `<span class="week-chip ${WEEK_TAG_CLASS[w] || ''}">${w}</span>`).join('')}
                </div>
              </div>
              <div class="queue-cost">
                <div class="cost-amount">$${fmt(total)}</div>
                <div class="cost-detail">${person.spots} spot${person.spots > 1 ? 's' : ''} × ${person.weeks.length} wk${person.weeks.length > 1 ? 's' : ''}</div>
              </div>
            </div>`;
        }).join('')}
      </div>
      <div class="card summary-row">
        <span>Total potential recovery from queue</span>
        <span class="summary-amount">$${fmt(totalPotential)}</span>
      </div>
    </div>
  `;
}

// ─── Render: Reimbursements ───────────────────────────────────────────────────

function renderReimbursements() {
  const list = reimbursements();
  const el   = document.getElementById('tab-content');

  if (list.length === 0) {
    el.innerHTML = `
      <div class="card empty-state">
        <p class="empty-text">No guests assigned yet</p>
        <p class="empty-sub">Add guests in the Grid to track payments here</p>
      </div>`;
    return;
  }

  const collected   = list.filter(r =>  r.paid).reduce((s, r) => s + r.amount, 0);
  const outstanding = list.filter(r => !r.paid).reduce((s, r) => s + r.amount, 0);
  const byOwner     = OWNERS
    .map(o => ({ ...o, rows: list.filter(r => r.owner === o.name) }))
    .filter(o => o.rows.length > 0);

  el.innerHTML = `
    <div class="space-y">
      <div class="card reimb-summary">
        <div class="reimb-metric">
          <div class="metric-label">Entries</div>
          <div class="metric-value">${list.length}</div>
        </div>
        <div class="reimb-divider"></div>
        <div class="reimb-metric">
          <div class="metric-label">Collected</div>
          <div class="metric-value green">$${fmt(collected)}</div>
        </div>
        <div class="reimb-divider"></div>
        <div class="reimb-metric">
          <div class="metric-label">Outstanding</div>
          <div class="metric-value amber">$${fmt(outstanding)}</div>
        </div>
      </div>

      ${byOwner.map(owner => {
        const ownerCollected = owner.rows.filter(r => r.paid).reduce((s, r) => s + r.amount, 0);
        const ownerOwed      = owner.rows.filter(r => !r.paid).reduce((s, r) => s + r.amount, 0);
        return `
          <div class="card table-card">
            <div class="table-header">
              <span class="dot" style="background:${owner.color}"></span>
              <span class="table-owner-name">${owner.name}</span>
              <div class="table-header-amounts">
                <span class="green">$${fmt(ownerCollected)} in</span>
                <span class="amber">$${fmt(ownerOwed)} pending</span>
              </div>
            </div>
            <div class="table-scroll">
              <table class="reimb-table">
                <thead>
                  <tr>
                    <th>Guest</th><th>Week</th>
                    <th class="hide-sm">Room</th>
                    <th class="text-right">Amount</th>
                    <th class="text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${owner.rows.map(r => `
                    <tr>
                      <td class="fw-medium">${esc(r.guest)}</td>
                      <td>
                        <div class="fw-medium">${r.week}</div>
                        <div class="text-muted text-sm">${r.dates}</div>
                      </td>
                      <td class="hide-sm text-muted text-sm">${r.room}</td>
                      <td class="text-right fw-medium">$${r.amount.toFixed(2)}</td>
                      <td class="text-right">
                        ${r.paid
                          ? `<span class="status-badge status-paid-badge">${checkIcon()} Paid</span>`
                          : `<span class="status-badge status-pending-badge">${clockIcon()} Pending</span>`}
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>`;
      }).join('')}

      <div class="card grand-total">
        <div class="total-row">
          <span>Total due from guests</span>
          <span class="fw-medium">$${fmt(list.reduce((s, r) => s + r.amount, 0))}</span>
        </div>
        <div class="total-row">
          <span>Collected</span>
          <span class="fw-medium green">+$${fmt(collected)}</span>
        </div>
        <div class="total-row total-row-final">
          <span class="fw-medium">Still outstanding</span>
          <span class="total-final-amount amber">$${fmt(outstanding)}</span>
        </div>
      </div>
    </div>
  `;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function openModal(weekId, roomId, slotIdx) {
  state.modal = { weekId, roomId, slotIdx };
  renderModal();
}

function closeModal() {
  state.modal = null;
  document.getElementById('modal-overlay').classList.add('hidden');
}

function renderModal() {
  const { weekId, roomId, slotIdx } = state.modal;
  const slot  = state.grid[weekId][roomId][slotIdx];
  const room  = getRoom(roomId);
  const week  = WEEKS.find(w => w.id === weekId);
  const known = Object.keys(state.guestRegistry);

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');

  let isPaid = slot.paid;

  document.getElementById('modal-box').innerHTML = `
    <div class="modal-header">
      <div>
        <h2 class="modal-title">Assign Guest</h2>
        <p class="modal-sub">${week.label} · ${week.dates} · ${room.label}</p>
      </div>
      <button class="modal-close" id="btn-modal-close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">
      <div class="modal-meta">
        <span class="meta-label">Room owner</span>
        <span class="meta-value">${room.owner}</span>
      </div>

      <div class="form-group">
        <label class="form-label">Guest Name</label>
        <div class="input-wrap">
          <input type="text" id="modal-input" class="form-input"
                 value="${esc(slot.isOwner ? '' : slot.name)}"
                 placeholder="Leave blank to keep as ${room.owner}"
                 autocomplete="off">
          <ul class="autocomplete-list hidden" id="autocomplete"></ul>
        </div>
      </div>

      <div class="payment-group ${slot.isOwner || !slot.name ? 'hidden' : ''}" id="payment-group">
        <label class="form-label">Payment</label>
        <div class="payment-btns">
          <button class="payment-btn ${!isPaid ? 'payment-btn-unpaid-active' : ''}" id="btn-unpaid">Unpaid</button>
          <button class="payment-btn ${isPaid  ? 'payment-btn-paid-active'   : ''}" id="btn-paid">Paid · $${COST}</button>
        </div>
      </div>

      <div class="modal-actions">
        ${!slot.isOwner ? `<button class="btn-clear" id="btn-clear">${trashIcon()} Clear</button>` : ''}
        <button class="btn-cancel" id="btn-cancel">Cancel</button>
        <button class="btn-save"   id="btn-save">Save</button>
      </div>
    </div>
  `;

  const input        = document.getElementById('modal-input');
  const paymentGroup = document.getElementById('payment-group');
  const autocomplete = document.getElementById('autocomplete');
  const btnUnpaid    = document.getElementById('btn-unpaid');
  const btnPaid      = document.getElementById('btn-paid');

  function updateVisibility() {
    paymentGroup.classList.toggle('hidden', !input.value.trim());
  }

  function updateAutocomplete() {
    const val = input.value.toLowerCase();
    const matches = known.filter(n => n.toLowerCase().includes(val) && n.toLowerCase() !== val).slice(0, 6);
    if (!matches.length || !val) { autocomplete.classList.add('hidden'); return; }
    autocomplete.innerHTML = matches.map(n => `
      <li class="autocomplete-item" data-name="${esc(n)}">
        <span class="dot" style="background:${guestColor(n)}"></span>${esc(n)}
      </li>`).join('');
    autocomplete.classList.remove('hidden');
  }

  input.addEventListener('input',  () => { updateVisibility(); updateAutocomplete(); });
  input.addEventListener('focus',  updateAutocomplete);
  input.addEventListener('blur',   () => setTimeout(() => autocomplete.classList.add('hidden'), 150));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') saveSlot(input.value, isPaid); });

  autocomplete.addEventListener('click', e => {
    const item = e.target.closest('.autocomplete-item');
    if (!item) return;
    input.value = item.dataset.name;
    autocomplete.classList.add('hidden');
    updateVisibility();
  });

  btnUnpaid.addEventListener('click', () => {
    isPaid = false;
    btnUnpaid.className = 'payment-btn payment-btn-unpaid-active';
    btnPaid.className   = 'payment-btn';
  });

  btnPaid.addEventListener('click', () => {
    isPaid = true;
    btnPaid.className   = 'payment-btn payment-btn-paid-active';
    btnUnpaid.className = 'payment-btn';
  });

  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-save').addEventListener('click', () => saveSlot(input.value, isPaid));

  const clearBtn = document.getElementById('btn-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => saveSlot('', false));

  overlay.onclick = e => { if (e.target === overlay) closeModal(); };

  input.focus();
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function renderTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === state.activeTab);
  });
}

function renderTabContent() {
  switch (state.activeTab) {
    case 'grid':          return renderGrid();
    case 'guests':        return renderGuestRoster();
    case 'queue':         return renderInterestQueue();
    case 'reimbursement': return renderReimbursements();
  }
}

// ─── Main render ──────────────────────────────────────────────────────────────

function render() {
  renderDashboard();
  renderTabs();
  renderTabContent();
}

// ─── Init ─────────────────────────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeTab = btn.dataset.tab;
    render();
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && state.modal) closeModal();
});

// Render owner dots in header (static, doesn't need Firebase)
document.getElementById('header-owners').innerHTML = OWNERS.map(o => `
  <div class="header-owner">
    <span class="dot" style="background:${o.color}"></span>
    <span>${o.name}</span>
  </div>`).join('');
