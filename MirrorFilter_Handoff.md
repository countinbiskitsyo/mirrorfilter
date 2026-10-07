# MirrorFilter — Handoff

**Current version:** Web v5.225
**Game patch:** current with PoE2 0.5.5 (Forbidden Rites)
**Live site:** https://countinbiskitsyo.github.io/mirrorfilter/
**Repo:** github.com/countinbiskitsyo/mirrorfilter (index.html, README.md, LICENSE.txt)

Replaces the v5.205 handoff. A lot changed — see §3, §6 and §10.

---

## 1. WHAT THIS IS

A browser-based PoE2 loot filter editor. **One self-contained `index.html`**
(~1.8 MB: ~41k lines plus a 133 KB embedded base-item data table), deployed to
GitHub Pages. No build step. Upload the file, hard refresh, done.
Rollback = revert one file.

The user (Adamg) maintains a real 364-rule filter with it and plays the game
with the output. **The exported `.filter` is the only thing that reaches the
game — everything else is editor.**

---

## 2. HOW TO WORK ON IT

```
curl -sL -o index.html https://raw.githubusercontent.com/countinbiskitsyo/mirrorfilter/main/index.html
# ...edit...
node -e "...parse both <script> blocks..."     # ALWAYS validate
# browser-test with playwright
# bump line 3 marker AND CHANGELOG[0].v (they must match)
cp index.html /mnt/user-data/outputs/index.html
present_files
```

Check line 3's version against this doc. If it's newer, the user shipped
something this doc doesn't know about — trust the file and ask.

**Playwright is available** (`npm install playwright`, chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, use `--no-sandbox`).

**Sandbox network is restricted** to package registries + GitHub. poe.ninja,
poe2db and the Cloudflare Worker are unreachable. Economy features and
anything fetching base data can only be verified by the user.

### Export-parity test — run after ANY change
The single best proof that editor churn didn't change game output:
```js
await pg.evaluate(()=>loadExampleFilter());
const g = generateFilter(S,'T','T');   // returns a TUPLE; the text is g[0]
```
Expect 364 rules, 291 Show, 3 Hide, 0 bare BaseType lines, 195,509 chars.
Compare byte-for-byte against the previous build.

### Dismiss BOTH first-run prompts in every test
```js
await pg.evaluate(()=>document.getElementById('_bkNever')?.click());
await pg.evaluate(()=>{const b=[...document.querySelectorAll('button')]
  .find(x=>/No thanks/i.test(x.textContent)); b&&b.click();});
```

### Other test gotchas
- Hidden elements return empty `innerText` — use `textContent`.
- `page.click('text=...')` collides with repeated labels and gets blocked by
  the tooltip layer. Call the handler via `page.evaluate` instead.
- `parseFilterText()` returns `section_tree` (snake_case), not `sectionTree`.
  Assigning its result wholesale onto `S` silently leaves the tree empty.
- The tab is `viz`, not `stats` (`switchTab('viz')`).
- There is no `renderAll()`. The refresh idiom is
  `saveState(); renderList(); renderEditor(byId(activeId));`

---

## 3. ARCHITECTURE LANDMARKS

### Two `<script>` blocks
- **Block 0** — engine: parser, `generateFilter`, `buildMeta`, the backend shim
  IIFE (IndexedDB, File System Access), `window.MF_WEB` bridge.
- **Block 1** — UI: `S` state, rendering, all panels, `CHANGELOG`,
  `__MF_BASEDATA__`, `__MF_DEFAULT_TODO__`.

**A top-level `const` in a classic script is shared across blocks**, so block 0
functions CAN see block-1 constants at call time. But anything declared *inside*
the block-0 IIFE (e.g. `_dirHandle`) is invisible from outside — route those
through `window.MF_WEB`.

### Key globals
- `S` — the whole editor state. Persisted to IndexedDB via `saveState()`.
- `ALL_BASETYPES` = `CSUGG_CURRENCY_POE2` + `CSUGG_BASETYPES_POE2` (3,098).
  **The database is in TWO halves — always use `ALL_BASETYPES`.** It feeds
  three things: BaseType autocomplete, paste validation, and the
  unknown-BaseType check.
- `__MF_BASEDATA__` — **generated, do not hand-edit** (see §6).
- `LEAGUE_TIMELINE` — single source of truth for leagues (§5).

### `saveState()` re-reads the DOM
It overwrites `S.filterName` and `S.league` from the input and dropdown. Code
that sets those then calls `saveState()` must push the values into the controls
first (`syncRestoredIdentityToDOM()`).

### Section ids vs display paths
A rule's `.section` holds a section **id**. Imported Magic/Normal sections often
carry auto-generated `sec_xxx` ids while Rare ones carry readable path ids, so
**ids cannot be compared across trees**. Use `secPath(id)` for the display
breadcrumb (segments joined by ` › `). The mirror feature depends on this.

