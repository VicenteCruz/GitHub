import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// COLA AQUI O TEU firebaseConfig DO FIREBASE CONSOLE
const firebaseConfig = {
    apiKey: "AIzaSyCUDZHVNKP7r6Iq0qqOO1L2sGPXyz33TVI",
    authDomain: "teamtracker-genibet.firebaseapp.com",
    projectId: "teamtracker-genibet",
    storageBucket: "teamtracker-genibet.firebasestorage.app",
    messagingSenderId: "174498195023",
    appId: "1:174498195023:web:51f7e9d0f99277dee5ec3a"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- Constantes de Domínio ---
const TEAMS_COUNT = 8;
const MEMBERS_PER_TEAM = 5;
const DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];
const ROOMS = Array.from({ length: 15 }, (_, i) => `SALA ${i + 1}`);
const MONTHS_PT_SHORT = ['jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];

function startOfWeekMonday(date) {
    const x = new Date(date);
    x.setHours(0, 0, 0, 0);
    const wd = x.getDay();
    const offset = wd === 0 ? -6 : 1 - wd;
    x.setDate(x.getDate() + offset);
    return x;
}

function formatCalendarDay(d) {
    return `${d.getDate()} ${MONTHS_PT_SHORT[d.getMonth()]}`;
}

function refreshMasterDayLabels(weekMonday) {
    document.querySelectorAll('#master-body tr').forEach((row, i) => {
        if (i >= DAYS.length) return;
        const sticky = row.querySelector('.sticky-col.day-col');
        if (!sticky) return;
        const dt = new Date(weekMonday);
        dt.setDate(weekMonday.getDate() + i);
        const calEl = sticky.querySelector('.day-cal');
        const nameEl = sticky.querySelector('.day-name');
        if (nameEl) nameEl.textContent = DAYS[i];
        if (calEl) calEl.textContent = formatCalendarDay(dt);
    });
}

// --- Estado da Aplicação ---
let currentWeekDate = new Date();
let appData = {
    allocations: {},
    opsDetails: {},
    role: 'viewer',
    isDirty: false
};
let unsubAllocations = null;
let unsubOpsDetails = null;

const canEdit = () => appData.role === 'editor' || appData.role === 'admin';

const getWeekId = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const year = d.getFullYear();
    const week = Math.ceil((((d - new Date(year, 0, 1)) / 86400000) + 1) / 7);
    return `${year}-W${String(week).padStart(2, '0')}`;
};

const updateWeekDisplay = () => {
    const weekMonday = startOfWeekMonday(currentWeekDate);
    const weekFriday = new Date(weekMonday);
    weekFriday.setDate(weekMonday.getDate() + 4);

    const rangeEl = document.getElementById('week-range-line');
    const metaEl = document.getElementById('week-meta-line');
    const sameMonth = weekMonday.getMonth() === weekFriday.getMonth();

    if (rangeEl) {
        rangeEl.textContent = sameMonth
            ? `${weekMonday.getDate()}–${weekFriday.getDate()} ${MONTHS_PT_SHORT[weekMonday.getMonth()]} ${weekMonday.getFullYear()}`
            : `${formatCalendarDay(weekMonday)} – ${formatCalendarDay(weekFriday)} ${weekFriday.getFullYear()}`;
    }
    if (metaEl) {
        const weekId = getWeekId(currentWeekDate);
        const m = weekId.match(/W(\d+)/);
        const n = m ? parseInt(m[1], 10) : '';
        metaEl.textContent = `Semana ${n} · dias úteis (seg.–sex.)`;
    }

    refreshMasterDayLabels(weekMonday);
    loadData();
};

// --- Inicialização ---
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    setupAuth();
    loadData(); // No cenário real, isto viria do Firestore onSnapshot
});

