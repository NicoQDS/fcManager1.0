// Auction page behavior.

const playerListBody = document.getElementById('playerListBody');

// --- Load the auction stashed by the Continue flow (script.js) ---
function loadAuction() {
  const stored = sessionStorage.getItem('fcmAuction');
  if (!stored) {
    return null;
  }
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

// Escape text going into innerHTML.
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function roleBadges(p) {
  return (p.roles || [])
    .map((r) => `<span class="role-badge role-${esc(r)}">${esc(r)}</span>`)
    .join('');
}

function playerRow(p) {
  const classes = [
    String(p.id) === String(selectedId) ? 'selected-row' : '',
    p.soldTo ? 'sold-row' : '',
  ]
    .filter(Boolean)
    .join(' ');
  // The user's own buys carry their own badge colour.
  const badge =
    auction && p.soldTo === auction.userTeam ? 'badge sold-mine' : 'badge text-bg-secondary';
  const sold = p.soldTo
    ? `<span class="${badge}">${esc(p.soldTo)} · ${esc(p.price)}</span>`
    : '';
  return `<tr data-id="${esc(p.id)}"${classes ? ` class="${classes}"` : ''}>
    <td>${roleBadges(p)}</td>
    <td>${esc(p.name)}</td>
    <td>${esc(p.team)}</td>
    <td class="text-end">${esc(p.qt)}</td>
    <td class="text-center">${sold}</td>
  </tr>`;
}

// Role-line colours: green (Dc) ≥ 75%, yellow (Por) 50–74%, red (Pc) below 50%.
function starterBadge(pct) {
  if (pct === '' || pct == null) {
    return '';
  }
  const color = pct >= 75 ? 'badge-def' : pct >= 50 ? 'badge-por' : 'badge-att';
  return `<span class="badge rounded-pill fw-normal ${color}">${esc(pct)}%</span>`;
}

// Pecking-order badge beside the name, shared by "Gerarchia portiere" and "Rigorista" (1–5 or "ballottaggio").
// 1 defence-line green, 2 goalkeeper-line yellow, 3 attack-line red, anything else light grey; ballottaggio becomes a midfield-blue swap icon.
const RANK_COLORS = {
  1: 'badge-def',
  2: 'badge-por',
  3: 'badge-att',
};

// label replaces the number in the badge text (e.g. "rig" for Rigorista); colour still follows the rank.
// pill switches to a rounded pill badge.
function rankBadge(rank, { label, pill = false } = {}) {
  if (!rank) {
    return '';
  }
  const shape = pill ? 'badge rounded-pill fw-normal' : 'badge fw-normal';
  if (rank.toLowerCase() === 'ballottaggio') {
    return ` <span class="${shape} badge-mid" title="Ballottaggio"><i class="bi bi-arrow-repeat"></i></span>`;
  }
  const color = RANK_COLORS[rank] || 'text-bg-light border';
  return ` <span class="${shape} ${color}">${esc(label ?? rank)}</span>`;
}

// 1 light (goalkeeper-line yellow), 2 medium (orange), 3 severe (attack-line red).
const INJURY_COLORS = {
  1: 'badge-por',
  2: 'injury-medium',
  3: 'badge-att',
};

function injuryBadge(level) {
  const color = INJURY_COLORS[level];
  if (!color) {
    return '';
  }
  return ` <span class="badge rounded-pill fw-normal ${color}" title="Infortunio ${level}">!</span>`;
}

// Info icon beside the name when the player has a note; hover shows the note in a Bootstrap tooltip.
function noteIcon(note) {
  if (!String(note ?? '').trim()) {
    return '';
  }
  return ` <span class="badge rounded-pill fw-normal note-badge" data-bs-toggle="tooltip" data-bs-title="${esc(note)}">i</span>`;
}

// Goalkeeper, penalty and injury badges — the badges column minus the note icon.
function statusBadges(p) {
  return [
    rankBadge(p.gkRank, { label: 'P' }),
    rankBadge(p.penaltyRank, { label: 'rig', pill: true }),
    injuryBadge(p.injury),
  ].join('');
}

// Everything shown in the badges column, in display order.
function playerBadges(p) {
  return statusBadges(p) + noteIcon(p.note);
}

function emptyRow(message, colspan = 5) {
  return `<tr><td colspan="${colspan}" class="text-muted text-center py-4">${esc(message)}</td></tr>`;
}

// Tagged-players drawer row: core columns plus Tit., badges, Tier and Max.
function targetPlayerRow(p) {
  const classes = [
    String(p.id) === String(selectedId) ? 'selected-row' : '',
    p.target ? 'target-row' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `<tr data-id="${esc(p.id)}"${classes ? ` class="${classes}"` : ''}>
    <td class="text-center">${roleBadges(p)}</td>
    ${showStarter ? `<td class="text-center">${starterBadge(p.starter)}</td>` : ''}
    <td>${esc(p.name)}</td>
    <td>${esc(p.team)}</td>
    ${showBadges ? `<td class="text-nowrap">${playerBadges(p)}</td>` : ''}
    <td class="text-center">${esc(p.tier)}</td>
    ${showMaxPrice ? `<td class="text-center">${esc(p.maxPrice)}</td>` : ''}
    <td>${esc(p.qt)}</td>
  </tr>`;
}

// Sortable columns: header element + comparator. Comparator gets the sort
// direction so any tie-break stays fixed even when the primary key reverses.
const sortHeaders = {
  name: document.getElementById('sortName'),
  team: document.getElementById('sortTeam'),
  roles: document.getElementById('sortRoles'),
  qt: document.getElementById('sortQt'),
};

const dir = (v, asc) => (asc ? v : -v);
const str = (v) => String(v ?? '');
const num = (v) => parseFloat(v) || 0;
const byName = (a, b) => str(a.name).localeCompare(str(b.name), 'it', { sensitivity: 'base' });
const byTeam = (a, b) => str(a.team).localeCompare(str(b.team), 'it', { sensitivity: 'base' });
const byQtDesc = (a, b) => num(b.qt) - num(a.qt); // Qt.A M, highest first
// Titolarità, highest first; players without a value sink to the bottom.
const starterOrNeg = (p) => (p.starter === '' || p.starter == null ? -Infinity : num(p.starter));
const byStarterDesc = (a, b) => {
  const sa = starterOrNeg(a);
  const sb = starterOrNeg(b);
  return sa === sb ? 0 : sb - sa;
};
const byRoleCount = (a, b) => (a.roles || []).length - (b.roles || []).length;

const comparators = {
  name: (a, b, asc) => dir(byName(a, b), asc),
  // Same team → break ties by Qt.A M descending, regardless of team direction.
  team: (a, b, asc) => {
    const t = dir(byTeam(a, b), asc);
    return t !== 0 ? t : byQtDesc(a, b);
  },
  // Number of roles a player covers; same count → Qt.A M descending.
  roles: (a, b, asc) => {
    const r = dir(byRoleCount(a, b), !asc);
    return r !== 0 ? r : byQtDesc(a, b);
  },
  // Qt.A M value; same value → Titolarità descending → FVM descending → name ascending. Regardless of Qt direction.
  qt: (a, b, asc) => {
    const q = dir(num(a.qt) - num(b.qt), !asc);
    if (q !== 0) return q;
    const s = byStarterDesc(a, b);
    if (s !== 0) return s;
    const f = num(b.fvm) - num(a.fvm);
    return f !== 0 ? f : byName(a, b);
  },
  // Prezzo massimo, first click highest first; players without a value always last.
  // Ties → Qt.A M desc → Titolarità desc → FVM desc → name asc, regardless of direction.
  maxPrice: (a, b, asc) => {
    const ea = a.maxPrice === '' || a.maxPrice == null;
    const eb = b.maxPrice === '' || b.maxPrice == null;
    if (ea !== eb) return ea ? 1 : -1;
    if (!ea) {
      const m = dir(num(a.maxPrice) - num(b.maxPrice), !asc);
      if (m !== 0) return m;
    }
    const q = byQtDesc(a, b);
    if (q !== 0) return q;
    const s = byStarterDesc(a, b);
    if (s !== 0) return s;
    const f = num(b.fvm) - num(a.fvm);
    return f !== 0 ? f : byName(a, b);
  },
  // Titolarità, first click highest first; players without a value always last.
  // Ties → Qt.A M desc → FVM desc → name asc, regardless of Titolarità direction.
  starter: (a, b, asc) => {
    const ea = a.starter === '' || a.starter == null;
    const eb = b.starter === '' || b.starter == null;
    if (ea !== eb) return ea ? 1 : -1;
    if (!ea) {
      const t = dir(num(a.starter) - num(b.starter), !asc);
      if (t !== 0) return t;
    }
    const q = byQtDesc(a, b);
    if (q !== 0) return q;
    const f = num(b.fvm) - num(a.fvm);
    return f !== 0 ? f : byName(a, b);
  },
  // Tier ascending (lowest first); ties → Qt.A M desc → FVM desc → name asc, regardless of tier direction.
  tier: (a, b, asc) => {
    const ta = a.tier === '' || a.tier == null ? Infinity : num(a.tier);
    const tb = b.tier === '' || b.tier == null ? Infinity : num(b.tier);
    const t = dir(ta - tb, asc);
    if (t !== 0) return t;
    const q = byQtDesc(a, b);
    if (q !== 0) return q;
    const f = num(b.fvm) - num(a.fvm);
    return f !== 0 ? f : byName(a, b);
  },
};

// --- View state: filter + sort live on the data, the DOM is rebuilt from it ---
const roleChecks = [...document.querySelectorAll('#roleFilter .btn-check')];

let allPlayers = [];
let showStarter = false; // true when the file carries any "Titolarità" value
let showBadges = false; // true when any player has something for the badges column
let showMaxPrice = false; // true when the file carries any "Prezzo massimo" value
let sortKey = null;
let sortAsc = true;
let selectedId = null;

function selectedRoles() {
  return new Set(roleChecks.filter((c) => c.checked).map((c) => c.value));
}

// A player passes when any of its roles is selected.
function matchesRoles(p, roles) {
  return (p.roles || []).some((r) => roles.has(r));
}

const showSold = document.getElementById('showSold');

function render() {
  if (allPlayers.length === 0) {
    playerListBody.innerHTML = emptyRow('No players loaded.');
    return;
  }

  const roles = selectedRoles();
  const visible = allPlayers.filter(
    (p) => matchesRoles(p, roles) && (showSold.checked || !p.soldTo)
  );

  if (sortKey) {
    visible.sort((a, b) => comparators[sortKey](a, b, sortAsc));
  }

  playerListBody.innerHTML =
    visible.length === 0 ? emptyRow('No players match the current filters.') : visible.map(playerRow).join('');
}

// Drop tooltips of rows about to be replaced, so none stay stuck on screen.
function disposeTooltips(tbody) {
  tbody.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
    bootstrap.Tooltip.getInstance(el)?.dispose();
  });
}

