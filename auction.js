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

function playerRow(p) {
  return `<tr data-id="${esc(p.id)}">
    <td>${esc(p.name)}</td>
    <td>${esc(p.team)}</td>
    <td>${(p.roles || [])
      .map((r) => `<span class="role-badge role-${esc(r)}">${esc(r)}</span>`)
      .join('')}</td>
    <td class="text-end">${esc(p.qt)}</td>
    <td class="text-end">${esc(p.qtInitial)}</td>
    <td class="text-end">${esc(p.diff)}</td>
    <td class="text-end">${esc(p.fvm)}</td>
    <td></td>
  </tr>`;
}

function renderPlayers(players) {
  if (!players || players.length === 0) {
    playerListBody.innerHTML =
      '<tr><td colspan="8" class="text-muted text-center py-4">No players loaded.</td></tr>';
    return;
  }
  playerListBody.innerHTML = players.map(playerRow).join('');
}

const auction = loadAuction();

if (!auction) {
  playerListBody.innerHTML =
    '<tr><td colspan="8" class="text-muted text-center py-4">No auction loaded — go Home → Continue and pick a saved file.</td></tr>';
} else {
  document.getElementById('auctionLeague').textContent = auction.leagueName;
  document.getElementById('soldCounter').textContent = `sold 0 / ${auction.players.length}`;
  renderPlayers(auction.players);
}

// Sortable columns: header element + comparator. Comparator gets the sort
// direction so any tie-break stays fixed even when the primary key reverses.
const sortHeaders = {
  name: document.getElementById('sortName'),
  team: document.getElementById('sortTeam'),
};

const text = (row, i) => row.cells[i].textContent.trim();
const num = (row, i) => parseFloat(row.cells[i].textContent) || 0;
const dir = (v, asc) => (asc ? v : -v);
const byName = (a, b) => text(a, 0).localeCompare(text(b, 0), 'it', { sensitivity: 'base' });
const byTeam = (a, b) => text(a, 1).localeCompare(text(b, 1), 'it', { sensitivity: 'base' });
const byQtDesc = (a, b) => num(b, 3) - num(a, 3); // Qt.A M, highest first

const comparators = {
  name: (a, b, asc) => dir(byName(a, b), asc),
  // Same team → break ties by Qt.A M descending, regardless of team direction.
  team: (a, b, asc) => {
    const t = dir(byTeam(a, b), asc);
    return t !== 0 ? t : byQtDesc(a, b);
  },
};

let sortKey = null;
let sortAsc = true;

function sortBy(key) {
  sortAsc = sortKey === key ? !sortAsc : true;
  sortKey = key;

  const rows = [...playerListBody.querySelectorAll('tr')];
  rows.sort((a, b) => comparators[key](a, b, sortAsc));
  rows.forEach((r) => playerListBody.appendChild(r));

  // Only the active column shows a direction caret.
  for (const [k, header] of Object.entries(sortHeaders)) {
    header.dataset.dir = k === key ? (sortAsc ? 'asc' : 'desc') : '';
  }
}

for (const [key, header] of Object.entries(sortHeaders)) {
  header.addEventListener('click', () => sortBy(key));
}

// --- Role filter: select all / deselect all ---
const roleChecks = document.querySelectorAll('#roleFilter .btn-check');

function setAllRoles(checked) {
  roleChecks.forEach((c) => {
    c.checked = checked;
  });
}

document.getElementById('rolesAll').addEventListener('click', () => setAllRoles(true));
document.getElementById('rolesNone').addEventListener('click', () => setAllRoles(false));