function initUI() {
    // Renderizar Cabeçalhos da Tab 1
    const headerTeams = document.getElementById('header-teams');
    const headerMembers = document.getElementById('header-members');

    for (let i = 1; i <= TEAMS_COUNT; i++) {
        const thTeam = document.createElement('th');
        thTeam.className = 'sheet-team-header';
        thTeam.textContent = `Equipa ${i}`;
        thTeam.colSpan = MEMBERS_PER_TEAM;
        headerTeams.appendChild(thTeam);

        for (let j = 1; j <= MEMBERS_PER_TEAM; j++) {
            const thMember = document.createElement('th');
            thMember.className = 'sheet-member-header';
            thMember.textContent = `F${j}`;
            thMember.title = `Funcionário ${j} da Equipa ${i}`;
            headerMembers.appendChild(thMember);
        }
    }

    // Renderizar Linhas da Tab 1
    const masterBody = document.getElementById('master-body');
    const weekMonInit = startOfWeekMonday(currentWeekDate);
    DAYS.forEach((day, dayIdx) => {
        const row = document.createElement('tr');
        row.className = 'sheet-row';

        const dayCell = document.createElement('td');
        dayCell.className = 'sticky-col day-col';
        const d0 = new Date(weekMonInit);
        d0.setDate(weekMonInit.getDate() + dayIdx);
        dayCell.innerHTML = `<span class="day-name">${day}</span><span class="day-cal">${formatCalendarDay(d0)}</span>`;
        row.appendChild(dayCell);

        for (let t = 1; t <= TEAMS_COUNT; t++) {
            for (let m = 1; m <= MEMBERS_PER_TEAM; m++) {
                const td = document.createElement('td');
                const memberId = `T${t}M${m}`;
                td.className = 'assignment-cell assignment-cell--empty';
                td.dataset.day = day;
                td.dataset.member = memberId;

                const rail = document.createElement('div');
                rail.className = 'assign-rail';
                rail.setAttribute('role', 'radiogroup');
                rail.setAttribute('aria-label', `Alocação ${day} ${memberId}`);

                const chipDefs = [
                    { value: 'ROOM_TRIGGER', label: 'S', cls: 'assign-chip assign-chip-room', title: 'Selecionar Sala' },
                    { value: 'TASK', label: 'T', cls: 'assign-chip assign-chip-task', title: 'Outra tarefa (nota)' }
                ];

                chipDefs.forEach((def) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = def.cls;
                    btn.setAttribute('data-value', def.value);
                    btn.textContent = def.label;
                    btn.title = def.title;
                    btn.setAttribute('role', 'radio');
                    btn.setAttribute('aria-checked', 'false');
                    btn.disabled = !canEdit();
                    btn.addEventListener('click', handleAssignmentChipClick);
                    rail.appendChild(btn);
                });

                const noteInput = document.createElement('input');
                noteInput.type = 'text';
                noteInput.className = 'task-note-input hidden';
                noteInput.placeholder = 'Nota da tarefa…';
                noteInput.dataset.day = day;
                noteInput.dataset.member = memberId;
                noteInput.disabled = !canEdit();
                noteInput.addEventListener('input', handleTaskNoteInput);

                td.appendChild(rail);
                td.appendChild(noteInput);
                row.appendChild(td);
            }
        }
        masterBody.appendChild(row);
    });

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');

            if (btn.dataset.tab === 'tab2') renderTab2();
        });
    });

    // Save Button (Ambos os botões de guardar)
    document.getElementById('save-btn').addEventListener('click', saveData);
    document.getElementById('save-header-btn').addEventListener('click', saveData);

    // Navegação de Semanas
    document.getElementById('prev-week').addEventListener('click', () => {
        currentWeekDate.setDate(currentWeekDate.getDate() - 7);
        updateWeekDisplay();
    });
    document.getElementById('next-week').addEventListener('click', () => {
        currentWeekDate.setDate(currentWeekDate.getDate() + 7);
        updateWeekDisplay();
    });

    // Botão Limpar
    document.getElementById('clear-btn').addEventListener('click', () => {
        if (confirm("Tens a certeza que queres limpar TODA a alocação desta semana?")) {
            appData.allocations = {};
            appData.opsDetails = {};
            document.querySelectorAll('.assignment-cell').forEach((td) => {
                syncAssignmentCellUI(td, null);
                const inp = td.querySelector('.task-note-input');
                if (inp) {
                    inp.value = '';
                    inp.classList.add('hidden');
                }
            });
            document.querySelectorAll('#ops-table textarea').forEach(textarea => textarea.value = "");
            document.querySelectorAll('.ops-work-toggle').forEach(toggle => toggle.checked = false);
            renderTab2();
            markDirty();
        }
    });

    updateWeekDisplay();
    setupRoomTaskModal();
    setupRoomPickerModal();

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const overlay = document.getElementById('room-task-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            closeRoomTaskModal();
        }
    });
}