showSold.addEventListener('change', render);

function sortBy(key) {
  sortAsc = sortKey === key ? !sortAsc : true;
  sortKey = key;

  // Only the active column shows a direction caret.
  for (const [k, header] of Object.entries(sortHeaders)) {
    header.dataset.dir = k === key ? (sortAsc ? 'asc' : 'desc') : '';
  }
  render();
}

for (const [key, header] of Object.entries(sortHeaders)) {
  header.addEventListener('click', () => sortBy(key));
}

// --- Role filter ---
function setAllRoles(checked) {
  roleChecks.forEach((c) => {
    c.checked = checked;
  });
}

roleChecks.forEach((c) => c.addEventListener('change', render));
document.getElementById('rolesAll').addEventListener('click', () => {
  setAllRoles(true);
  render();
});
document.getElementById('rolesNone').addEventListener('click', () => {
  setAllRoles(false);
  render();
});

// --- Players drawer: same filter/sort UX, own state, sold players never shown ---
const targetRoleChecks = [...document.querySelectorAll('#targetRoleFilter .btn-check')];
const targetPlayerListBody = document.getElementById('targetPlayerListBody');
// Note tooltips (Bootstrap): delegated so re-rendered rows work without re-init.
new bootstrap.Tooltip(targetPlayerListBody, { selector: '[data-bs-toggle="tooltip"]' });

