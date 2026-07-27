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
    .replace(/>/g, '&gt;');
}

function roleBadges(p) {
  return (p.roles || [])
    .map((r) => `<span class="role-badge role-${esc(r)}">${esc(r)}</span>`)
    .join('');
}

function playerRow(p) {
  const selected = String(p.id) === String(selectedId) ? ' class="selected-row"' : '';
  return `<tr data-id="${esc(p.id)}"${selected}>
    <td>${esc(p.name)}</td>
    <td>${esc(p.team)}</td>
    <td>${roleBadges(p)}</td>
    <td class="text-end">${esc(p.qt)}</td>
    <td class="text-end">${esc(p.fvm)}</td>
    <td></td>
  </tr>`;
}

function emptyRow(message) {
  return `<tr><td colspan="6" class="text-muted text-center py-4">${esc(message)}</td></tr>`;
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
    const r = dir(byRoleCount(a, b), asc);
    return r !== 0 ? r : byQtDesc(a, b);
  },
  // Qt.A M value; same price → name ascending, regardless of Qt direction.
  qt: (a, b, asc) => {
    const q = dir(num(a.qt) - num(b.qt), asc);
    return q !== 0 ? q : byName(a, b);
  },
};

// --- View state: filter + sort live on the data, the DOM is rebuilt from it ---
const roleChecks = [...document.querySelectorAll('#roleFilter .btn-check')];

let allPlayers = [];
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

function render() {
  if (allPlayers.length === 0) {
    playerListBody.innerHTML = emptyRow('No players loaded.');
    return;
  }

  const roles = selectedRoles();
  const visible = allPlayers.filter((p) => matchesRoles(p, roles));

  if (sortKey) {
    visible.sort((a, b) => comparators[sortKey](a, b, sortAsc));
  }

  playerListBody.innerHTML =
    visible.length === 0 ? emptyRow('No players match the selected roles.') : visible.map(playerRow).join('');
}

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

// --- Teams sidebar ---
const teamsZone = document.getElementById('teamsZone');
const assignTeam = document.getElementById('assignTeam');

// Mantra roles collapse into the four classic lines for the slot counter.
const ROLE_LINE = {
  Por: 'P',
  Dd: 'D',
  Dc: 'D',
  Ds: 'D',
  B: 'D',
  E: 'C',
  M: 'C',
  C: 'C',
  W: 'C',
  T: 'C',
  A: 'A',
  Pc: 'A',
};

// One entry per team in the auction: credits left plus the players bought.
let teams = [];

function makeTeams(names, credits) {
  return (names || []).map((name) => ({ name, credits, roster: [] }));
}

// A player counts on the line of its first role (its main one in the file).
function slotCounts(team) {
  const counts = { P: 0, D: 0, C: 0, A: 0 };
  for (const p of team.roster) {
    const line = ROLE_LINE[(p.roles || [])[0]];
    if (line) {
      counts[line] += 1;
    }
  }
  return counts;
}

function teamCard(team) {
  const c = slotCounts(team);
  return `<div class="team-card" data-team="${esc(team.name)}">
    <div class="team-card-head">
      <span class="team-name">${esc(team.name)}</span>
      <span class="team-credits">${esc(team.credits)} fM</span>
    </div>
    <div class="team-slots">P${c.P} · D${c.D} · C${c.C} · A${c.A}</div>
  </div>`;
}

function renderTeams() {
  teamsZone.innerHTML =
    teams.length === 0
      ? '<p class="text-muted">No teams in this auction.</p>'
      : teams.map(teamCard).join('');
}

// Assign dropdown draws on the same team list; the placeholder stays first.
function fillTeamSelect() {
  assignTeam.innerHTML =
    '<option value="">Team…</option>' +
    teams.map((t) => `<option value="${esc(t.name)}">${esc(t.name)}</option>`).join('');
}

