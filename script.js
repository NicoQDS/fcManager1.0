const auctionList = document.getElementById('auctionList');

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatModified(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

async function loadAuctionList() {
  let auctions;
  try {
    const res = await fetch('/api/auctions');
    if (!res.ok) {
      throw new Error(res.statusText);
    }
    auctions = await res.json();
  } catch (err) {
    auctionList.innerHTML = '<li class="list-group-item text-danger">Could not load saved auctions.</li>';
    return;
  }

  if (auctions.length === 0) {
    auctionList.innerHTML = '<li class="list-group-item text-muted">No saved auctions yet.</li>';
    return;
  }

  auctionList.innerHTML = auctions
    .map(
      (a) => `<li class="list-group-item list-group-item-action auction-list-item" role="button" data-id="${esc(a.id)}">
        <span class="auction-list-name">${esc(a.leagueName)}</span>
        <span class="auction-list-date">${esc(formatModified(a.modifiedAt))}</span>
      </li>`
    )
    .join('');
}

auctionList.addEventListener('click', async (e) => {
  const item = e.target.closest('.auction-list-item');
  if (!item) {
    return;
  }

  try {
    const res = await fetch(`/api/auctions/${encodeURIComponent(item.dataset.id)}`);
    if (!res.ok) {
      throw new Error(res.statusText);
    }
    const data = await res.json();
    sessionStorage.setItem('fcmAuction', JSON.stringify(data));
    window.location.href = 'auction.html';
  } catch (err) {
    alert('Could not load that auction.');
  }
});

loadAuctionList();

// --- Set Up New Auction ---
const enableMaxBuyable = document.getElementById('enableMaxBuyable');
const maxBuyable = document.getElementById('maxBuyable');
const initialCredits = document.getElementById('initialCredits');
const numTeams = document.getElementById('numTeams');
const teamNamesBlock = document.getElementById('teamNamesBlock');
const continueBtn = document.getElementById('continueBtn');
const leagueName = document.getElementById('leagueName');
const settingsFields = document.getElementById('settingsFields');
const playersUploadSection = document.getElementById('playersUploadSection');
const playersFile = document.getElementById('playersFile');
const createAuctionBtn = document.getElementById('createAuctionBtn');
const saveStatus = document.getElementById('saveStatus');

// Players parsed from the last valid xlsx, ready to save.
let parsedPlayers = null;

function updateMaxBuyableEnabled() {
  maxBuyable.disabled = !enableMaxBuyable.checked;
}

function syncTeamNameInputs() {
  // Clamp only the field count we build, not the input's own value — that
  // would overwrite the user mid-keystroke (e.g. typing "12" gets stuck at
  // "2" the moment "1" alone reads below min).
  const max = parseInt(numTeams.max, 10);
  const count = Math.min(parseInt(numTeams.value, 10) || 0, max);
  const current = teamNamesBlock.querySelectorAll('input').length;

  if (count > current) {
    for (let i = current + 1; i <= count; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'mb-2';
      const input = document.createElement('input');
      input.type = 'text';
      // The first slot is the user's own team — marked out from the rest.
      input.className = i === 1 ? 'form-control user-team' : 'form-control';
      input.placeholder = i === 1 ? 'Your Team' : `Team ${i}`;
      wrapper.appendChild(input);
      teamNamesBlock.appendChild(wrapper);
    }
  } else if (count < current) {
    const wrappers = teamNamesBlock.children;
    for (let i = current; i > count; i--) {
      teamNamesBlock.removeChild(wrappers[wrappers.length - 1]);
    }
  }
}

function validateForm() {
  const requiredFields = [leagueName, ...teamNamesBlock.querySelectorAll('input')];
  let isValid = true;

  requiredFields.forEach((field) => {
    if (field.value.trim() === '') {
      field.classList.add('is-invalid-field');
      isValid = false;
    } else {
      field.classList.remove('is-invalid-field');
    }
  });

  return isValid;
}

enableMaxBuyable.addEventListener('change', updateMaxBuyableEnabled);

// Clamp on blur, not on every keystroke — otherwise typing "12" gets
// overwritten to "2" the moment the lone "1" reads below min.
numTeams.addEventListener('blur', () => {
  const min = parseInt(numTeams.min, 10);
  const max = parseInt(numTeams.max, 10);
  const value = parseInt(numTeams.value, 10) || min;
  numTeams.value = Math.min(Math.max(value, min), max);
  syncTeamNameInputs();
});

numTeams.addEventListener('input', syncTeamNameInputs);

continueBtn.addEventListener('click', () => {
  if (!validateForm()) {
    return;
  }

  settingsFields.disabled = true;
  continueBtn.disabled = true;
  playersUploadSection.classList.remove('d-none');
});

// Turn the "Tutti" sheet into our player shape.
function parsePlayers(sheet) {
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find the header row (the one that has both "Id" and "Nome").
  const headerIdx = rows.findIndex((r) => r.includes('Id') && r.includes('Nome'));
  if (headerIdx === -1) {
    return [];
  }

  const head = rows[headerIdx];
  const col = (name) => head.indexOf(name);
  const cId = col('Id');
  const cRM = col('RM');
  const cNome = col('Nome');
  const cSquadra = col('Squadra');
  const cQtA = col('Qt.A M');
  const cQtI = col('Qt.I M');
  const cDiff = col('Diff.M');
  const cFvm = col('FVM M');

  const players = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r[cId] === '' || r[cNome] === '') {
      continue;
    }
    players.push({
      id: r[cId],
      roles: String(r[cRM] || '')
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean),
      name: r[cNome],
      team: r[cSquadra],
      qt: r[cQtA],
      qtInitial: r[cQtI],
      diff: r[cDiff],
      fvm: r[cFvm],
    });
  }
  return players;
}