let targetSortKey = null;
let targetSortAsc = true;

const targetSortHeaders = {
  tier: document.getElementById('targetSortTier'),
  name: document.getElementById('targetSortName'),
  team: document.getElementById('targetSortTeam'),
  roles: document.getElementById('targetSortRoles'),
  qt: document.getElementById('targetSortQt'),
  maxPrice: document.getElementById('targetSortMaxPrice'),
  starter: document.getElementById('targetSortStarter'),
};

function targetSelectedRoles() {
  return new Set(targetRoleChecks.filter((c) => c.checked).map((c) => c.value));
}

// Every unsold player, tagged or not: what the panel search looks through.
function targetPoolPlayers() {
  return allPlayers.filter((p) => !p.soldTo);
}

// Players the panel table shows right now: the pool narrowed by the role filter.
function targetListPlayers() {
  const roles = targetSelectedRoles();
  return targetPoolPlayers().filter((p) => matchesRoles(p, roles));
}

function renderTargetList() {
  const tagged = targetListPlayers();

  if (targetSortKey) {
    tagged.sort((a, b) => comparators[targetSortKey](a, b, targetSortAsc));
  }

  disposeTooltips(targetPlayerListBody);
  targetPlayerListBody.innerHTML =
    tagged.length === 0
      ? emptyRow('No players match the current filters.', 5 + showBadges + showMaxPrice + showStarter)
      : tagged.map(targetPlayerRow).join('');
}

function targetSortBy(key) {
  targetSortAsc = targetSortKey === key ? !targetSortAsc : true;
  targetSortKey = key;

  for (const [k, header] of Object.entries(targetSortHeaders)) {
    header.dataset.dir = k === key ? (targetSortAsc ? 'asc' : 'desc') : '';
  }
  renderTargetList();
}

for (const [key, header] of Object.entries(targetSortHeaders)) {
  header.addEventListener('click', () => targetSortBy(key));
}

targetRoleChecks.forEach((c) => c.addEventListener('change', renderTargetList));
document.getElementById('targetRolesAll').addEventListener('click', () => {
  targetRoleChecks.forEach((c) => {
    c.checked = true;
  });
  renderTargetList();
});
document.getElementById('targetRolesNone').addEventListener('click', () => {
  targetRoleChecks.forEach((c) => {
    c.checked = false;
  });
  renderTargetList();
});

