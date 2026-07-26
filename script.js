const continueAuctionBtn = document.getElementById('continueAuctionBtn');
const continueAuctionFile = document.getElementById('continueAuctionFile');

// Open the file-explorer dialog when "Continue" is clicked.
continueAuctionBtn.addEventListener('click', () => {
  continueAuctionFile.click();
});

// Check the loaded object actually looks like a saved auction.
function isValidAuction(data) {
  return (
    data &&
    typeof data === 'object' &&
    typeof data.leagueName === 'string' &&
    Array.isArray(data.teams) &&
    Array.isArray(data.players)
  );
}

continueAuctionFile.addEventListener('change', async () => {
  const file = continueAuctionFile.files[0];
  if (!file) {
    return;
  }

  let data;
  try {
    const text = await file.text();
    data = JSON.parse(text);
  } catch (err) {
    alert('That file is not valid JSON — pick a saved auction file.');
    continueAuctionFile.value = '';
    return;
  }

  if (!isValidAuction(data)) {
    alert('That JSON is not a saved auction (missing league name, teams, or players).');
    continueAuctionFile.value = '';
    return;
  }

  // Stash for the next page, then go there.
  sessionStorage.setItem('fcmAuction', JSON.stringify(data));
  window.location.href = 'auction.html';
});
