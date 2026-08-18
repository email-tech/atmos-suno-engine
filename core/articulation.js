/* core/articulation.js — JOHN'S TWO MUSICAL RULES, 2026-08-17.
 *
 * RULE 1 — SUSTAINING ORCHESTRAL INSTRUMENTS PLAY LONG LEGATO NOTES.
 * John: they "should not have crisp attack and staccato or accented
 * characteristics, they should be long legato length notes". Refined the same
 * day: "only the orchestra instruments that can have a sustained note should be
 * legato. Any other instrument such as harps, mallets, vibraphones,
 * glockenspiel etc should remain as percussive styles within that orchestra
 * arrangement."
 *
 * So this is NOT a blanket ban on attack. It splits the orchestra by what the
 * instrument can physically do:
 *   - BOWED, BLOWN AND WIND-DRIVEN sources can hold a note. They must.
 *   - STRUCK AND PLUCKED sources cannot. A legato glockenspiel is not a
 *     restrained glockenspiel, it is a contradiction. They keep their percussive
 *     character and this rule does not touch them.
 *
 * WHY IT MATTERS BEYOND TASTE. The app names an instrument and says where it
 * sits, but has never said HOW IT PLAYS. "French horns" alone leaves the
 * articulation to Suno, and CONVENTION_BLEED (core/knowledge.js) records that
 * naming an orchestral instrument imports the whole orchestral production
 * convention — which is short, accented and sectional. The existing
 * BANNED_ARTICULATION list stops us WRITING the bad version; it does not make
 * the good version happen. Banning a word is not an instruction.
 *
 * RULE 2 — ANYTHING ACTING AS A PAD MUST BE AN ENSEMBLE OR A CHORD OF THREE OR
 * MORE NOTES. John wants "a wide sound" and suspected, correctly, that a single
 * bass clarinet "might be very narrow and thin even though it is a bass sound".
 * The test is POLYPHONY, not vocabulary: can this source produce three
 * simultaneous notes? A synth wash, a string section, a choir and an organ all
 * can. A solo clarinet, a solo flute and a single bowed cello cannot, however
 * sustained the prose around them is.
 *
 * EVIDENCE STATE: John's ear, stated as a rule. Not Suno-tested. Both rules are
 * about what the prompt ASKS FOR being musically coherent, which is decidable
 * without a Suno result.
 * ------------------------------------------------------------------------- */

/* Orchestral sources that can hold a note. Rule 1 applies to these only. */
export const SUSTAINING_RE = /\b(strings?|violin|violins|viola|violas|cello|cellos|contrabass|double bass|string section|string ensemble|brass|horn|horns|french horn|trumpet|trumpets|trombone|trombones|tuba|flute|flutes|piccolo|oboe|clarinet|clarinets|bassoon|cor anglais|ney|bansuri|shakuhachi|duduk|pan-flute|panpipes|recorder|saxophone|organ|harmonium|accordion|choir|chorus)\b/i;

/* Orchestral sources that CANNOT hold a note. Rule 1 explicitly does not apply.
 * Listed rather than inferred, because several of them sit in families this
 * project otherwise treats as pitched melodic sources. */
export const STRUCK_OR_PLUCKED_RE = /\b(harp|harps|marimba|vibraphone|vibes|glockenspiel|xylophone|celesta|celeste|timpani|tubular bells?|chimes?|crotales|mallets?|dulcimer|cimbalom|piano|harpsichord|pizzicato|guitar|lute|kora|koto|sitar|kalimba)\b/i;

/* Articulation that contradicts a held note. `pizzicato` is deliberately ABSENT
 * — plucked strings are a struck-or-plucked technique and fall under the second
 * list above, which John's refinement leaves alone. */
export const ATTACK_RE = /\b(stab|stabs|stabbing|staccato|spiccato|marcato|fanfare|ostinato|clipped|choppy|punchy|jabbing|short accented?)\b/i;

/* Wording that states a held note. */
export const LEGATO_RE = /\b(legato|sustained?|sustains|held|holding|long|drone|swell|swells|swelling|bowed|sweeping|soaring|slow|singing|flowing|breathy|keening|wailing|plaintive|aching|glissando|melisma|pedal)\b/i;

export const isSustaining = (t) => SUSTAINING_RE.test(String(t || '')) && !STRUCK_OR_PLUCKED_RE.test(String(t || ''));
export const isStruckOrPlucked = (t) => STRUCK_OR_PLUCKED_RE.test(String(t || ''));

/* RULE 1 check. Two failure modes, and only the first is unambiguous:
 *  - CONTRADICTS: a sustaining source carrying attack wording. Always wrong.
 *  - UNSTATED: a sustaining source with no articulation either way. Weaker —
 *    Suno is left to choose, and CONVENTION_BLEED says it will choose short.
 * Reported separately so the unambiguous ones can be enforced while the rest
 * stays visible without blocking. */
export function articulationFault(text) {
  const t = String(text || '');
  if (!isSustaining(t)) return null;
  if (ATTACK_RE.test(t)) return 'contradicts';
  if (!LEGATO_RE.test(t)) return 'unstated';
  return null;
}

/* RULE 2. Sources that can produce three or more simultaneous notes, either
 * because they are many players or because one player has many strings, keys,
 * pipes or oscillators. */
const POLYPHONIC_RE = /\b(section|sections|ensemble|quartet|quintet|orchestra|orchestral|choir|chorus|voices|pad|pads|wash|synth|polysynth|mellotron|string machine|organ|harmonium|accordion|tanpura|chords?|layered|stacked|massed|band|bed|guitar|harp|piano|dulcimer|cimbalom)\b/i;

/* A single-voice source cannot be a pad however sustained it is: a bass
 * clarinet holding one note is narrow and thin, which was John's own objection.
 * Being a drone does not rescue it — a drone is one note by definition, and one
 * note is not a chord of three. */
export function padWidthFault(text) {
  const t = String(text || '');
  if (!t) return null;
  if (POLYPHONIC_RE.test(t)) return null;
  if (isSustaining(t) || /\bdrone\b/i.test(t)) return 'single-voice';
  if (isStruckOrPlucked(t)) return 'not-sustaining';
  return null;
}
