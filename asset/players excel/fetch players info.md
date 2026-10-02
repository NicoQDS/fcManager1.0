# Fetch players info

## Instructions for the user

Do these steps, then tell Claude "do asset/players excel/fetch players info.md".

1. Download the players list Excel file from fantacalcio.it. Save it, unchanged, in `asset/players excel/raw data/`. That file must be the only one in the folder, so delete or move any older file first.

## Questions for the user

Before starting, Claude asks the user these questions and waits for the answers:

1. How many teams are in the league?
2. Classic or Mantra?

## Sources

When searching online for the data in the new columns, prefer these websites:

- https://www.fantacalcio.it/
- https://www.sosfanta.com/
- https://www.gazzetta.it/
- https://www.transfermarkt.it/
- https://www.fantacalcio-online.com/
- https://www.fantalab.it/
- https://www.fantacalciopedia.com/
- https://www.tuttofantacalcio.it/

Column-specific preferences:

- starter: slightly prefer the "formazione tipo" page on fantacalcio-online.com. Use the other sources to confirm it or fill gaps.

## Tasks for Claude

Read the single file in `raw data/` and never change it. Write the result as a new Excel file in `asset/players excel/`, with the same file name as the raw file.

1. In the sheet `Tutti`, add these columns after the last existing column (`FVM M`), in this order. The header goes in the same row as the existing headers.
   - starter
   - injury
   - tier
   - gk hierarchy
   - penalty
   - max price
   - target
   - notes

2. Fill the columns as described below.

   - starter: the likelihood, as a percentage from 0% to 100%, that the player will be a starter ("titolare"). Write it as an Excel percentage cell (e.g. 0.75 shown as 75%).
   - injury: a whole number from 1 to 3 for a currently injured player: based on the expected time out. 1 = light, up to 3 weeks. 2 = medium, more than 3 and up to 6 weeks. 3 = hard, more than 6 weeks. Leave the cell empty when the player is not injured.
   - tier: a whole number from 1 to 10 that ranks the player within his role. Tiers depend on the number of teams (N) and the league style:
     - Mantra: group players by Mantra role (column `RM`, e.g. `Dc`). A player with more than one role (e.g. `Dc;B`) is ranked only in his first role.
     - Classic: group players by classic role (column `R`: `P`, `D`, `C`, `A`).
     - Within each role, sort players from strongest to weakest, judged only by the online research. The strongest N get tier 1, the next N get tier 2, and so on up to tier 10.
     - Players ranked after tier 10 get an empty cell.
   - gk hierarchy: goalkeepers only, ranked within their own club by the online research. A whole number from 1 (most likely to start) to 4 (least likely to start).
     - Goalkeepers ranked after 4 get an empty cell. Outfield players always get an empty cell.
     - When two or more goalkeepers of the same club are in a ballot for the starting spot, write `ballottaggio` for each of them instead of a number. Also add this line to the notes cell of each of them, listing every goalkeeper in the ballot with his starter percentage: `- gk: Name1 60%, Name2 40%`, followed by a line break (a new line inside the cell). Plain text only, no HTML tags.
   - penalty: the player's place in his club's penalty-taker order, from the online research. 1 = most likely penalty taker, 2 = the next one. When two or more players of the same club are in a ballot to take penalties, write `ballottaggio` for each of them instead of a number. Leave the cell empty for everyone else.
     - Example: 8 teams, Mantra: the 8 strongest `Dc` get tier 1, the next 8 `Dc` get tier 2. 8 teams, Classic: the 8 strongest `D` get tier 1.