// Scroll the table so the currently selected player is the first row under
// the sticky header.
const targetPlayerListWrap = document.getElementById('targetPlayerListTableWrap');
const targetPlayerListHead = targetPlayerListWrap.querySelector('thead');
function scrollTargetRowToTop(row) {
  if (!row) {
    return;
  }
  targetPlayerListWrap.scrollTop +=
    row.getBoundingClientRect().top -
    targetPlayerListWrap.getBoundingClientRect().top -
    targetPlayerListHead.offsetHeight;
}

document.getElementById('targetRolesExpand').addEventListener('click', () => {
  scrollTargetRowToTop(targetPlayerListBody.querySelector('.selected-row'));
});

// --- Teams sidebar ---
const teamsZone = document.getElementById('teamsZone');

// One entry per team in the auction: credits left plus the players bought.
let teams = [];

// Buying team for the next assignment — picked by clicking a card, '' if none.
let pickedTeam = '';

function makeTeams(names, credits) {
  // `initial` never moves — it is the 100% mark of the purse bar.
  return (names || []).map((name) => ({ name, credits, initial: credits, roster: [] }));
}

// Bootstrap Icons star-fill, inlined: the page doesn't load the icon font.
const STAR_FILL = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
  <path d="M3.612 15.443c-.386.198-.824-.149-.746-.592l.83-4.73L.173 6.765c-.329-.314-.158-.888.283-.95l4.898-.696L7.538.792c.197-.39.73-.39.927 0l2.184 4.327 4.898.696c.441.062.612.636.283.95l-3.523 3.356.83 4.73c.078.443-.36.79-.746.592L8 13.187l-4.389 2.256z"/>
</svg>`;

// A team is out of the auction once it can't buy anyone else: no credits for
// even a 1 fM bid, or a full roster when the cap is on.
function teamIsOut(team) {
  if (num(team.credits) < 1) {
    return true;
  }
  return Boolean(
    auction && auction.maxBuyableEnabled && team.roster.length >= auction.maxBuyable
  );
}

function teamCard(team, rank) {
  const out = teamIsOut(team) ? ' out' : '';
  const active = team.name === pickedTeam ? ' active' : '';
  const initial = num(team.initial) || 0;
  // Orange = credits left, black = credits spent.
  const left = initial > 0 ? Math.max(0, Math.min(100, (num(team.credits) / initial) * 100)) : 0;
  // The slot is rendered on every card so the rank boxes stay in one line;
  // only the user's own team fills it.
  const mine = auction && team.name === auction.userTeam ? ' mine' : '';
  const star = mine
    ? `<span class="team-star" title="Your team">${STAR_FILL}</span>`
    : '<span class="team-star"></span>';
  return `<div class="team-card${mine}${active}${out}" data-team="${esc(team.name)}">
    <div class="team-rank">${esc(rank)}</div>
    <div class="team-card-body">
      <div class="team-card-head">
        <span class="team-credits">${esc(team.credits)} fM</span>
        ${star}
        <span class="team-name">${esc(team.name)}</span>
        <span class="team-count">${esc(team.roster.length)}</span>
      </div>
      <div class="team-bar" role="progressbar" aria-valuenow="${esc(team.credits)}" aria-valuemin="0" aria-valuemax="${esc(initial)}">
        <div class="team-bar-fill" style="width: ${left.toFixed(1)}%"></div>
      </div>
    </div>
  </div>`;
}

// Richest team on top; equal purses keep a stable order by name. That order is
// the standings, so the card's position is its rank.
function renderTeams() {
  const ordered = [...teams].sort((a, b) => b.credits - a.credits || byName(a, b));
  teamsZone.innerHTML =
    ordered.length === 0
      ? '<p class="text-muted">No teams in this auction.</p>'
      : ordered.map((t, i) => teamCard(t, i + 1)).join('');

  const mine = auction && teamByName(auction.userTeam);
  document.getElementById('mineRosterStats').textContent = mine
    ? `${mine.roster.length} - ${mine.credits}`
    : '';
  renderMineRoster(mine);
  renderOtherRosters();
  renderAuctionProgress();
}

// Auction completeness when there's a roster cap: players bought over every
// team filling all its slots.
const auctionProgress = document.getElementById('auctionProgress');

function renderAuctionProgress() {
  const cap = auction && auction.maxBuyableEnabled ? num(auction.maxBuyable) : 0;
  const slots = teams.length * cap;
  auctionProgress.hidden = !(slots > 0);
  if (auctionProgress.hidden) {
    return;
  }
  const bought = teams.reduce((sum, t) => sum + Math.min(t.roster.length, cap), 0);
  auctionProgress.textContent = `${((bought / slots) * 100).toFixed(1)}%`;
}

// Same order as the role filter buttons: goalkeeper, defence, midfield,
// trequarti, attack. A multi-role player sorts on its first (main) role.
const ROLE_ORDER = ['Por', 'Dd', 'Dc', 'Ds', 'B', 'E', 'M', 'C', 'W', 'T', 'A', 'Pc'];

function roleRank(p) {
  const first = (p.roles || [])[0];
  const i = ROLE_ORDER.indexOf(first);
  return i === -1 ? ROLE_ORDER.length : i; // unknown or role-less players last
}

// Bootstrap Icons x-lg, inlined: removes one player from the mine roster.
const MINE_ROSTER_REMOVE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
  <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/>
</svg>`;

