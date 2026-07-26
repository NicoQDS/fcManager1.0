// fcManager backend — serves the app and (later) saves/loads auctions.

const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Folder where saved auctions live. Create it once at startup if missing.
const AUCTIONS_DIR = path.join(__dirname, 'auctions');
fs.mkdirSync(AUCTIONS_DIR, { recursive: true });

// Read JSON request bodies into req.body automatically.
app.use(express.json({ limit: '5mb' }));

// Serve every file in this folder (index.html, CSS, JS, ...) over HTTP.
app.use(express.static(__dirname));

// Build "YYYY-MM-DD_HH-MM-SS" from local time.
function timestamp(date) {
  const p = (n) => String(n).padStart(2, '0');
  const d = `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
  const t = `${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}`;
  return `${d}_${t}`;
}

// Remove characters that are illegal in filenames.
function safeName(name) {
  return name.replace(/[\/\\:*?"<>|]/g, '-').trim();
}

// POST /api/auctions — save a new auction, return its id (= filename without .json).
app.post('/api/auctions', (req, res) => {
  const auction = req.body;

  if (!auction || typeof auction !== 'object' || Array.isArray(auction)) {
    return res.status(400).json({ error: 'Missing auction data' });
  }

  const leagueName = String(auction.leagueName || '').trim();
  if (!leagueName) {
    return res.status(400).json({ error: 'League name is required' });
  }

  const id = `${timestamp(new Date())}-${safeName(leagueName)}`;
  const record = { id, ...auction };

  const file = path.join(AUCTIONS_DIR, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(record, null, 2));

  res.status(201).json({ id });
});

// Start listening for requests.
app.listen(PORT, () => {
  console.log(`fcManager running at http://localhost:${PORT}`);
});