// --- Player search: type-ahead dropdown, max 5 hits ---
const searchInput = document.getElementById('playerSearch');
const searchResults = document.getElementById('searchResults');
const selectedLabel = document.getElementById('selectedPlayer');

const MAX_HITS = 5;
let hits = []; // players currently listed in the dropdown
let activeHit = -1; // keyboard cursor into hits

// Fold accents and case so "jose" matches "José".
function norm(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

// Names starting with the query rank above names merely containing it;
// within each group the pricier player (Qt.A M) comes first.
function searchPlayers(query) {
  const q = norm(query);
  const scored = [];
  for (const p of allPlayers) {
    const at = norm(p.name).indexOf(q);
    if (at !== -1) {
      scored.push({ p, starts: at === 0 ? 0 : 1 });
    }
  }
  scored.sort((a, b) => a.starts - b.starts || byQtDesc(a.p, b.p));
  return scored.slice(0, MAX_HITS).map((s) => s.p);
}

function closeResults() {
  hits = [];
  activeHit = -1;
  searchResults.hidden = true;
  searchResults.innerHTML = '';
  searchInput.setAttribute('aria-expanded', 'false');
}

function renderResults() {
  searchResults.innerHTML = hits
    .map(
      (p, i) => `<li role="option" data-index="${i}"${i === activeHit ? ' class="active"' : ''}>
        <span class="hit-name">${esc(p.name)}</span>
        <span class="hit-team">${esc(p.team)}</span>
        <span class="hit-roles">${roleBadges(p)}</span>
      </li>`
    )
    .join('');
  searchResults.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
}

function moveActive(step) {
  if (hits.length === 0) {
    return;
  }
  activeHit = (activeHit + step + hits.length) % hits.length;
  renderResults();
}

// Pick a player: label it, mark its row, and (when coming from the search box)
// bring the row into view. The search is unfiltered, so the row may be hidden
// by the role filter — then there is nothing to scroll to and only the label
// updates. Clicks from the table skip the scroll: that row is already on screen.
// "Selected: Name, Team [badges]" — name and team in the app orange.
function showSelected(p) {
  selectedLabel.innerHTML = p
    ? `Selected: <span class="selected-name">${esc(p.name)}, ${esc(p.team)}</span>${roleBadges(p)}`
    : 'Selected: —';
}

function selectPlayer(p, { scroll = false } = {}) {
  selectedId = p.id;
  showSelected(p);
  searchInput.value = '';
  closeResults();
  render();
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
  searchInput.value = '';
  closeResults();
  render();
}

document.getElementById('resetBtn').addEventListener('click', clearSelection);

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  if (q === '') {
    closeResults();
    return;
  }
  hits = searchPlayers(q);
  activeHit = hits.length > 0 ? 0 : -1;
  if (hits.length === 0) {
    closeResults();
    return;
  }
  renderResults();
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    moveActive(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    moveActive(-1);
  } else if (e.key === 'Enter' && activeHit >= 0) {
    e.preventDefault();
    selectPlayer(hits[activeHit], { scroll: true });
  } else if (e.key === 'Escape') {
    closeResults();
  }
});

// mousedown, not click: fires before the input's blur closes the list.
searchResults.addEventListener('mousedown', (e) => {
  const li = e.target.closest('li[data-index]');
  if (li) {
    e.preventDefault();
    selectPlayer(hits[Number(li.dataset.index)], { scroll: true });
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('#searchWrap')) {
    closeResults();
  }
});

// --- Boot ---
const auction = loadAuction();

if (!auction) {
  playerListBody.innerHTML = emptyRow('No auction loaded — go Home → Continue and pick a saved file.');
} else {
  allPlayers = auction.players || [];
  teams = makeTeams(auction.teams, auction.initialCredits);
  document.getElementById('auctionLeague').textContent = auction.leagueName;
  document.getElementById('soldCounter').textContent = `sold 0 / ${allPlayers.length}`;
  setAllRoles(true); // start unfiltered
  render();
  renderTeams();
  fillTeamSelect();
}