// Whether the "remove a player" edit mode on the mine roster table is on.
let mineRosterEditing = false;

function mineRosterRow(p) {
  const remove = mineRosterEditing
    ? `<td class="roster-remove-cell">
        <button type="button" class="mine-roster-remove-btn" data-id="${esc(p.id)}" title="Remove" aria-label="Remove ${esc(p.name)}">
          ${MINE_ROSTER_REMOVE_ICON}
        </button>
      </td>`
    : '';
  return `<tr>
    <td class="roster-roles-cell">${roleBadges(p)}</td>
    <td class="roster-name-cell">${esc(p.name)}</td>
    <td class="roster-team-cell">${esc(p.team)}</td>
    <td class="roster-price-cell">${esc(p.price)} fM</td>
    ${remove}
  </tr>`;
}

function renderMineRoster(mine) {
  const players = mine
    ? [...mine.roster].sort((a, b) => roleRank(a) - roleRank(b) || byName(a, b))
    : [];
  document.getElementById('mineRosterBody').innerHTML = players.map(mineRosterRow).join('');
}

// Bootstrap Icons pencil, inlined: same icon as #mineRosterEditBtn, one per
// card so the remove buttons can be toggled per team.
const OTHER_ROSTER_EDIT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
  <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
</svg>`;

// Teams (other than mine) whose roster card is in "remove a player" edit mode.
const otherRosterEditing = new Set();

function otherRosterRow(p, editing) {
  const remove = editing
    ? `<td class="roster-remove-cell">
        <button type="button" class="other-roster-remove-btn" data-id="${esc(p.id)}" title="Remove" aria-label="Remove ${esc(p.name)}">
          ${MINE_ROSTER_REMOVE_ICON}
        </button>
      </td>`
    : '';
  return `<tr>
    <td class="roster-roles-cell">${roleBadges(p)}</td>
    <td class="roster-name-cell">${esc(p.name)}</td>
    <td class="roster-price-cell">${esc(p.price)} fM</td>
    ${remove}
  </tr>`;
}

function otherRosterCard(team) {
  const editing = otherRosterEditing.has(team.name);
  const players = [...team.roster].sort((a, b) => roleRank(a) - roleRank(b) || byName(a, b));
  return `<div class="other-roster-panel">
    <div class="other-roster-name">
      <span>${esc(team.name)}</span>
      <span class="other-roster-stats">${team.roster.length} - ${team.credits}</span>
      <button type="button" class="other-roster-edit-btn${editing ? ' active' : ''}" data-team="${esc(team.name)}" title="Edit" aria-label="Edit">
        ${OTHER_ROSTER_EDIT_ICON}
      </button>
    </div>
    <div class="other-roster-table-wrap">
      <table class="other-roster-table">
        <tbody>
          ${players.map((p) => otherRosterRow(p, editing)).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// One card per team but mine, alphabetically, scrolled sideways in #rosterPanel.
function renderOtherRosters() {
  const mineName = (auction && auction.userTeam) || '';
  const others = teams.filter((t) => t.name !== mineName).sort(byName);
  document.getElementById('rosterPanel').innerHTML = others.map(otherRosterCard).join('');
}

document.getElementById('rosterPanel').addEventListener('click', (e) => {
  const editBtn = e.target.closest('.other-roster-edit-btn');
  if (editBtn) {
    const teamName = editBtn.dataset.team;
    if (otherRosterEditing.has(teamName)) {
      otherRosterEditing.delete(teamName);
    } else {
      otherRosterEditing.add(teamName);
    }
    renderOtherRosters();
    return;
  }
  const removeBtn = e.target.closest('.other-roster-remove-btn');
  if (removeBtn) {
    unassignPlayer(removeBtn.dataset.id);
  }
});

// A plain mouse wheel only reports vertical delta — redirect it sideways.
document.getElementById('rosterPanel').addEventListener('wheel', (e) => {
  if (e.deltaY === 0) {
    return;
  }
  e.preventDefault();
  e.currentTarget.scrollLeft += e.deltaY;
});

// Sends a player back to the pool: clears the sale and refunds the team.
function unassignPlayer(id) {
  const p = playerById(id);
  if (!p || !p.soldTo) {
    return;
  }
  const team = teamByName(p.soldTo);
  const price = p.price;
  if (team) {
    team.roster = team.roster.filter((x) => x !== p);
    team.credits += num(p.price);
    addLogEntry(p, team, price, true);
  }
  p.soldTo = null;
  p.price = null;

  render();
  renderTeams();
  persist();
}

document.getElementById('mineRosterEditBtn').addEventListener('click', () => {
  mineRosterEditing = !mineRosterEditing;
  document.getElementById('mineRosterEditBtn').classList.toggle('active', mineRosterEditing);
  renderTeams();
});

document.getElementById('mineRosterBody').addEventListener('click', (e) => {
  const removeBtn = e.target.closest('.mine-roster-remove-btn');
  if (removeBtn) {
    unassignPlayer(removeBtn.dataset.id);
  }
});

// --- Sales log: one line per assignment, stored in the auction file ---
const auctionLogList = document.getElementById('auctionLogList');

function logTime(at) {
  const d = new Date(at);
  return Number.isNaN(d.getTime())
    ? '--:--'
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function logEntryRow(entry) {
  const removedClass = entry.removed ? ' log-entry-removed' : '';
  return `<li class="log-entry${removedClass}">
    <span class="log-time">${esc(logTime(entry.at))}</span>
    <span class="log-player">${esc(entry.player)}</span>
    <span class="log-team">${esc(entry.team)}</span>
    <span class="log-price">${esc(entry.price)} fM</span>
  </li>`;
}

// Newest first, so the last sale is always the visible one.
function renderLog() {
  const entries = (auction && auction.log) || [];
  auctionLogList.innerHTML =
    entries.length === 0
      ? '<li class="log-empty">No sales yet.</li>'
      : [...entries].reverse().map(logEntryRow).join('');
}

function addLogEntry(player, team, price, removed = false) {
  auction.log.push({
    player: player.name,
    team: team.name,
    price,
    at: new Date().toISOString(),
    removed,
  });
  renderLog();
}

// The cards are the only way to pick the buying team: clicking one selects it,
// clicking the selected card again clears the choice.
teamsZone.addEventListener('click', (e) => {
  const card = e.target.closest('.team-card[data-team]');
  if (!card) {
    return;
  }
  const name = card.dataset.team;
  const team = teamByName(name);
  if (team && teamIsOut(team)) {
    return; // spent out or roster full — not a valid buyer any more
  }
  pickedTeam = pickedTeam === name ? '' : name;
  renderTeams();
});

// --- Player search: type-ahead dropdown, max 5 hits ---
const searchInput = document.getElementById('playerSearch');
const searchResults = document.getElementById('searchResults');
const selectedLabel = document.getElementById('selectedPlayer');
const pickNote = document.getElementById('pickNote');

const MAX_HITS = 5;

// Fold accents and case so "jose" matches "José".
function norm(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Names starting with the query rank above names merely containing it;
// within each group the pricier player (Qt.A M) comes first.
function searchPlayers(query, pool) {
  const q = norm(query);
  const scored = [];
  for (const p of pool) {
    const at = norm(p.name).indexOf(q);
    if (at !== -1) {
      scored.push({ p, starts: at === 0 ? 0 : 1 });
    }
  }
  scored.sort((a, b) => a.starts - b.starts || byQtDesc(a.p, b.p));
  return scored.slice(0, MAX_HITS).map((s) => s.p);
}

// Type-ahead dropdown on a search box. pool() returns the players it may
// list; onPick(p) runs when one is chosen by click or Enter. Each box keeps
// its own hits and keyboard cursor. Returns { close } to shut the list.
function attachSearch({ input, list, wrap, pool, onPick }) {
  let hits = []; // players currently listed in the dropdown
  let activeHit = -1; // keyboard cursor into hits

  function close() {
    hits = [];
    activeHit = -1;
    list.hidden = true;
    list.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
  }

  function renderHits() {
    list.innerHTML = hits
      .map((p, i) => {
        // Sold hits stay listed so you can look a player up, but they are
        // marked and refused on click, same as their row in the table.
        const classes = [i === activeHit ? 'active' : '', p.soldTo ? 'hit-is-sold' : '']
          .filter(Boolean)
          .join(' ');
        return `<li role="option" data-index="${i}"${classes ? ` class="${classes}"` : ''}>
        <span class="hit-name">${esc(p.name)}</span>
        <span class="hit-team">${esc(p.team)}</span>
        <span class="hit-roles">${roleBadges(p)}${
          p.soldTo ? `<span class="hit-sold">${esc(p.soldTo)}</span>` : ''
        }</span>
      </li>`;
      })
      .join('');
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function move(step) {
    if (hits.length === 0) {
      return;
    }
    activeHit = (activeHit + step + hits.length) % hits.length;
    renderHits();
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    hits = q === '' ? [] : searchPlayers(q, pool());
    activeHit = hits.length > 0 ? 0 : -1;
    if (hits.length === 0) {
      close();
      return;
    }
    renderHits();
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      move(-1);
    } else if (e.key === 'Enter' && activeHit >= 0) {
      e.preventDefault();
      onPick(hits[activeHit]);
    } else if (e.key === 'Escape') {
      close();
    }
  });

  // mousedown, not click: fires before the input's blur closes the list.
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-index]');
    if (li) {
      e.preventDefault();
      onPick(hits[Number(li.dataset.index)]);
    }
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      close();
    }
  });

  return { close };
}