---

## 4. LOAD-BEARING SAFETY SYSTEMS — DO NOT REGRESS

1. **Empty condition lists emit nothing.** An empty `BaseType` array used to
   write a bare `BaseType ==`, silently widening the rule to whatever remained.
   Guard is in `generateFilter`.
2. **Rules that lose all BaseTypes to league filtering are commented out**
   with `[NO CONTENT THIS LEAGUE]`.
3. **Section identity (`@id:` tags)** keeps same-named sections apart.
4. **`healSectionIdentity`** must stay a no-op on clean data. Test it.
5. **Auto-Tier collision guard.**
6. **An unrecognised BaseType stops PoE2 loading the filter entirely** — not a
   skipped line, no filter at all.
7. **Mirror previews before writing** and re-derives its plan on Apply,
   refusing if the filter changed since the preview was drawn.
8. **Tooltips never invent data.** A base absent from `__MF_BASEDATA__` shows
   no stats at all. Keys are omitted rather than zero-filled, so "none" and
   "unknown" stay distinguishable.

---

## 5. LEAGUE SYSTEM

**Adding a league = ONE line.** Append to `LEAGUE_TIMELINE` (oldest first).
Name must match poe.ninja exactly. **Leave old leagues in.**
**Hardcore is a checkbox**; `composeLeague()` handles hardcore Standard being
just `"Hardcore"`.
**League Content** records only *exceptions* and **fails open everywhere**.
Currently seeded: `Sacred Bloom: { addedIn: 'Forbidden Rites' }`.

---

## 6. BASE-ITEM DATA (tooltips) — GENERATED, DO NOT HAND-EDIT

`window.__MF_BASEDATA__` holds **1,744 bases across all 29 classes**, powering
the in-game-style tooltip shown when hovering a BaseType chip or an Economy
Prices row.

**Source:** poe2db.tw, data-mined from the game client (the same source
poe2filter.com uses for exact names). **Generated by `extract_basedata.js`**,
which lives on the user's PC — a to-do asks for it to be committed to the repo.

**Refresh after a patch:** re-run the script, diff the new `basedata.js`
against the old, paste over the `__MF_BASEDATA__` block. The diff is the list
of what GGG changed to item bases, which also matters for stat-based rules
(see §7 T2).

**Schema** — a key is ABSENT when the base lacks that stat:
`b`=block% `a`=armour `e`=evasion `s`=energyShield `w`=runicWard
`pd`=physDamage `c`=crit% `aps`=attacksPerSec `rg`=range `p`=[other props]
`lv`=level `st`/`dx`/`it`=attribute reqs `im`=implicit

**Verification that matters:** Sectarian Crest Shield reads
61 Armour / 19 ES / Level 33 / 27 Str / 27 Int in the table, on poe2db, and on
the user's real in-game item. All 143 shields from the earlier hand-made table
agree with the generated one exactly.

### Writing a poe2db parser — read this before touching it
It took SIX attempts, because the page was parsed by imagination rather than by
evidence. **The stat LABEL is itself a hyperlink:**
```html
<div class="property"><a ...>Armour</a>: <span>61</span></div>
<div class="property"><a ...>Block</a> chance: <span>25%</span></div>
```
Flattening the page to text therefore ALWAYS separates a label from its value,
and splits "Block chance" in half. Line-based parsing cannot work. Parse the
HTML structure per item card, stripping tags only *within* one `property` div.
Base items carry `class="whiteitem"`; uniques carry `class="UniqueItem"` — that
attribute is what keeps the two apart.
**If it ever needs changing, get the real HTML first** (`--raw --debug` dumps
the full page) and test against that, never against an invented sample.

---

## 7. OPEN ITEMS

### T1 — Sacred Bloom's Class is UNCONFIRMED (user's task)
Placed in **Omens** (`Class: Omen`). Sources disagree: poe.ninja files it under
`/omens/`, Game8 calls it a Currency, FilterBlade groups it with map fragments.
**A wrong Class fails SILENTLY** — the rule needs Class AND BaseType, so it
simply never matches. Only an in-game hover settles it.

### T2 — Ward-only shields fall through (user's decision)
The user converted Rare/Magic/Normal Off-hands from BaseType lists to
`BaseArmour`/`BaseEnergyShield`/`BaseEvasion` conditions — good, and
self-maintaining. But **13 high-tier Runeforged/Runemastered shields have ALL
defence converted to Runic Ward**, with zero Armour, Evasion and Energy Shield,
so they match none of the three rules and hit `Fallthrough!`. Examples:
Runeforged Stoic Crest Shield (Ward 146), Runeforged Grand Targe (176),
Runemastered Crucible Tower Shield (250). Their tooltips now say so explicitly.
Open question: their own rule, or folded into the existing three?