function roomOperationalTaskMissing(day, roomName) {
    const raw = (appData.opsDetails[day] && appData.opsDetails[day][roomName]) || {};
    const ops = normalizeRoomOps(raw);
    return ops.taskText.trim().length === 0;
}

function openRoomTaskPrompt(day, roomName) {
    const overlay = document.getElementById('room-task-overlay');
    const sub = document.getElementById('room-task-sub');
    const ta = document.getElementById('room-task-textarea');
    const err = document.getElementById('room-task-err');
    if (!overlay || !ta) return;

    overlay.dataset.day = day;
    overlay.dataset.room = roomName;
    sub.textContent = `${day} · ${roomName}`;

    // Carregar texto existente se houver
    const existing = (appData.opsDetails[day] && appData.opsDetails[day][roomName]) || {};
    ta.value = existing.taskText || '';

    err.textContent = '';
    err.classList.add('hidden');
    overlay.classList.remove('hidden');
    ta.focus();
}

function closeRoomTaskModal() {
    const overlay = document.getElementById('room-task-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    delete overlay.dataset.day;
    delete overlay.dataset.room;
}

function setupRoomTaskModal() {
    const overlay = document.getElementById('room-task-overlay');
    const cancelBtn = document.getElementById('room-task-cancel');
    const saveBtn = document.getElementById('room-task-save');
    const ta = document.getElementById('room-task-textarea');
    const err = document.getElementById('room-task-err');
    if (!overlay || !cancelBtn || !saveBtn || !ta) return;

    cancelBtn.addEventListener('click', closeRoomTaskModal);

    saveBtn.addEventListener('click', () => {
        const day = overlay.dataset.day;
        const roomName = overlay.dataset.room;
        if (!day || !roomName) return;

        const text = ta.value.trim();
        // Permitimos guardar vazio se o utilizador quiser limpar a tarefa

        if (!appData.opsDetails[day]) appData.opsDetails[day] = {};
        appData.opsDetails[day][roomName] = {
            hasWork: text.length > 0,
            taskText: text
        };
        markDirty();

        // Atualizar UI de ambas as tabs para garantir consistência
        updateTableUI();
        if (document.querySelector('.tab-btn[data-tab="tab2"]').classList.contains('active')) {
            renderTab2();
        }
        closeRoomTaskModal();
    });
}

function setupRoomPickerModal() {
    const overlay = document.getElementById('room-picker-overlay');
    const grid = document.getElementById('room-picker-grid');
    const cancelBtn = document.getElementById('room-picker-cancel');
    if (!overlay || !grid || !cancelBtn) return;

    // Gerar botões de sala
    grid.innerHTML = '';
    ROOMS.forEach((room, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'picker-room-btn';
        btn.textContent = `${i + 1}`;
        btn.title = room;
        btn.addEventListener('click', () => {
            const day = overlay.dataset.day;
            const member = overlay.dataset.member;
            if (day && member) {
                applyMasterAssignment(day, member, room);
            }
            closeRoomPickerModal();
        });
        grid.appendChild(btn);
    });

    cancelBtn.addEventListener('click', closeRoomPickerModal);

    const clearBtn = document.getElementById('room-picker-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const day = overlay.dataset.day;
            const member = overlay.dataset.member;
            if (day && member) {
                applyMasterAssignment(day, member, '');
            }
            closeRoomPickerModal();
        });
    }
}

function openRoomPickerModal(day, member) {
    const overlay = document.getElementById('room-picker-overlay');
    if (!overlay) return;
    overlay.dataset.day = day;
    overlay.dataset.member = member;
    overlay.classList.remove('hidden');
}