// Pick a player: label it, mark its row, and (when coming from the search box)
// bring the row into view. The search is unfiltered, so the row may be hidden
// by the role filter — then there is nothing to scroll to and only the label
// updates. Clicks from the table skip the scroll: that row is already on screen.
// "Selected: Name, Team [badges]" — name and team in the app orange. Already
// sold players carry who bought them, since Assign will refuse them.
function showSelected(p) {
  if (!p) {
    selectedLabel.className = 'is-empty';
    selectedLabel.innerHTML = '<span class="selected-empty">No player selected</span>';
    pickNote.textContent = '';
    return;
  }
  // The strip and the note take the colour of the first (main) role badge.
  selectedLabel.className = `pick-${esc((p.roles || [])[0] || '')}`;
  pickNote.className = selectedLabel.className;
  selectedLabel.innerHTML = `<span class="selected-name">${esc(p.name)}</span>
    <span class="selected-team">${esc(p.team)}</span>
    <span id="selectedStatusBadges">${starterBadge(p.starter)}${statusBadges(p)}</span>
    <span class="selected-badges">${roleBadges(p)}</span>`;

  if (p.note) {
    pickNote.textContent = `${p.note} (${p.tier})`;
  } else {
    pickNote.textContent = '';
  }
}

function selectPlayer(p, { scroll = false } = {}) {
  // Sold players are out of the auction: they never reach the selection field.
  if (p.soldTo) {
    message(`${p.name} is already sold to ${p.soldTo} for ${p.price} fM.`);
    return;
  }
  selectedId = p.id;
  showSelected(p);
  assignPrice.value = '1'; // opening bid — typing over it is one keystroke
  searchInput.value = '';
  mainSearch.close();
  render();
  renderTargetList();
  if (scroll) {
    playerListBody.querySelector('.selected-row')?.scrollIntoView({ block: 'center' });
  }
}

