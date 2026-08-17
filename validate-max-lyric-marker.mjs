/* ==========================================================================
 * validate-max-lyric-marker.mjs — the Max Mode lyrics-field marker.
 *
 * John, 2026-08-17, after the first successful live generation: "Whether it's
 * a Vocal or Instrumental song, when MAX MODE is selected, the Lyric prompt
 * field must have the slash-star marker at the very top." (The exact literal
 * is asserted below; it cannot appear in a block comment because it contains
 * a comment terminator — node --check does NOT catch that, but importing the
 * module does. That is how this was found.)
 *
 * WHY A VALIDATOR AND NOT JUST THE CODE. This is a cross-cutting requirement:
 * FOUR separate code paths produce a lyrics field (atom vocal, atom
 * instrumental, resolver, legacy) plus a fifth for live-generated lyrics, and
 * they were written at different times by different mechanisms. A requirement
 * that has to hold in five places is exactly the kind that gets satisfied in
 * four of them and silently missed in the fifth. The sweep below covers every
 * engine kind x both song types rather than spot-checking one.
 *
 * Also guards the two ways to get this subtly wrong: putting the STYLE field's
 * MAX_MODE_STR directive in the lyrics box, and accumulating duplicate markers
 * across re-renders.
 * ========================================================================*/
import { generate, generateLyricsLive, applyMaxToLyrics, MAX_LYRIC_MARKER } from './js/generate.js';
import { initState, syncEngineDefaults, setSongType } from './js/state.js';
import { MAX_MODE_STR } from './legacy/data-style-engines.js';

let failures = 0, checks = 0;
const bad = (m) => { console.error(`  FAIL: ${m}`); failures++; };
const ok = (cond, m) => { if (!cond) bad(m); };

/* ---- 1: the helper itself -------------------------------------------- */
{
  ok(MAX_LYRIC_MARKER === '///*****///', `marker must be exactly ///*****///, got "${MAX_LYRIC_MARKER}"`);
  ok(applyMaxToLyrics('[Verse 1]\nx', false) === '[Verse 1]\nx', 'Max off must leave the lyric untouched');
  const on = applyMaxToLyrics('[Verse 1]\nx', true);
  ok(on.startsWith(MAX_LYRIC_MARKER), 'Max on must prefix the marker');
  ok(on.split('\n')[0] === MAX_LYRIC_MARKER, 'the marker must be alone on the FIRST line, above everything');
  ok(on.includes('[Verse 1]'), 'the original lyric must survive');
  // Idempotent — a re-render or recalled favourite must not stack markers.
  ok(applyMaxToLyrics(on, true) === on, 'applying twice must not produce a second marker');
  ok(applyMaxToLyrics('', true).startsWith(MAX_LYRIC_MARKER), 'an empty lyric still gets the marker');
  ok(applyMaxToLyrics(null, true).startsWith(MAX_LYRIC_MARKER), 'a null lyric must not throw');
  checks++;
  console.log('  helper: exact marker, first line, idempotent, null-safe.');
}

/* ---- 2: EVERY engine kind x BOTH song types --------------------------
 * The point of the sweep. John's wording is explicit that this is not
 * vocal-only, so an instrumental build (whose lyrics field carries the
 * metatag block) must carry it too. */
{
  const ENGINES = ['Balearic Atom', 'Delerium', 'Era', 'Deep Forest', 'Sacred Spirit', 'Enigma', 'Balearic'];
  let covered = 0;
  for (const engineId of ENGINES) {
    for (const songType of ['vocal', 'instrumental']) {
      const S = initState();
      syncEngineDefaults(S, engineId);
      setSongType(S, songType);

      S.maxMode = false;
      const off = generate(S);
      if (off.stub) continue;
      ok(!String(off.lyrics).includes(MAX_LYRIC_MARKER),
        `${engineId}/${songType}: marker present with Max Mode OFF`);

      S.maxMode = true;
      const on = generate(S);
      const first = String(on.lyrics).split('\n')[0];
      ok(first === MAX_LYRIC_MARKER,
        `${engineId}/${songType}: lyrics field must START with the marker, got "${first.slice(0, 40)}"`);
      // The style field keeps its OWN, different directive — two Suno inputs,
      // two markers. Crossing them would put the wrong text in the wrong box.
      ok(String(on.style).startsWith(MAX_MODE_STR.split('\n')[0]),
        `${engineId}/${songType}: style field must still carry MAX_MODE_STR`);
      ok(!String(on.style).includes(MAX_LYRIC_MARKER),
        `${engineId}/${songType}: the lyric marker must NOT leak into the style field`);
      ok(!String(on.lyrics).includes('[Is_MAX_MODE'),
        `${engineId}/${songType}: the style directive must NOT leak into the lyrics field`);
      covered++;
    }
  }
  ok(covered >= 12, `expected at least 12 engine/song-type combinations, covered ${covered}`);
  checks++;
  console.log(`  sweep: ${covered} engine x song-type combinations, marker on when Max is on and absent when off.`);
}

/* ---- 3: LIVE generated lyrics ----------------------------------------
 * A fifth path, and the one John actually pastes for a vocal track. It comes
 * back from the LLM rather than from generate(), so it needed the marker
 * applied separately and could easily have been missed. */
{
  const S = initState();
  syncEngineDefaults(S, 'Balearic Atom');
  setSongType(S, 'vocal');
  S.maxMode = true;
  S.lyric.sourceType = 'Original concept';
  S.lyric.subject = 'a harbour at night';
  const fake = async () => JSON.stringify({
    title: 'T',
    lyrics: '[Verse 1]\nline one here\n\n[Chorus]\nline two here\n\n[Verse 2]\nline three\n\n[Chorus]\nline four',
    validation: { score: 90, passed: true, issues: [] },
  });
  const out = await generateLyricsLive(S, fake);
  ok(String(out.lyrics).split('\n')[0] === MAX_LYRIC_MARKER,
    'live-generated lyrics must start with the marker when Max Mode is on');
  ok(String(out.lyrics).includes('[Verse 1]'), 'the generated lyric must survive intact');

  S.maxMode = false;
  const out2 = await generateLyricsLive(S, fake);
  ok(!String(out2.lyrics).includes(MAX_LYRIC_MARKER),
    'live-generated lyrics must NOT carry the marker when Max Mode is off');
  checks++;
  console.log('  live path: marker applied to LLM-returned lyrics, both Max states.');
}

console.log(`validate-max-lyric-marker: ${checks} check groups, ${failures} failures.`);
process.exit(failures ? 1 : 0);
