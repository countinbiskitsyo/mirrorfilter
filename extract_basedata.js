#!/usr/bin/env node
/*
 * MirrorFilter — base-item data extractor  (v2)
 * =======================================
 * Turns poe2db.tw class pages into the table MirrorFilter's BaseType
 * tooltips read, so the data can be refreshed in one command each patch
 * instead of being hand-copied class by class.
 *
 * WHY THIS EXISTS
 * ---------------
 * The tooltip needs block chance, Armour / Evasion / Energy Shield /
 * Runic Ward and requirements for ~3,100 bases. Transcribing that by hand
 * is slow, goes stale every patch, and — worst of all — a typo produces a
 * confidently wrong number with nothing to catch it. This script makes the
 * data reproducible: same input, same output, and a diff shows exactly what
 * a patch changed.
 *
 * v2 FIXES (v1 returned Shields only, with corrupted names)
 *   1. Names were glued to their first stat ("Aged Tower ShieldBlock chance:
 *      26%") because only block-level tags were turned into line breaks.
 *      poe2db wraps the name in <a>/<span>. Inline tags now break too, AND a
 *      newline is forced before every stat label as a belt-and-braces measure.
 *   2. Because of (1), a record was only detected when a line began with a
 *      stat label -- true for Shields by luck, false for every other class,
 *      hence "only found shields". Detection now keys on a NAME line followed
 *      immediately by a stat line.
 *   3. Values could attach to the wrong item: the name was searched backwards
 *      up to 5 lines and could run past the previous record (Blazon Crest
 *      Shield inherited Sigil's numbers). Records are now consumed forwards
 *      and never re-scanned.
 *   4. Entries with no defence at all (weapons, flasks, currency) are now
 *      skipped rather than written empty -- an empty entry would stop the
 *      tooltip correctly saying "no data".
 *
 * USAGE
 *   node extract_basedata.js                 # all classes
 *   node extract_basedata.js Gloves Boots    # just those
 *   node extract_basedata.js --debug Shields # also dump what the parser saw
 *
 * Writes basedata.js. Paste its contents over the
 * window.__MF_BASEDATA__ block in index.html.
 *
 * VERIFY BEFORE YOU TRUST IT
 *   Pick an item you own, Ctrl+C it in game, and compare. The Shields set
 *   was checked this way: Sectarian Crest Shield reads 61 Armour / 19
 *   Energy Shield / Level 33 / 27 Str / 27 Int in both. Do the same for
 *   each new class — one spot-check catches a parser that silently
 *   mis-reads a column.
 *
 * REQUIREMENTS
 *   Node 18+ (built-in fetch). No npm install needed.
 */

const fs = require('fs');

const CLASSES = [
  'Shields', 'Bucklers', 'Foci', 'Quivers',
  'Gloves', 'Boots', 'Body_Armours', 'Helmets',
  'Amulets', 'Rings', 'Belts',
  'Claws', 'Daggers', 'Wands', 'One_Hand_Swords', 'One_Hand_Axes',
  'One_Hand_Maces', 'Sceptres', 'Spears', 'Flails',
  'Bows', 'Staves', 'Two_Hand_Swords', 'Two_Hand_Axes', 'Two_Hand_Maces',
  'Quarterstaves', 'Crossbows', 'Talismans',
  'Life_Flasks', 'Mana_Flasks', 'Charms', 'Jewels'
];

const argv = process.argv.slice(2);
// --debug always writes debug_<Class>.txt even when parsing succeeded, so the
// page's real structure can be inspected rather than guessed at.
const DEBUG = argv.includes('--debug');
// --raw writes the WHOLE page HTML, so the parser can be finished without
// another round trip.
const RAW = argv.includes('--raw');
const want = argv.filter(a => a !== '--debug' && a !== '--raw');
const targets = want.length ? want : CLASSES;