// Gather form + parsed players into one auction object.
function buildAuction() {
  const teams = [...teamNamesBlock.querySelectorAll('input')].map((i) =>
    i.value.trim()
  );
  return {
    leagueName: leagueName.value.trim(),
    initialCredits: parseInt(initialCredits.value, 10),
    maxBuyableEnabled: enableMaxBuyable.checked,
    maxBuyable: parseInt(maxBuyable.value, 10),
    teams,
    userTeam: teams[0] || '', // first name entered is the user's own team
    players: parsedPlayers,
  };
}

playersFile.addEventListener('change', async () => {
  createAuctionBtn.classList.add('d-none');
  saveStatus.innerHTML = '';
  parsedPlayers = null;

  const file = playersFile.files[0];
  if (!file) {
    return;
  }

  const workbook = XLSX.read(await file.arrayBuffer());
  if (!workbook.SheetNames.includes('Tutti')) {
    alert('No "Tutti" sheet found — this is probably the wrong file.');
    playersFile.value = '';
    return;
  }

  parsedPlayers = parsePlayers(workbook.Sheets['Tutti']);
  if (parsedPlayers.length === 0) {
    alert('Could not read any players from the "Tutti" sheet.');
    playersFile.value = '';
    return;
  }

  saveStatus.innerHTML = `<div class="text-muted">${parsedPlayers.length} players loaded. Ready to create.</div>`;
  createAuctionBtn.classList.remove('d-none');
});

createAuctionBtn.addEventListener('click', async () => {
  const auction = buildAuction();

  createAuctionBtn.disabled = true;
  saveStatus.innerHTML = '<div class="text-muted">Saving…</div>';

  try {
    const res = await fetch('/api/auctions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(auction),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Save failed');
    }
    // Straight into the auction — the id comes back from the server, so the
    // stored copy matches the file the auction page will save back to.
    sessionStorage.setItem('fcmAuction', JSON.stringify({ id: data.id, ...auction }));
    window.location.href = 'auction.html';
  } catch (err) {
    saveStatus.innerHTML = `<div class="alert alert-danger">Could not save: ${err.message}</div>`;
    createAuctionBtn.disabled = false;
  }
});

updateMaxBuyableEnabled();
syncTeamNameInputs();
