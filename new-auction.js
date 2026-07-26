const enableMaxBuyable = document.getElementById('enableMaxBuyable');
const maxBuyable = document.getElementById('maxBuyable');
const numTeams = document.getElementById('numTeams');
const teamNamesBlock = document.getElementById('teamNamesBlock');
const continueBtn = document.getElementById('continueBtn');
const leagueName = document.getElementById('leagueName');
const settingsFields = document.getElementById('settingsFields');
const playersUploadSection = document.getElementById('playersUploadSection');
const playersFile = document.getElementById('playersFile');

function updateMaxBuyableEnabled() {
  maxBuyable.disabled = !enableMaxBuyable.checked;
}

function syncTeamNameInputs() {
  const count = parseInt(numTeams.value, 10) || 0;
  const current = teamNamesBlock.querySelectorAll('input').length;

  if (count > current) {
    for (let i = current + 1; i <= count; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'mb-2';
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'form-control';
      input.placeholder = `Team ${i}`;
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

numTeams.addEventListener('input', syncTeamNameInputs);

continueBtn.addEventListener('click', () => {
  if (!validateForm()) {
    return;
  }

  settingsFields.disabled = true;
  continueBtn.disabled = true;
  playersUploadSection.classList.remove('d-none');
});

playersFile.addEventListener('change', async () => {
  const file = playersFile.files[0];
  if (!file) {
    return;
  }

  const workbook = XLSX.read(await file.arrayBuffer());
  if (!workbook.SheetNames.includes('Tutti')) {
    alert('No "Tutti" sheet found — this is probably the wrong file.');
    playersFile.value = '';
  }
});

updateMaxBuyableEnabled();
syncTeamNameInputs();