// poe2db renders each base as a block of plain lines. We read the block,
// not the HTML structure, so a cosmetic site redesign is less likely to
// break this than a selector-based scrape would be.
// ─────────────────────────────────────────────────────────────────────────
// v7 — parses the HTML STRUCTURE, not flattened text.
//
// Earlier versions flattened the page to lines and hunted for "Armour: 61".
// That can never work here, because poe2db makes the LABEL a hyperlink:
//     <div class="property"><a ...>Armour</a>: <span>61</span></div>
//     <div class="property"><a ...>Block</a> chance: <span>25%</span></div>
// Any tag-based line break separates the label from its value, and splits
// "Block chance" down the middle. So we read each item's card as a block of
// HTML and strip tags only WITHIN a single property div, where the result is
// reliably "Label: value".
//
// Base items carry class="whiteitem"; uniques carry class="UniqueItem".
// That attribute is what keeps the 150 bases apart from the 20 uniques.
// ─────────────────────────────────────────────────────────────────────────

function textOf(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

const num = s => (s ? parseInt(String(s).replace(/,/g, ''), 10) : 0);

function parseClass(html) {
  const out = {};
  const cards = html.split(/<div class="d-flex border-top[^"]*">/);

  for (const card of cards) {
    if (!/class="whiteitem/i.test(card)) continue;      // bases only, not uniques

    let name = null;
    const anchors = card.match(/<a class="whiteitem[^"]*"[^>]*>([\s\S]*?)<\/a>/gi) || [];
    for (const a of anchors) {
      const t = textOf(a);
      if (t && t.length <= 60) { name = t; break; }
    }
    if (!name || out[name]) continue;

    const o = {};
    const extra = [];

    for (const p of card.match(/<div class="property">([\s\S]*?)<\/div>/gi) || []) {
      const t = textOf(p);
      let m;
      if ((m = t.match(/^Block chance:\s*([\d.]+)/i)))            o.b = Math.round(parseFloat(m[1]));
      else if ((m = t.match(/^Armour:\s*([\d,]+)/i)))             o.a = num(m[1]);
      else if ((m = t.match(/^Evasion(?:\s+Rating)?:\s*([\d,]+)/i))) o.e = num(m[1]);
      else if ((m = t.match(/^Energy Shield:\s*([\d,]+)/i)))      o.s = num(m[1]);
      else if ((m = t.match(/^Runic Ward:\s*([\d,]+)/i)))         o.w = num(m[1]);
      else if ((m = t.match(/^Physical Damage:\s*([\d,]+\s*-\s*[\d,]+)/i))) o.pd = m[1].replace(/\s/g, '');
      else if ((m = t.match(/^Critical Hit Chance:\s*([\d.]+)/i))) o.c = parseFloat(m[1]);
      else if ((m = t.match(/^Attacks per Second:\s*([\d.]+)/i)))  o.aps = parseFloat(m[1]);
      else if ((m = t.match(/^Weapon Range:\s*([\d.]+)/i)))        o.rg = parseFloat(m[1]);
      else if (/^Base Movement Speed:/i.test(t)) { /* not shown in tooltips */ }
      else if (/^(Currently has|Consumes)/i.test(t)) { /* charge bookkeeping */ }
      // Flasks and charms carry their behaviour here, e.g.
      // "Recovers 50 Life over 3 Second" / "Lasts 3 Second".
      else if (t && extra.length < 2) extra.push(t);
    }
    if (extra.length) o.p = extra;

    const rq = card.match(/<div class="requirements">([\s\S]*?)<\/div>/i);
    if (rq) {
      const t = textOf(rq[0]);
      let m;
      if ((m = t.match(/Level\s+(\d+)/i)))   o.lv = num(m[1]);
      if ((m = t.match(/(\d+)\s*Str/i)))     o.st = num(m[1]);
      if ((m = t.match(/(\d+)\s*Dex/i)))     o.dx = num(m[1]);
      if ((m = t.match(/(\d+)\s*Int/i)))     o.it = num(m[1]);
    }

    // The implicit is the whole point for rings, amulets, quivers and charms,
    // which have no stat block at all.
    const im = card.match(/<div class="implicitMod">([\s\S]*?)<\/div>/i);
    if (im) {
      const t = textOf(im[0]).replace(/\s+/g, ' ').trim();
      if (t && t.length <= 120 && !/^local /i.test(t)) o.im = t;
    }

    // Keep anything we learned something about. Previously only defences
    // counted, which is why 25 classes produced nothing at all.
    if (Object.keys(o).length) out[name] = o;
  }
  return out;
}

// Kept so --debug can still show a readable flattening of the page.
function normaliseLines(html) {
  return textOf(html.replace(/<\/div>/gi, '\n').replace(/<br\s*\/?>/gi, '\n'))
    .split('\n').map(l => l.trim()).filter(Boolean);
}

(async () => {
  const all = {};
  const debugged = [];
  for (const cls of targets) {
    const url = 'https://poe2db.tw/' + cls;
    process.stdout.write('fetching ' + cls.padEnd(18));
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'MirrorFilter-basedata/1.0' } });
      if (!res.ok) { console.log('HTTP ' + res.status + ' — skipped'); continue; }
      const html = await res.text();
      if (RAW) fs.writeFileSync('debug_' + cls + '_full.html', html);

      const parsed = parseClass(html);
      Object.assign(all, parsed);
      const n = Object.keys(parsed).length;
      console.log(String(n).padStart(4) + ' bases' + (n ? (DEBUG ? '   (debug written)' : '') : '   <-- wrote debug file'));
      // A class returning nothing means the page is shaped differently than
      // expected. Dump what the parser actually saw so it can be fixed from
      // evidence instead of guesswork.
      if (!n || DEBUG) {
        // Full normalised text (not a 160-line slice: the first 160 lines are
        // site navigation and the UNIQUES table, never the base items).
        const norm = normaliseLines(html).join('\n');
        fs.writeFileSync('debug_' + cls + '.txt', norm);
        // And the RAW markup around a base stat, which is what the parser
        // actually needs to be written against.
        const hit = html.search(/class="whiteitem/i);
        if (hit > -1) {
          fs.writeFileSync('debug_' + cls + '_raw.html',
            html.slice(Math.max(0, hit - 3000), hit + 5000));
        }
        if (!debugged.includes('debug_' + cls + '.txt')) debugged.push('debug_' + cls + '.txt');
      }
    } catch (e) {
      console.log('FAILED: ' + e.message);
    }
    await new Promise(r => setTimeout(r, 1200)); // be polite to the site
  }

  const names = Object.keys(all).sort();
  const body = names.map(n =>
    JSON.stringify(n) + ':' + JSON.stringify(all[n])
  ).join(',\n');

  fs.writeFileSync('basedata.js',
    '// keys: b=block% a=armour e=evasion s=energyShield w=runicWard\n' +
    '//       pd=physDamage c=crit% aps=attacksPerSec rg=range p=[other props]\n' +
    '//       lv=level st=str dx=dex it=int im=implicit\n' +
    '// A key is absent when the base does not have that stat.\n' +
    '// Generated by extract_basedata.js from poe2db.tw on ' + new Date().toISOString().slice(0, 10) + '\n' +
    '// ' + names.length + ' bases.\n' +
    '// SPOT-CHECK one item per class against the game before shipping.\n' +
    'window.__MF_BASEDATA__ = {\n' + body + '\n};\n');

  console.log('\nwrote basedata.js — ' + names.length + ' bases');
  if (debugged.length) {
    console.log('\n' + debugged.length + ' class(es) returned nothing. Send these files:');
    debugged.forEach(f => console.log('   ' + f));
  }
  console.log('Spot-check a few against the game, then paste into index.html.');
})();
