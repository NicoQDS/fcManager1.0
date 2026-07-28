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
  // Hiding sold players empties the column, so drop it from the table entirely.
  const soldCell = showSoldColumn() ? `<td class="text-center">${sold}</td>` : '';
  return `<tr data-id="${esc(p.id)}"${classes ? ` class="${classes}"` : ''}>
    <td>${esc(p.name)}</td>
    <td>${esc(p.team)}</td>
    <td>${roleBadges(p)}</td>
    <td class="text-end">${esc(p.qt)}</td>
    <td class="text-end">${esc(p.fvm)}</td>
    ${soldCell}
  </tr>`;
}

function emptyRow(message) {
  const cols = showSoldColumn() ? 6 : 5;
  return `<tr><td colspan="${cols}" class="text-muted text-center py-4">${esc(message)}</td></tr>`;
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

const hideSold = document.getElementById('hideSold');
const soldHeader = document.getElementById('soldHeader');

function showSoldColumn() {
  return !hideSold.checked;
}

function render() {
  soldHeader.hidden = !showSoldColumn();

  if (allPlayers.length === 0) {
    playerListBody.innerHTML = emptyRow('No players loaded.');
    return;
  }

  const roles = selectedRoles();
  const visible = allPlayers.filter(
    (p) => matchesRoles(p, roles) && !(hideSold.checked && p.soldTo)
  );

  if (sortKey) {
    visible.sort((a, b) => comparators[sortKey](a, b, sortAsc));
  }

  playerListBody.innerHTML =
    visible.length === 0 ? emptyRow('No players match the current filters.') : visible.map(playerRow).join('');
}

hideSold.addEventListener('change', render);

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

function teamCard(team, rank) {
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
  return `<div class="team-card${mine}${active}" data-team="${esc(team.name)}">
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
}

// --- Sales log: one line per assignment, stored in the auction file ---
const auctionLogList = document.getElementById('auctionLogList');

function logTime(at) {
  const d = new Date(at);
  return Number.isNaN(d.getTime())
    ? '--:--'
    : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function logEntryRow(entry) {
  return `<li class="log-entry">
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

function addLogEntry(player, team, price) {
  auction.log.push({
    player: player.name,
    team: team.name,
    price,
    at: new Date().toISOString(),
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
  pickedTeam = pickedTeam === name ? '' : name;
  renderTeams();
});

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
      (p, i) => {
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
      }
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
// "Selected: Name, Team [badges]" — name and team in the app orange. Already
// sold players carry who bought them, since Assign will refuse them.
function showSelected(p) {
  if (!p) {
    selectedLabel.className = 'is-empty';
    selectedLabel.innerHTML = '<span class="selected-empty">No player selected</span>';
    return;
  }
  // The strip takes the colour of the first (main) role badge.
  selectedLabel.className = `pick-${esc((p.roles || [])[0] || '')}`;
  selectedLabel.innerHTML = `<span class="selected-name">${esc(p.name)}</span>
    <span class="selected-team">${esc(p.team)}</span>
    <span class="selected-badges">${roleBadges(p)}</span>`;
}

function selectPlayer(p, { scroll = false } = {}) {
  // Sold players are out of the auction: they never reach the selection field.
  if (p.soldTo) {
    message(`${p.name} is already sold to ${p.soldTo} for ${p.price} fM.`);
    return;
  }
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
  message('');
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

// --- Assign a player to a team ---
const assignBtn = document.getElementById('assignBtn');
const assignPrice = document.getElementById('assignPrice');
const assignMsg = document.getElementById('assignMsg');
const soldCounter = document.getElementById('soldCounter');
const saveBtn = document.getElementById('saveBtn');

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

function updateSoldCounter() {
  const sold = allPlayers.filter((p) => p.soldTo).length;
  soldCounter.textContent = `sold ${sold} / ${allPlayers.length}`;
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
// the server keeps the file in auctions/ current.
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
  updateSoldCounter();
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
saveBtn.addEventListener('click', async () => {
  message('Saving…', 'ok');
  if (await persist()) {
    message('Saved.', 'ok');
  }
});

// --- Boot ---
const auction = loadAuction();

if (!auction) {
  playerListBody.innerHTML = emptyRow('No auction loaded — go Home → Continue and pick a saved file.');
  renderLog();
} else {
  allPlayers = auction.players || [];
  auction.log = auction.log || []; // older auction files have no log yet
  teams = makeTeams(auction.teams, auction.initialCredits);
  hydrateTeams(); // replay past assignments into credits and rosters
  showSelected(null);
  document.getElementById('auctionLeague').textContent = auction.leagueName;
  updateSoldCounter();
  setAllRoles(true); // start unfiltered
  hideSold.checked = false; // browsers restore checkbox state on reload
  render();
  renderTeams();
  renderLog();
}
