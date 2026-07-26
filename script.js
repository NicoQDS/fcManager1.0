const continueAuctionBtn = document.getElementById('continueAuctionBtn');
const continueAuctionFile = document.getElementById('continueAuctionFile');

continueAuctionBtn.addEventListener('click', () => {
  continueAuctionFile.click();
});

continueAuctionFile.addEventListener('change', () => {
  if (continueAuctionFile.files.length > 0) {
    window.location.href = 'new-auction.html';
  }
});
