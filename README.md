# Dominion Dealer

Play all your Dominion boxes at once, without shuffling every randomizer card together. Tick what you own and it tells you how many Kingdom cards to take from each box — the same spread you'd get from one big shuffle.

👉 **[Open the app](https://wil-vanderstaay.github.io/dominion/dealer/)** — nothing to install.

```
Base 2E: 4
Seaside 2E: 3
Prosperity: 2
Menagerie: 1
Platinum/Colony: Yes
```

It picks the split, not the cards: shuffle each box's own randomizers and take the number shown. Expansions that draw nothing are left off the list.

> **Vibe coded.** Built conversationally with an AI assistant rather than written line by line. A single-file hobby tool that shuffles numbers in your browser — no accounts, no data leaving your device.

---

## How it works

**🎲 Draw 10** draws from everything ticked, weighted by each expansion's randomizer count — so 40-card Plunder comes up proportionally more often than 12-card Alchemy.

**🎰 Random Mix** cuts your ticks down to a random few first. Two modes, set in ⚙:

- **Any** — *x* expansions at random.
- **Base + others** — Base, plus *x−1* at random.

*x* defaults to 2. With Prosperity in the mix, the official Platinum/Colony rule is applied automatically.

## Settings

⚙ holds everything, staged against a working copy: **✓** commits, **✕** / backdrop / Escape discards. That's so you can try a sort and back out without losing a hand-arranged order.

- **Ownership** — ticked expansions stay in the main list; the rest sit under **More**. Collapsing **More** with ticks inside shows a badge: `More (2 ticked) ▼`.
- **Search** — filters the view only; never changes ownership or ticks. Reorder arrows disable while filtering, since the neighbour you'd swap with may be hidden.
- **Order** — default is both Base editions first, then every other expansion in original release order, editions kept adjacent. ▲▼ move one row; the sort buttons cycle **sort → flip → clear**.

Each sort button's arrow describes the order you get, not the underlying field:

| Button | ▲ | ▼ |
|---|---|---|
| **A–Z** | A to Z | Z to A |
| **Release** | Oldest first | Newest first |
| **Popularity\*** | Least popular first | Most popular first |

Popularity looks inverted because rank 1 *is* the most popular — ascending rank means descending popularity.

## Persistence

State lives in `localStorage`. Nothing is uploaded. Caveats worth knowing:

- Per-browser, per-device — phone and laptop don't share.
- Clearing browsing data wipes it; private windows discard on close (the app detects this and warns).
- **Safari** clears script-written storage after 7 days without a visit.

The app requests [persistent storage](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist), which exempts it from routine eviction on Chrome/Firefox. More usefully, **⚙ → Copy link** encodes the entire setup into a URL:

```
https://wil-vanderstaay.github.io/dominion/dealer/#setup=RQKKCCAAACA
```

Ownership, order, sort, ticks and mix settings — **11 characters**. It's the backup, and the way to move a setup between devices.

<details>
<summary>Link format</summary>

```
4b version | 6b idCount | 3b sortMode
sortMode 7 only: idCount × 6b   (an explicit hand-made order)
idCount × 1b owned | idCount × 1b selected | 1b mixMode | 6b mixSize
```

`sortMode` is 0 for the default order, 1–6 for the three sorts in each direction, 7 for a hand-made one.

Two things keep it short. Ownership and ticks are **bitmaps indexed by expansion id**, one bit each. And an order produced by a sort isn't stored — only the sort is, and the order is recomputed on decode. Sorting is a total order (ties break on id), so it reproduces exactly. Only a hand-made order needs the full permutation, landing near 31 characters. The 6-bit fields cap this at 63 expansions.

Links from older format versions are rejected rather than misread; the page falls back to defaults. Saved `localStorage` state migrates via `LEGACY_NAMES`.
</details>

## Run and deploy

One self-contained HTML file. No build, no dependencies, no network calls.

```bash
git clone https://github.com/wil-vanderstaay/dominion.git
# open dealer/index.html, or:
python -m http.server 8000   # http://localhost:8000/dealer/
```

Hosted via GitHub Pages' built-in `pages-build-deployment` action — no workflow file to maintain. To host a fork: **Settings → Pages → Deploy from a branch**, `main` + `/ (root)`. Lands at `https://<user>.github.io/<repo>/dealer/`.

The site root 404s because the app lives in `dealer/`; move `index.html` up or add a redirect if that bothers you.

**Publishing is safe here** — static files, no server, no secrets, no network requests, settings never leave the device. Standard caveats apply: git history is public including deleted files, and Pages sites can't be private on free accounts.

## Tests

```bash
node test.js
```

No dependencies, no `package.json`, no config — just Node and the built-in `fs`/`path`. Runs from any directory. It extracts the `<script>` block from `dealer/index.html` and runs it against a stubbed DOM, so it tests the shipping file rather than a copy.

86 checks across: expansion data (unique ids within the link's 6-bit field, edition splits, counts, dates) · default order · all three sorts both ways plus the three-click cycle, **asserting each arrow against the order actually produced** · search isolation · staged settings · link round-trips and rejection of stale/junk links · saved-state migration · draw totals, weighting, zero-row suppression, both mix modes · footer and badge copy · modal layout · markup invariants (every handler and element id resolves).

Add one with `test('name', fn)` inside a `group(...)`; call `env()` for a fresh app and assert with `eq`, `ok`, `deepEq`, `match` or `ordered`. Returning a string prints it beside the result.

> On Windows, if `node` isn't on PATH it's usually at `C:\Program Files\nodejs\node.exe`.

## Expansion data

16 expansions as 20 entries. Editions are split only where the Kingdom card count changed, since that changes the draw weighting; otherwise one entry dated to the newest edition.

| Entry | Cards | Dated |
|---|---|---|
| Base 1E / 2E | 25 / 26 | 2008 / 2016 |
| Intrigue 1E / 2E | 25 / 26 | 2009 / 2016 |
| Seaside 1E / 2E | 26 / 27 | 2009 / 2022 |
| Alchemy | 12 | 2010 |
| Prosperity | 25 | 2022 (2nd ed.) |
| Cornucopia | 13 | 2024 (C&G 2nd ed.) |
| Hinterlands | 26 | 2022 (2nd ed.) |
| Dark Ages | 35 | 2012 |
| Guilds | 13 | 2024 (C&G 2nd ed.) |
| Adventures | 30 | 2015 |
| Empires | 24 | 2016 |
| Nocturne | 33 | 2017 |
| Renaissance | 25 | 2018 |
| Menagerie | 30 | 2020 |
| Allies | 31 | 2022 |
| Plunder | 40 | 2022 |
| Rising Sun | 25 | 2024 |

Prosperity and Hinterlands swapped six cards in 2022 without changing their totals. Cornucopia and Guilds were reissued as one box in March 2024, still 13 each.

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Dominion_(card_game)), [Rio Grande Games](https://www.riograndegames.com/games/dominion-cornucopia-guilds/), [ICv2](https://icv2.com/articles/news/view/56342/cornucopia-guilds-joins-dominion-second-edition).

**\*** Popularity is a hand-kept ranking from BoardGameGeek ratings and community consensus — **not live data**, and nobody's official verdict. BGG's XML API now requires auth, so it can't be fetched. Edit the `pop` values or just reorder with the arrows.

## Modifying it

All in [`dealer/index.html`](dealer/index.html) — markup, CSS and JS in one file.

| | |
|---|---|
| [`MASTER`](dealer/index.html#L647) | Expansion list. `id` is permanent (links encode it) — never reuse or renumber; new entries take the next free id. The array itself can be reordered freely. |
| [`LEGACY_NAMES`](dealer/index.html#L671) | Old saved names → current ones, so renames don't break saved setups. |
| [`DEFAULT_OWNED`](dealer/index.html#L677) | What a first-time visitor sees. |
| [`applyState()`](dealer/index.html#L729) | Merges saved/linked state against `MASTER`; keeps old setups valid as expansions are added. |
| [`SORTS`](dealer/index.html#L811) | Comparator, label, arrows and hint per sort mode. Add a sort here plus a button. |
| [`encodeSetup()`](dealer/index.html#L855) | Bit-packed link format. |
| [`openSettings()`](dealer/index.html#L1080) | Builds the working copy that ✓/✕ commit or discard. |
| [`applySort()`](dealer/index.html#L1181) | Applies a sort. Links depend on it being a total order. |
| [`performDraw()`](dealer/index.html#L1296) | Weighted pool, Fisher–Yates, take 10. |
| [`drawWithRandomMix()`](dealer/index.html#L1352) | The two mix modes. |

Edit, save, refresh.

---

[Dominion](https://www.riograndegames.com/games/dominion/) is by Donald X. Vaccarino, published by Rio Grande Games. Unofficial fan tool, no affiliation, contains no game content — only expansion names and randomizer counts.