function closeRoomPickerModal() {
    const overlay = document.getElementById('room-picker-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    delete overlay.dataset.day;
    delete overlay.dataset.member;
}

// --- Lógica de Dados ---

function handleAssignmentChipClick(e) {
    const chip = e.currentTarget;
    if (chip.disabled) return;
    const td = chip.closest('.assignment-cell');
    if (!td) return;

    const value = chip.getAttribute('data-value') ?? '';
    const day = td.dataset.day;
    const member = td.dataset.member;

    // Se já estiver selecionado, limpamos (toggle off)
    const currentEntry = normalizeMemberAssignment(appData.allocations[day]?.[member]);
    let newValue = value;

    if (currentEntry.kind === 'room' && value === 'ROOM_TRIGGER') {
        // Se já tem sala e clicou em S, abrimos o picker para mudar
        openRoomPickerModal(day, member);
        return;
    }

    if (value === 'ROOM_TRIGGER') {
        openRoomPickerModal(day, member);
        return;
    }

    if (currentEntry.kind === 'task' && value === 'TASK') newValue = '';

    applyMasterAssignment(day, member, newValue);
}

function syncAssignmentCellUI(td, rawEntry) {
    const entry = normalizeMemberAssignment(rawEntry ?? null);
    const rail = td.querySelector('.assign-rail');
    const noteInput = td.querySelector('.task-note-input');
    if (!rail || !noteInput) return;

    td.classList.remove('assignment-cell--empty', 'assignment-cell--s1', 'assignment-cell--s2', 'assignment-cell--s3', 'assignment-cell--task');

    let selectedValue = '';
    if (!entry.kind) {
        selectedValue = '';
        td.classList.add('assignment-cell--empty');
    } else if (entry.kind === 'room') {
        selectedValue = entry.room || '';
        if (entry.room === 'SALA 1') td.classList.add('assignment-cell--s1');
        else if (entry.room === 'SALA 2') td.classList.add('assignment-cell--s2');
        else if (entry.room === 'SALA 3') td.classList.add('assignment-cell--s3');
    } else {
        selectedValue = 'TASK';
        td.classList.add('assignment-cell--task');
    }

    rail.querySelectorAll('.assign-chip').forEach((btn) => {
        const v = btn.getAttribute('data-value') ?? '';
        let isSel = false;

        if (selectedValue === 'TASK') {
            isSel = (v === 'TASK');
        } else if (selectedValue !== '') {
            // Se houver uma sala selecionada, o chip "S" fica marcado como selecionado
            isSel = (v === 'ROOM_TRIGGER');
            if (isSel) {
                const roomNum = selectedValue.replace('SALA ', '');
                btn.textContent = `S${roomNum}`;
            }
        } else {
            if (v === 'ROOM_TRIGGER') btn.textContent = 'S';
        }

        btn.classList.toggle('is-selected', isSel);
        btn.setAttribute('aria-checked', isSel ? 'true' : 'false');
    });

    noteInput.classList.toggle('hidden', selectedValue !== 'TASK');
}

function applyMasterAssignment(day, member, selectedValue) {
    const td = document.querySelector(`.assignment-cell[data-day="${day}"][data-member="${member}"]`);
    const noteInput = td?.querySelector('.task-note-input');
    if (!noteInput) return;

    if (!appData.allocations[day]) appData.allocations[day] = {};
    if (!selectedValue) {
        delete appData.allocations[day][member];
        if (Object.keys(appData.allocations[day]).length === 0) {
            delete appData.allocations[day];
        }
        noteInput.value = '';
    } else if (selectedValue === 'TASK') {
        const existing = normalizeMemberAssignment(appData.allocations[day][member] || {});
        appData.allocations[day][member] = {
            kind: 'task',
            note: existing.kind === 'task' ? existing.note : ''
        };
        noteInput.value = appData.allocations[day][member].note || '';
    } else {
        appData.allocations[day][member] = {
            kind: 'room',
            room: selectedValue
        };
        noteInput.value = '';
    }

    syncAssignmentCellUI(td, appData.allocations[day]?.[member]);

    markDirty();
    if (document.querySelector('.tab-btn[data-tab="tab2"]').classList.contains('active')) {
        renderTab2();
    }

    if (selectedValue && ROOMS.includes(selectedValue) && canEdit()) {
        queueMicrotask(() => {
            if (roomOperationalTaskMissing(day, selectedValue)) {
                openRoomTaskPrompt(day, selectedValue);
            }
        });
    }
}

function handleTaskNoteInput(e) {
    const { day, member } = e.target.dataset;
    if (!appData.allocations[day]) appData.allocations[day] = {};
    if (!appData.allocations[day][member]) {
        appData.allocations[day][member] = { kind: 'task', note: '' };
    }
    appData.allocations[day][member].kind = 'task';
    appData.allocations[day][member].note = e.target.value;

    const td = document.querySelector(`.assignment-cell[data-day="${day}"][data-member="${member}"]`);
    if (td) syncAssignmentCellUI(td, appData.allocations[day][member]);

    markDirty();
    if (document.querySelector('.tab-btn[data-tab="tab2"]').classList.contains('active')) {
        renderTab2();
    }
}

function renderTab2() {
    const opsHeader = document.getElementById('ops-header');
    const opsBody = document.getElementById('ops-body');
    const weekMonday = startOfWeekMonday(currentWeekDate);

    opsHeader.innerHTML = '<th class="sticky-col sheet-corner">Dia</th>';
    ROOMS.forEach((roomName, ri) => {
        const th = document.createElement('th');
        th.className = `ops-th-room ops-th-room--${ri + 1}`;
        th.innerHTML = `<span class="ops-th-tag">${roomName}</span>`;
        opsHeader.appendChild(th);
    });

    opsBody.innerHTML = '';
    DAYS.forEach((day, dayIdx) => {
        const row = document.createElement('tr');
        row.className = 'sheet-row';

        const dayCell = document.createElement('td');
        dayCell.className = 'sticky-col day-col';
        const dCell = new Date(weekMonday);
        dCell.setDate(weekMonday.getDate() + dayIdx);
        dayCell.innerHTML = `<span class="day-name">${day}</span><span class="day-cal">${formatCalendarDay(dCell)}</span>`;
        row.appendChild(dayCell);

        ROOMS.forEach((roomName, ri) => {
            const td = document.createElement('td');
            const roomOps = normalizeRoomOps((appData.opsDetails[day] && appData.opsDetails[day][roomName]) || {});
            td.className = `ops-cell ops-cell-room ops-cell-room--${ri + 1}`;
            if (roomOps.hasWork) td.classList.add('has-work');

            const container = document.createElement('div');
            container.className = 'ops-interactive-container';
            if (!roomOps.taskText) container.classList.add('is-empty');

            const dash = document.createElement('span');
            dash.className = 'ops-dash';
            dash.textContent = '—';

            const display = document.createElement('div');
            display.className = 'ops-task-display';
            display.textContent = roomOps.taskText || '';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'ops-fill-btn';
            btn.textContent = roomOps.taskText ? 'Editar' : 'Preencher';
            btn.disabled = !canEdit();
            btn.addEventListener('click', () => openRoomTaskPrompt(day, roomName));

            container.appendChild(dash);
            container.appendChild(display);
            container.appendChild(btn);

            // Lista de funcionários alocados (Read-only)
            const workerList = document.createElement('div');
            workerList.className = 'worker-list';

            const dayAllocations = appData.allocations[day] || {};
            Object.entries(dayAllocations).forEach(([mId, entry]) => {
                if (isMemberAssignedToRoom(entry, roomName)) {
                    const span = document.createElement('span');
                    span.className = `worker-tag worker-tag--r${ri + 1}`;
                    const match = mId.match(/T(\d+)M(\d+)/);
                    span.textContent = `E${match[1]}-F${match[2]}`;
                    workerList.appendChild(span);
                }
            });

            td.appendChild(container);
            td.appendChild(workerList);
            row.appendChild(td);
        });
        opsBody.appendChild(row);
    });
}

// --- Funções Auxiliares ---

function markDirty() {
    if (!canEdit()) return;
    appData.isDirty = true;
    document.getElementById('save-bar').classList.remove('hidden');
    document.getElementById('save-header-btn').classList.remove('hidden');
}

async function saveData() {
    const weekId = getWeekId(currentWeekDate);
    try {
        await setDoc(doc(db, "allocations", weekId), { data: appData.allocations }, { merge: true });
        await setDoc(doc(db, "operational_details", weekId), { data: appData.opsDetails }, { merge: true });

        appData.isDirty = false;
        document.getElementById('save-bar').classList.add('hidden');
        document.getElementById('save-header-btn').classList.add('hidden');
        alert("Dados guardados com sucesso no Firebase!");
    } catch (error) {
        console.error("Erro ao guardar:", error);
        alert("Erro ao guardar dados.");
    }
}

function setupAuth() {
    const loginBtn = document.getElementById('login-btn');
    const authOverlay = document.getElementById('auth-overlay');
    const authError = document.getElementById('auth-error');

    loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;

        try {
            await signInWithEmailAndPassword(auth, email, pass);
            authOverlay.classList.add('hidden');
        } catch (error) {
            authError.textContent = "Erro: Email ou password inválidos.";
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            authOverlay.classList.add('hidden');
            // Ir buscar a role ao Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                setRole(userDoc.data().role);
            } else {
                setRole('viewer'); // Padrão se não estiver na lista
            }
            loadData();
        } else {
            authOverlay.classList.remove('hidden');
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        signOut(auth);
        location.reload();
    });
}

