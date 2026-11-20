// server/eschatologyPacks.js
//
// **Real, per-tradition end-times/eschatology content — reported,
// same posture as `migrationPathwayPacks.js`'s `dominantPathway`,
// never wired to any decision mechanic.**
//
// ---------------------------------------------------------------------
// What this answers, and the one thing it is not
// ---------------------------------------------------------------------
// Task #158 asked for real, citable eschatology/end-times content per
// religious tradition — Jewish Mashiach, Christian Second Coming,
// Islamic Mahdi/Isa, and so on — as reported narrative/flavour data,
// never a decision input. This is doctrine, not statistics: there is
// no survey or government table to cite the way `religionImport.js`'s
// county shares are cited. What makes this real rather than invented
// is that every entry below names an actual, documented theological
// concept with its own real term and source tradition (the Nicene
// Creed's "He will come again to judge the living and the dead";
// Maimonides' Thirteen Principles on the Messiah; the Qur'an/hadith
// literature's Yawm al-Qiyamah; and so on) — not a game-designed
// substitute for one.
//
// ---------------------------------------------------------------------
// Keyed on `religionPacks.VOCABULARY`, exactly like every other closed
// vocabulary here
// ---------------------------------------------------------------------
// `religionPacks.TRADITIONS` is the real vocabulary `npcs.religion`
// already draws from when a religion pack is supplied. This module is
// the one step of generalisation `migrationPathwayPacks.PATHWAY_BY_
// GROUP` already took for ancestry: a real, documented concept per
// tradition, not an invented blend of several. Checked against that
// vocabulary at load time so the two cannot drift silently — the same
// discipline every cross-checked vocabulary in this registry already
// holds.
//
// ---------------------------------------------------------------------
// Three honest declines, not three invented entries
// ---------------------------------------------------------------------
// `sikh` — Sikh scripture (the Guru Granth Sahib) holds a cyclical
// view of creation and dissolution under Hukam (divine order), the
// same general cosmological shape Hindu/Buddhist cycles share, but
// names no individual future redeemer or apocalyptic event comparable
// to the Abrahamic traditions' end-times figures. Reporting one here
// would be inventing a doctrine this tradition does not teach, which
// is a worse mistake than leaving the entry null — the twenty-ninth
// standing rule's own distinction between a real gap and a fabricated
// fact, applied to doctrine instead of a number.
//
// `other` / `unaffiliated` — not a tradition at all; `other` is
// `religionImport.js`'s own catch-all for traditions the Census does
// not break out individually, and naming one specific eschatology for
// it would misattribute every tradition folded into the catch-all.
//
// `bahai` is NOT a decline, and is worth a note of its own: the
// Baha'i Faith teaches that the end-times expectations of the prior
// traditions (a Promised One) are already fulfilled in the lifetime
// of Bahá'u'lláh (1817-1892) — "progressive revelation" rather than a
// future-facing apocalyptic figure. That is itself the real,
// documented eschatological position, reported as what it actually
// is rather than forced into the same future-tense shape every other
// entry has.
//
// ---------------------------------------------------------------------
// §9 applies here exactly as it does to `dominantPathway`
// ---------------------------------------------------------------------
// Reported through `demographics.compositionOf`'s `religion` block
// only, keyed off the dominant religion drawn for an area — never a
// per-NPC fact, never read by anything that decides an outcome. No
// generator anywhere reads this to gate morality, criminality,
// intelligence or worth.

'use strict';

const religionPacks = require('./religionPacks.js');