// Clicking a row selects that player.
playerListBody.addEventListener('click', (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (!tr) {
    return;
  }
  const p = allPlayers.find((x) => String(x.id) === tr.dataset.id);
  if (p) {
    selectPlayer(p);
  }
});

// Reset: drop the current pick and empty the search box.
function clearSelection() {
  selectedId = null;
  showSelected(null);
  assignPrice.value = '';
  searchInput.value = '';
  message('');
  mainSearch.close();
  render();
  renderTargetList();
}

document.getElementById('resetBtn').addEventListener('click', clearSelection);

// Main search: picks the player for the sale. Sold players follow the
// table — listed only while "Sold" is checked.
const mainSearch = attachSearch({
  input: searchInput,
  list: searchResults,
  wrap: document.getElementById('searchWrap'),
  pool: () => allPlayers.filter((p) => !p.soldTo || showSold.checked),
  onPick: (p) => selectPlayer(p, { scroll: true }),
});

// Panel search: every unsold player, whatever the role filter. Picking one
// scrolls the table so that player is the first row; when the role filter
// hides them, it is cleared first. The current sale pick is untouched.
const targetSearchInput = document.getElementById('targetPlayerSearch');
const targetSearch = attachSearch({
  input: targetSearchInput,
  list: document.getElementById('targetSearchResults'),
  wrap: document.getElementById('targetSearchWrap'),
  pool: targetPoolPlayers,
  onPick: (p) => {
    targetSearchInput.value = '';
    targetSearch.close();
    if (!targetListPlayers().includes(p)) {
      targetRoleChecks.forEach((c) => {
        c.checked = true;
      });
      renderTargetList();
    }
    const row = [...targetPlayerListBody.querySelectorAll('tr[data-id]')].find(
      (tr) => tr.dataset.id === String(p.id)
    );
    scrollTargetRowToTop(row);
  },
});

// --- Assign a player to a team ---
const assignBtn = document.getElementById('assignBtn');
const assignPrice = document.getElementById('assignPrice');
const assignMsg = document.getElementById('assignMsg');

// Clicking the price box wipes the prefilled 1 — type the real bid straight in.
assignPrice.addEventListener('click', () => {
  assignPrice.value = '';
});
function message(text, kind = 'error') {
  assignMsg.textContent = text;
  assignMsg.className = text ? kind : '';
}

function teamByName(name) {
  return teams.find((t) => t.name === name);
}

function playerById(id) {
  return allPlayers.find((p) => String(p.id) === String(id));
}

// Credits and rosters are not stored: they are replayed from the players'
// soldTo/price on load, so the saved file has a single source of truth.
function hydrateTeams() {
  for (const p of allPlayers) {
    if (!p.soldTo) {
      continue;
    }
    const t = teamByName(p.soldTo);
    if (t) {
      t.roster.push(p);
      t.credits -= num(p.price);
    } else {
      p.soldTo = null; // team no longer in the auction — release the player
      p.price = null;
    }
  }
}