function setRole(role) {
    appData.role = role;
    const badge = document.getElementById('user-role-badge');
    const labels = { viewer: 'VIEWER', editor: 'WRITER', admin: 'ADMIN' };
    badge.textContent = labels[role] || String(role).toUpperCase();

    // Cores diferentes para admin e editor
    if (role === 'admin') badge.style.background = '#8b5cf6'; // Roxo para Admin
    else if (role === 'editor') badge.style.background = 'var(--success)';
    else badge.style.background = 'var(--task-bg)';

    // Mostrar/Esconder botões de edição (Permitido para Editor e Admin)
    const hasEditPermission = canEdit();
    document.getElementById('clear-btn').classList.toggle('hidden', !hasEditPermission);
    document.getElementById('save-header-btn').classList.toggle('hidden', !hasEditPermission);

    // Bloquear campos se não tiver permissão
    document.querySelectorAll('.assign-chip').forEach((chip) => {
        chip.disabled = !hasEditPermission;
    });
    document.querySelectorAll('.task-note-input').forEach(input => {
        input.disabled = !hasEditPermission;
    });
    if (document.querySelector('.tab-btn[data-tab="tab2"]').classList.contains('active')) {
        renderTab2();
    }
}

function loadData() {
    const weekId = getWeekId(currentWeekDate);
    if (unsubAllocations) unsubAllocations();
    if (unsubOpsDetails) unsubOpsDetails();

    // Limpar UI antes de carregar
    document.querySelectorAll('.assignment-cell').forEach((td) => {
        syncAssignmentCellUI(td, null);
        const inp = td.querySelector('.task-note-input');
        if (inp) {
            inp.value = '';
            inp.classList.add('hidden');
        }
    });

    // Escutar alterações nas Alocações
    unsubAllocations = onSnapshot(doc(db, "allocations", weekId), (snapshot) => {
        if (snapshot.exists()) {
            appData.allocations = snapshot.data().data || {};
            updateTableUI();
            if (document.querySelector('.tab-btn[data-tab="tab2"]').classList.contains('active')) {
                renderTab2();
            }
        } else {
            appData.allocations = {};
            updateTableUI();
            if (document.querySelector('.tab-btn[data-tab="tab2"]').classList.contains('active')) {
                renderTab2();
            }
        }
    });

    // Escutar alterações nos Detalhes Operacionais
    unsubOpsDetails = onSnapshot(doc(db, "operational_details", weekId), (snapshot) => {
        if (snapshot.exists()) {
            appData.opsDetails = snapshot.data().data || {};
            if (document.querySelector('.tab-btn[data-tab="tab2"]').classList.contains('active')) {
                renderTab2();
            }
        } else {
            appData.opsDetails = {};
            if (document.querySelector('.tab-btn[data-tab="tab2"]').classList.contains('active')) {
                renderTab2();
            }
        }
    });
    appData.isDirty = false;
    document.getElementById('save-bar').classList.add('hidden');
}