//: `Object.keys(ESCHATOLOGY)` plus the two honest declines above —
//: cross-checked against `religionPacks.TRADITIONS` below, not against
//: this list, since the declines are deliberate absences rather than
//: a second vocabulary.
const ESCHATOLOGY = {
  protestant: {
    concept: 'Second Coming (Parousia) of Christ',
    summary: 'A literal future return of Christ, the resurrection of the dead, and a '
      + 'final judgement — denominations differ on the timing and mechanics '
      + '(premillennial, postmillennial, amillennial), but the return itself is a '
      + 'shared article of faith.',
    source: 'Nicene Creed ("He will come again..."); Book of Revelation',
  },
  catholic: {
    concept: 'Second Coming (Parousia) and the General Judgement',
    summary: 'Christ\'s glorious return, the resurrection of the body, and the Last '
      + 'Judgement separating the righteous from the condemned.',
    source: 'Catechism of the Catholic Church §§1038-1041; Nicene Creed',
  },
  orthodox: {
    concept: 'Second Coming (Parousia) and the Dread Judgement',
    summary: 'The same Nicene Creed article professed by Catholic and Protestant '
      + 'Christianity, with a distinct liturgical emphasis on the "Dread Judgement" '
      + 'and theosis (union with God) as the goal the Second Coming completes.',
    source: 'Nicene Creed; Eastern Orthodox liturgical tradition',
  },
  jewish: {
    concept: 'Mashiach and the Messianic Age (Yemot HaMashiach)',
    summary: 'A future anointed human descendant of King David who will gather the '
      + 'exiles, rebuild the Temple, and usher in an age of universal peace — a core '
      + 'tenet rather than an apocalyptic end of the world.',
    source: 'Maimonides\' Thirteen Principles of Faith, 12th principle',
  },
  muslim: {
    concept: 'Yawm al-Qiyamah (the Day of Resurrection), preceded by the Mahdi and the '
      + 'return of Isa (Jesus)',
    summary: 'Signs of the Hour, the appearance of a rightly-guided redeemer (the '
      + 'Mahdi) and the return of Isa to defeat the deceiver (al-Masih ad-Dajjal), '
      + 'followed by universal resurrection and judgement. Shia tradition holds a '
      + 'distinct, additional emphasis on the return of a specific hidden Imam.',
    source: 'Qur\'an; hadith literature on the signs of the Hour',
  },
  buddhist: {
    concept: 'Maitreya, the future Buddha',
    summary: 'A bodhisattva prophesied to appear on Earth in a far future age, once '
      + 'the current teaching (the Dharma of Gautama Buddha) has been forgotten, and '
      + 'to achieve enlightenment and teach it anew. Cyclical, not a final end of the '
      + 'world.',
    source: 'Pali Canon (Cakkavatti-Sihanada Sutta) and Mahayana sutras',
  },
  hindu: {
    concept: 'Kalki, the tenth avatar of Vishnu',
    summary: 'Prophesied to appear at the close of the Kali Yuga (the current age of '
      + 'decline) to end adharma (unrighteousness) and begin the Satya Yuga — part of '
      + 'a cyclical cosmology of ages, not a single final end.',
    source: 'Vishnu Purana; Bhagavata Purana',
  },
  // sikh deliberately absent — see header.
  bahai: {
    concept: 'Progressive revelation, already fulfilled',
    summary: 'The eschatological "Promised One" expected by Judaism, Christianity and '
      + 'Islam is taught to already have come, in the person of Bahá\'u\'lláh '
      + '(1817-1892) — a fulfilled, not future-facing, eschatology.',
    source: 'Bahá\'í scripture (Kitáb-i-Íqán); Bahá\'í teaching of progressive revelation',
  },
  'latter-day-saints': {
    concept: 'The Second Coming of Jesus Christ and the Millennium',
    summary: 'A literal future return of Christ, preceded by a gathering of Israel, '
      + 'beginning a thousand-year Millennium of Christ\'s reign on Earth.',
    source: 'Doctrine and Covenants 29, 45; Bible',
  },
  'jehovahs-witnesses': {
    concept: 'Armageddon and the Millennial Reign',
    summary: 'An imminent divine war (Armageddon) ending human governments, followed '
      + 'by Christ\'s thousand-year reign: 144,000 "anointed" in heaven and the '
      + 'remaining faithful living forever in an earthly paradise.',
    source: 'Watch Tower Bible and Tract Society literature; Book of Revelation',
  },
  // other deliberately absent — see header.
};

// **Checked once, at load time.** Every key here (other than the two
// documented declines) must be a real `religionPacks.TRADITIONS`
// entry — a typo or a renamed tradition on that side would otherwise
// silently stop being reported, the same drift-prevention check every
// other cross-referenced vocabulary in this registry already runs.
const DECLINED = ['sikh', 'other'];
for (const key of Object.keys(ESCHATOLOGY)) {
  if (!religionPacks.TRADITIONS.includes(key)) {
    throw new Error(`eschatologyPacks.js: "${key}" is not in religionPacks.TRADITIONS`);
  }
}
for (const tradition of religionPacks.TRADITIONS) {
  if (!(tradition in ESCHATOLOGY) && !DECLINED.includes(tradition)) {
    throw new Error(
      `eschatologyPacks.js: "${tradition}" is in religionPacks.TRADITIONS but neither `
      + 'reported nor declared declined',
    );
  }
}

// The real eschatology for a tradition, or null for `sikh`, `other`,
// `unaffiliated`, or any value this table does not recognise — never
// a guessed default.
function eschatologyFor(tradition) {
  return ESCHATOLOGY[tradition] ?? null;
}

module.exports = {
  ESCHATOLOGY,
  DECLINED,
  eschatologyFor,
};