// Write the auction back: sessionStorage keeps this tab in sync on reload,
// the server keeps the file in auctions_saved/ current.
async function persist() {
  sessionStorage.setItem('fcmAuction', JSON.stringify(auction));

  if (!auction.id) {
    message('Saved in this tab only — this auction file has no id.', 'error');
    return false;
  }

  try {
    const res = await fetch(`/api/auctions/${encodeURIComponent(auction.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auction),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || res.statusText);
    }
    return true;
  } catch (err) {
    message(`Could not save to the server: ${err.message}`, 'error');
    return false;
  }
}

function assign() {
  const p = playerById(selectedId);
  if (!p) {
    return message('Pick a player first.');
  }
  if (p.soldTo) {
    return message(`${p.name} is already sold to ${p.soldTo} for ${p.price} fM.`);
  }

  const team = teamByName(pickedTeam);
  if (!team) {
    return message('Pick a team.');
  }

  const price = Number(assignPrice.value);
  if (!Number.isInteger(price) || price < 1) {
    return message('Price must be a whole number of at least 1 fM.');
  }
  if (price > team.credits) {
    return message(`${team.name} has only ${team.credits} fM left.`);
  }
  if (auction.maxBuyableEnabled && team.roster.length >= auction.maxBuyable) {
    return message(`${team.name} already has ${auction.maxBuyable} players.`);
  }

  p.soldTo = team.name;
  p.price = price;
  team.roster.push(p);
  team.credits -= price;

  addLogEntry(p, team, price);

  assignPrice.value = '';
  pickedTeam = '';
  clearSelection();
  renderTeams();
  message(`${p.name} to ${team.name} for ${price} fM.`, 'ok');
  persist();
}

assignBtn.addEventListener('click', assign);

// Enter anywhere on the page confirms the sale, but only once player, team and
// price are all set — otherwise it would fire on every stray Enter. Skips the
// search box picking a hit (that keydown calls preventDefault) and buttons,
// which turn Enter into their own click.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.defaultPrevented || e.target.tagName === 'BUTTON') {
    return;
  }
  if (playerById(selectedId) && pickedTeam && assignPrice.value.trim() !== '') {
    assign();
  }
});
// --- Scouting drawer: open/close only ---
const scoutDrawer = document.getElementById('scoutDrawer');
const scoutDrawerTab = document.getElementById('scoutDrawerTab');

function toggleScoutDrawer() {
  const open = scoutDrawer.classList.toggle('open');
  scoutDrawerTab.setAttribute('aria-expanded', String(open));
  if (open) {
    closeMantraDrawer();
  }
}

scoutDrawerTab.addEventListener('click', toggleScoutDrawer);

// --- Mantra drawer: formations sheet, only one drawer open at a time ---
const mantraDrawer = document.getElementById('mantraDrawer');
const mantraDrawerTab = document.getElementById('mantraDrawerTab');

function closeMantraDrawer() {
  mantraDrawer.classList.remove('open');
  mantraDrawerTab.setAttribute('aria-expanded', 'false');
}

mantraDrawerTab.addEventListener('click', () => {
  const open = mantraDrawer.classList.toggle('open');
  mantraDrawerTab.setAttribute('aria-expanded', String(open));
  if (open) {
    scoutDrawer.classList.remove('open');
    scoutDrawerTab.setAttribute('aria-expanded', 'false');
  }
});

// Middle-click anywhere toggles the drawer too. auxclick (not mousedown) so
// it doesn't fight the browser's native middle-click autoscroll gesture.
document.addEventListener('auxclick', (e) => {
  if (e.button === 1) {
    e.preventDefault();
    toggleScoutDrawer();
  }
});

// --- Boot ---
const auction = loadAuction();

if (!auction) {
  playerListBody.innerHTML = emptyRow('No auction loaded — go Home → Continue and pick a saved file.');
  renderLog();
} else {
  allPlayers = auction.players || [];
  showStarter = allPlayers.some((p) => p.starter !== '' && p.starter != null);
  document.getElementById('targetSortStarter').hidden = !showStarter;
  showBadges = allPlayers.some((p) => playerBadges(p) !== '');
  document.getElementById('targetBadgesHeader').hidden = !showBadges;
  showMaxPrice = allPlayers.some((p) => p.maxPrice !== '' && p.maxPrice != null);
  document.getElementById('targetSortMaxPrice').hidden = !showMaxPrice;
  auction.log = auction.log || []; // older auction files have no log yet
  teams = makeTeams(auction.teams, auction.initialCredits);
  hydrateTeams(); // replay past assignments into credits and rosters
  showSelected(null);
  document.getElementById('auctionLeague').textContent = auction.leagueName;
  const isClassic = auction.ruleset === 'classic';
  const rulesetBadge = document.getElementById('rulesetBadge');
  rulesetBadge.textContent = isClassic ? 'classic' : 'mantra';
  rulesetBadge.classList.add(isClassic ? 'ruleset-badge-classic' : 'ruleset-badge-mantra');
  document.getElementById('mineRosterNameText').textContent = auction.userTeam || '';
  setAllRoles(true); // start unfiltered
  showSold.checked = false; // browsers restore checkbox state on reload
  targetRoleChecks.forEach((c) => {
    c.checked = true;
  }); // start unfiltered
  render();
  renderTargetList();
  renderTeams();
  renderLog();
}