function updateTableUI() {
    document.querySelectorAll('.assignment-cell').forEach((td) => {
        const { day, member } = td.dataset;
        const rawEntry = (appData.allocations[day] && appData.allocations[day][member]) || null;
        syncAssignmentCellUI(td, rawEntry);
        const noteInput = td.querySelector('.task-note-input');
        const entry = normalizeMemberAssignment(rawEntry);
        if (!noteInput) return;
        if (entry.kind === 'task') {
            noteInput.value = entry.note || '';
            noteInput.classList.remove('hidden');
        } else {
            noteInput.value = '';
            noteInput.classList.add('hidden');
        }
    });
}

function isMemberAssignedToRoom(entry, roomName) {
    const normalized = normalizeMemberAssignment(entry);
    return normalized.kind === 'room' && normalized.room === roomName;
}

function normalizeRoomOps(roomOpsEntry) {
    if (typeof roomOpsEntry === 'string') {
        return {
            hasWork: roomOpsEntry.trim().length > 0,
            taskText: roomOpsEntry
        };
    }
    return {
        hasWork: !!roomOpsEntry.hasWork,
        taskText: roomOpsEntry.taskText || ""
    };
}

function normalizeMemberAssignment(entry) {
    if (!entry) return { kind: null };
    if (entry.kind === 'room') return { kind: 'room', room: entry.room || null };
    if (entry.kind === 'task') return { kind: 'task', note: entry.note || "" };
    return { kind: null };
}
