# MirrorFilter

**A free, browser-based loot filter editor for Path of Exile 2 — by AdamGs.**

No install, no download, no setup. Open the site and start building your filter.

**▶ Use it here: https://countinbiskitsyo.github.io/mirrorfilter/**

---

## What it does

MirrorFilter is a full visual editor for PoE2 `.filter` files. Instead of hand-writing filter syntax, you build rules with a point-and-click interface and watch a live preview of exactly what the game will read.

- **Visual rule editor** — sections, rules, conditions, and visuals (text/background/border colors, font size, minimap icons, beams, and alert sounds) all editable by hand.
- **Live `.filter` preview** — see the generated filter update as you edit.
- **Loot-drop simulation** — preview how your rules look against a realistic ground scene, with multiple background environments.
- **Auto-Tier (live economy pricing)** — pulls current prices from poe.ninja and automatically sorts BaseTypes across your tiers by value. One click, no configuration.
- **Import / Export** — load any existing `.filter` and export back to disk. Exports include a `.meta.json` sidecar so re-importing restores your full tier config and section hierarchy, not just a flat rule list.
- **Bulk paste** — paste item lists from another filter or from a price-tracking site's table; MirrorFilter detects the format and pulls out the item names automatically.
- **Test Item** — paste an item's in-game copied text and see exactly which rule would match it, and why.
- **Themes** — multiple UI themes including 3D styles.

---

## How to use it

1. **Open** https://countinbiskitsyo.github.io/mirrorfilter/ in **Chrome or Edge** (recommended — see below).
2. **Build your filter**, or click **New Filter → Load Example Filter** to start from a full example and customize it.
3. **Export** (or **Quick-Save**) to write your `.filter` into your Path of Exile 2 folder:
   `Documents\My Games\Path of Exile 2`
4. In-game, select your filter under **Options → Game → Item Filter**.

> **Tip:** bookmark the site (Ctrl+D in Chrome) so it's always one click away.

---

## Where your data lives (important)

MirrorFilter runs entirely in your browser. **Your work is saved automatically in your browser's local storage** as you edit — close the tab, restart your PC, come back later, and it's still there.

A few things worth understanding:

- **Nothing is uploaded.** Your filter never leaves your computer. This site only serves the app itself.
- **Your data is per-browser, per-machine.** It doesn't automatically follow you to a different browser or a different computer.
- **Clearing your browser's site data / cookies for this site will erase your in-progress work.** (A normal "clear cached images and files" does not.)
- **Export is your backup.** The `.filter` (and its `.meta.json` sidecar) you export to disk is the real, portable copy of your work. To move your filter to another computer, **Export** it there and **Import** it here.

So: **auto-save keeps your session safe in this browser; Export/Import is how you back up and move your work.**

---

## Browser support

- **Chrome / Edge** — full support, including **direct-to-folder saving**: pick your Path of Exile 2 folder once and Export/Quick-Save writes straight into it. (Choose "Allow on every visit" when prompted so it stops re-asking.)
- **Other browsers** — the editor works fully; Export **downloads** the `.filter` and you drop it into your PoE2 folder yourself.

---

## Auto-Tier and pricing

Auto-Tier fetches live PoE2 economy prices from **poe.ninja** and redistributes your BaseTypes across your tier rules by chaos value. It's served through a small shared economy service so it works instantly for everyone — **you don't configure anything.**

Prices are cached briefly and shared across users, so it's fast and light on poe.ninja.

---

## Not affiliated with Grinding Gear Games

"AdamGs MirrorFilter" © 2026 by AdamGs. All rights reserved. Shared for personal use.

Not affiliated with, authorized, maintained, sponsored, or endorsed by Grinding Gear Games or Tencent. Path of Exile and Path of Exile 2 are trademarks of Grinding Gear Games.

Economy data provided by [poe.ninja](https://poe.ninja).

---

## For maintainers — this repository

This repo hosts the app via **GitHub Pages**. The live tool is the Pages URL above; this `github.com` page is just the source.

- `index.html` — the entire application (editor UI + in-browser engine + backend shim, all in one file).
- `loot_bg/` — the loot-simulation background images.

**To update the live site:** upload a new `index.html` (Add file → Upload files → commit). GitHub Pages redeploys in about a minute; hard-refresh with **Ctrl+Shift+R** to bypass the browser cache. `loot_bg/` only needs re-uploading if the images change.

### Maintainer reference

- **Live app:** https://countinbiskitsyo.github.io/mirrorfilter/
- **Economy backend (Cloudflare Worker):** https://mirrorfilter-econ.adamandlisag.workers.dev/
  Powers Auto-Tier for every user. If Auto-Tier suddenly breaks for everyone at
  once, check this Worker first — it's the single shared dependency.

> The Cloudflare **dashboard** link for editing this Worker contains the account
> ID, so it's deliberately kept out of this public repo. It lives in a local
> maintainer note instead.