### Known, documented, not fixed
- **1b ghost sections** — the *bundled example filter* gains 5 empty sections
  on round trip (86→91). Converges, harmless, **does not affect the user's real
  filter** (88→88).
- **BaseType database gaps** — 499 equipment bases were added in 5.211
  (2,599 → 3,098), but ~497 Runeforged and ~180 Runemastered variants are still
  missing, and currency/gems/waystones/omens/essences were never audited. If
  filled, the BaseType check could become a hard pre-export gate.

### Cannot be done from the sandbox
Price accuracy, Worker health, poe2db fetches.

---

## 8. THINGS THAT BIT US (don't repeat)

- **Writing a parser against an imagined page.** Six failed versions; the fix
  was asking for raw HTML. See §6.
- **Declaring a variable in the wrong function** blanked the entire Visuals &
  Stats left column. The suite passed because no test opened that tab.
  **The user found it, not the tests.**
- **Editing `__MF_DEFAULT_TODO__` reached nobody.** The built-in list was only
  used when the user had NO saved list — i.e. never, for any real user. Now a
  `seedIntoExisting` flag merges new items once, and delivered ids are recorded
  so a deleted item stays deleted.
- **One shared folder handle.** Export/Quick-Save, every Multi-Location Save
  entry and disk auto-backup all share `_dirHandle`. Picking a folder for one
  silently re-points all of them — which is how Quick-Save stopped writing to
  the game folder. 5.207 added a confirm and a staleness flag; the one-slot
  design is unchanged.
- **Centred toolbar + variable-width children = visible shifting.** The status
  text and the pulsing Auto-Tier border changed width mid-action and slid the
  whole bar. Reserve fixed slots.
- **Free prose in a `#` comment next to a rule** was parsed as a section header
  on re-import, inventing a phantom section.
- **Comma-splitting pasted text** once corrupted the database.
- **Curly apostrophes** from wiki copy-paste don't match the database;
  `parseValueList` normalises them.
- **`doNewFilter` didn't clear `sectionTree`** — exported 448 lines of empty
  headers.
- **Guides/README drifting behind the tool.** When behaviour changes, grep them.
- **Inline `onclick` with nested quotes** leaked raw JS into visible text.

---

## 9. TESTING NOTES

Verified against the real filter:
- import → 364 rules, 88 sections, 0 orphans
- export → Show 286, Hide 3, 0 malformed lines (bundled example: Show 291)
- round trip ×3 → stable at 364/88
- `generateFilter` with an empty BaseType array → no bare line
- `healSectionIdentity(S)` → `changed=false`
- Visuals & Stats → both columns render (catches the scope bug)
- no scrollbar at 2560×1222
- `scrollToSaveStage()` → lands on Resources, no console errors
- mirror preview on the real filter → exactly 10 changes, idempotent on rerun
- `buildBaseTip('Chaos Orb')` → `''` (never invents data)

---

## 10. WHAT CHANGED SINCE v5.205

- **5.207** header-shift fix; shared-folder overwrite guard + stale-location flag
- **5.208–5.210** welcome box rebuilt as the same ①②③ stages used in Resources;
  Saving Your Work simplified and colour-themed per stage
- **5.211** 499 missing equipment bases added to the BaseType database;
  export verified byte-identical
- **5.213** Test Item can evaluate `BaseArmour`/`BaseEnergyShield`/`BaseEvasion`
  (it never read those lines before), and is honest about augmented values
- **5.214** to-do seeding actually reaches an existing list
- **5.215** **Mirror Rare → Magic/Normal** (Resources → Filter Cleanup Tools)
- **5.217** mirror preview legend
- **5.218–5.223** BaseType tooltips: shields-only hand table → 1,744 bases
  across all 29 classes, generated and verified
- **5.225** to-dos for tooltips phase 2, patch-refresh, and moving the
  base-data refresh into the tool via the Worker

---

## 11. USER PREFERENCES

- Wants to know *why*, not just *what* — explain reasoning and trade-offs.
- Values honesty about uncertainty over false confidence. Say when something is
  untested or unverifiable — **up front, not after it fails.**
- Cares a lot about not breaking a working tool. Offer rollback, keep backups,
  measure before and after.
- Dislikes wordiness in UI copy. Short lines, bold only what matters.
- Wants UI that is **scannable by label**, not prose read top-to-bottom.
- Will run scripts and paste results back — a good channel for anything the
  sandbox cannot reach. Give printable instructions when asked.
- **The backup system is "the safety net of the entire project"** — err toward
  more explanation there, never less.
