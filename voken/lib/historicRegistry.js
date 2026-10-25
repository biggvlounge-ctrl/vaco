// VOKEN — the real historic register: historic places, monuments,
// homes, people (inventors, authors, notable historical figures),
// inventions, and books, each a mintable Cvltvre Card subject in its
// own right.
//
// **Why this is a fixed register, not free-text.** Every other card
// category is either about a real platform participant
// (`subjectPersonId`) or a real external record this ecosystem itself
// created (`sourceApp`/`sourceType`/`externalRef` — a World Layer
// location, a CVLLEX production order). A historic card has neither:
// nobody on this platform *is* Johannes Gutenberg, and no app here
// *owns* a record of the printing press. Minting one from free-text
// options would mean a card's factual content is whatever the minting
// operator typed, with no way to tell a real entry from an invented
// one. Checking every mint against this fixed register instead means
// a historic card always carries real, checkable information — this
// repository's own standing discipline (no fabricated vendors, no
// fabricated prices) applied identically to history.
//
// Every entry below is a real, well-documented historical fact, not
// invented for this ecosystem. `era` is deliberately approximate where
// the historical record itself is approximate or disputed (the
// telephone's invention is a genuine, noted historical dispute —
// stated as such, not smoothed over). This is a starting register, not
// a closed one — real entries are meant to be added, never fabricated
// ones.
//
// **`earliestYear` and `recognitions` feed the real Value Algorithm
// (Phase 1, `lib/valueAlgorithm.js`) directly**, by direct instruction:
// a historic card's "how much is it worth" question has a real, Genuine
// Significance Score built for exactly this (`computeGenuineSignificanceScore`
// — the doc's own "MLK test" example, real lasting significance that a
// viral post can never outrank). Rather than asking whoever mints a
// historic card to guess `longevityOfImpactYears` and
// `institutionalRecognitionCount`, `genuineSignificanceInputsFor()`
// below computes them from this register's own real facts — the same
// number every time a given slug is scored, not a per-mint guess.
// `earliestYear` is negative for a BCE date (so `-600` means 600 BCE),
// and is deliberately the year the subject's own real, lasting impact
// began (an invention's or a book's publication, a place's known
// construction/founding, a person's own landmark achievement) rather
// than, say, a person's birth year — the Genuine Significance Score is
// about documented impact, not lifespan. `recognitions` lists only
// specific, real, named honors this research is confident are true
// (a Nobel Prize, a UNESCO World Heritage Site designation) — left
// empty rather than guessed where no specific, confident citation
// exists, since an invented award would be exactly the fabrication
// this register exists to refuse.

const HISTORIC_SUBJECT_TYPES = ['place', 'monument', 'home', 'person', 'invention', 'book'];

const HISTORIC_REGISTRY = [
  // -- places --
  {
    slug: 'great-wall-of-china', subjectType: 'place', name: 'The Great Wall of China', era: '7th century BCE – 17th century CE', earliestYear: -650,
    summary: 'A series of fortifications built across northern China by successive dynasties, most famously extended and reinforced during the Ming dynasty (1368–1644) to defend against northern invasions.',
    recognitions: ['UNESCO World Heritage Site (1987)'],
  },
  {
    slug: 'machu-picchu', subjectType: 'place', name: 'Machu Picchu', era: 'c. 1450 CE', earliestYear: 1450,
    summary: 'A 15th-century Inca citadel set high in the Andes Mountains of Peru, built during the reign of Pachacuti and brought to wider international attention in 1911 by Hiram Bingham.',
    recognitions: ['UNESCO World Heritage Site (1983)', 'New7Wonders of the World (2007)'],
  },
  {
    slug: 'library-of-alexandria', subjectType: 'place', name: 'The Library of Alexandria', era: 'c. 3rd century BCE – 4th century CE', earliestYear: -280,
    summary: 'One of the largest and most significant libraries of the ancient world, founded in Alexandria, Egypt under the Ptolemaic dynasty and a major center of scholarship until its gradual decline.',
    recognitions: [],
  },
  {
    slug: 'pompeii', subjectType: 'place', name: 'Pompeii', era: '79 CE', earliestYear: 79,
    summary: 'A Roman city near modern Naples, Italy, buried and preserved under volcanic ash after the eruption of Mount Vesuvius in 79 CE, and rediscovered in the 18th century.',
    recognitions: ['UNESCO World Heritage Site (1997)'],
  },
  {
    slug: 'stonehenge', subjectType: 'place', name: 'Stonehenge', era: 'c. 3000–2000 BCE', earliestYear: -3000,
    summary: 'A prehistoric monument of standing stones on Salisbury Plain in England, whose exact original purpose remains debated among archaeologists.',
    recognitions: ['UNESCO World Heritage Site (1986)'],
  },

  // -- monuments --
  {
    slug: 'statue-of-liberty', subjectType: 'monument', name: 'The Statue of Liberty', era: '1886', earliestYear: 1886,
    summary: 'A copper statue in New York Harbor, a gift from France designed by Frédéric Auguste Bartholdi with an internal structure by Gustave Eiffel, dedicated in 1886 as a symbol of freedom.',
    recognitions: ['UNESCO World Heritage Site (1984)'],
  },
  {
    slug: 'mount-rushmore', subjectType: 'monument', name: 'Mount Rushmore', era: '1927–1941', earliestYear: 1927,
    summary: 'A sculpture carved into granite in South Dakota by Gutzon Borglum depicting the faces of Presidents Washington, Jefferson, Theodore Roosevelt, and Lincoln.',
    recognitions: [],
  },
  {
    slug: 'lincoln-memorial', subjectType: 'monument', name: 'The Lincoln Memorial', era: '1922', earliestYear: 1922,
    summary: "A monument in Washington, D.C. honoring President Abraham Lincoln, and the site of Martin Luther King Jr.'s 1963 \"I Have a Dream\" speech.",
    recognitions: [],
  },
  {
    slug: 'eiffel-tower', subjectType: 'monument', name: 'The Eiffel Tower', era: '1889', earliestYear: 1889,
    summary: "A wrought-iron lattice tower in Paris designed by Gustave Eiffel's engineering company, built as the entrance arch for the 1889 World's Fair.",
    recognitions: [],
  },
  {
    slug: 'taj-mahal', subjectType: 'monument', name: 'The Taj Mahal', era: '1632–1653', earliestYear: 1632,
    summary: 'An ivory-white marble mausoleum in Agra, India, commissioned by Mughal emperor Shah Jahan in memory of his wife Mumtaz Mahal.',
    recognitions: ['UNESCO World Heritage Site (1983)'],
  },
  {
    slug: 'christ-the-redeemer', subjectType: 'monument', name: 'Christ the Redeemer', era: '1931', earliestYear: 1931,
    summary: 'An Art Deco statue of Jesus Christ overlooking Rio de Janeiro, Brazil, designed by Paul Landowski and completed in 1931.',
    recognitions: ['New7Wonders of the World (2007)'],
  },

  // -- homes --
  {
    slug: 'monticello', subjectType: 'home', name: 'Monticello', era: 'c. 1772–1809', earliestYear: 1772,
    summary: "Thomas Jefferson's primary plantation home near Charlottesville, Virginia, which he designed himself and continually rebuilt over four decades.",
    recognitions: ['UNESCO World Heritage Site (1987)'],
  },
  {
    slug: 'mount-vernon', subjectType: 'home', name: 'Mount Vernon', era: 'c. 1758–1799', earliestYear: 1758,
    summary: "George Washington's plantation home on the Potomac River in Virginia, his primary residence from 1759 until his death in 1799.",
    recognitions: [],
  },
  {
    slug: 'graceland', subjectType: 'home', name: 'Graceland', era: '1957', earliestYear: 1957,
    summary: "Elvis Presley's Memphis, Tennessee mansion, purchased in 1957 and opened to the public as a museum in 1982.",
    recognitions: [],
  },
  {
    slug: 'anne-frank-house', subjectType: 'home', name: 'The Anne Frank House', era: '1942–1944', earliestYear: 1942,
    summary: 'The Amsterdam canal house where Anne Frank and her family hid from Nazi persecution from 1942 to 1944, now a museum built around the preserved hiding place.',
    recognitions: [],
  },
  {
    slug: 'the-white-house', subjectType: 'home', name: 'The White House', era: '1800', earliestYear: 1800,
    summary: 'The official residence and workplace of the President of the United States, completed in 1800 and occupied by every president since John Adams.',
    recognitions: [],
  },

  // -- people (inventors, authors, notable historical figures) --
  {
    slug: 'johannes-gutenberg', subjectType: 'person', name: 'Johannes Gutenberg', era: 'c. 1400–1468', earliestYear: 1440,
    summary: 'German craftsman credited with introducing movable-type printing to Europe around 1440, enabling the mass production of books, starting with the Gutenberg Bible.',
    recognitions: [],
  },
  {
    slug: 'nikola-tesla', subjectType: 'person', name: 'Nikola Tesla', era: '1856–1943', earliestYear: 1888,
    summary: 'Serbian-American inventor and engineer known for his contributions to the design of the modern alternating-current (AC) electrical supply system.',
    recognitions: ['SI unit "tesla" (magnetic flux density) named in his honor (1960)'],
  },
  {
    slug: 'marie-curie', subjectType: 'person', name: 'Marie Curie', era: '1867–1934', earliestYear: 1898,
    summary: 'Physicist and chemist who discovered the elements polonium and radium, and the first person to win Nobel Prizes in two different sciences (Physics, 1903; Chemistry, 1911).',
    recognitions: ['Nobel Prize in Physics (1903)', 'Nobel Prize in Chemistry (1911)'],
  },
  {
    slug: 'hedy-lamarr', subjectType: 'person', name: 'Hedy Lamarr', era: '1914–2000', earliestYear: 1942,
    summary: 'Austrian-American actress and inventor who co-invented a frequency-hopping spread-spectrum communication technique during WWII that later underpinned technologies such as Wi-Fi and Bluetooth.',
    recognitions: ['National Inventors Hall of Fame, with George Antheil (2014)'],
  },
  {
    slug: 'leonardo-da-vinci', subjectType: 'person', name: 'Leonardo da Vinci', era: '1452–1519', earliestYear: 1503,
    summary: 'Italian Renaissance polymath known for paintings including the Mona Lisa and The Last Supper, and for wide-ranging scientific and engineering studies recorded in his own notebooks.',
    recognitions: [],
  },
  {
    slug: 'ada-lovelace', subjectType: 'person', name: 'Ada Lovelace', era: '1815–1852', earliestYear: 1843,
    summary: "English mathematician whose 1843 notes on Charles Babbage's proposed Analytical Engine included what is widely regarded as the first published algorithm intended for a machine.",
    recognitions: [],
  },

  // -- inventions --
  {
    slug: 'printing-press', subjectType: 'invention', name: 'The Printing Press', era: 'c. 1440', earliestYear: 1440,
    summary: "Johannes Gutenberg's movable-type printing press made books dramatically faster and cheaper to produce, and is widely credited with accelerating the spread of literacy and ideas across Europe.",
    recognitions: [],
  },
  {
    slug: 'telephone', subjectType: 'invention', name: 'The Telephone', era: '1876', earliestYear: 1876,
    summary: 'Alexander Graham Bell was awarded the first US patent for a device transmitting speech electrically — a genuinely disputed historical claim, since Elisha Gray filed a competing claim the same day.',
    recognitions: [],
  },
  {
    slug: 'penicillin', subjectType: 'invention', name: 'Penicillin', era: '1928', earliestYear: 1928,
    summary: 'Discovered by Alexander Fleming when he noticed a mold accidentally contaminating a bacterial culture was killing the bacteria around it — the first true antibiotic, which transformed modern medicine.',
    recognitions: ['Nobel Prize in Physiology or Medicine, shared with Florey and Chain (1945)'],
  },
  {
    slug: 'world-wide-web', subjectType: 'invention', name: 'The World Wide Web', era: '1989–1991', earliestYear: 1989,
    summary: 'Proposed by Tim Berners-Lee in 1989 while at CERN and made publicly available in 1991, combining hypertext with the internet into the Web as broadly understood today.',
    recognitions: [],
  },
  {
    slug: 'the-wheel', subjectType: 'invention', name: 'The Wheel', era: 'c. 3500 BCE', earliestYear: -3500,
    summary: 'One of the most consequential early mechanical inventions, first appearing in Mesopotamia for use in pottery before being adapted for transport.',
    recognitions: [],
  },

  // -- books (and their authors) --
  {
    slug: 'homer-odyssey', subjectType: 'book', name: 'The Odyssey', era: 'c. 8th century BCE', earliestYear: -750,
    summary: "An ancient Greek epic poem traditionally attributed to Homer, following Odysseus's journey home after the Trojan War, and one of the oldest works of Western literature still widely read today.",
    recognitions: [],
  },
  {
    slug: 'shakespeare-hamlet', subjectType: 'book', name: 'Hamlet', era: 'c. 1600', earliestYear: 1600,
    summary: 'A tragedy written by William Shakespeare, widely regarded as one of the most influential works in the English language and among the most-performed plays in history.',
    recognitions: [],
  },
  {
    slug: 'shelley-frankenstein', subjectType: 'book', name: 'Frankenstein', era: '1818', earliestYear: 1818,
    summary: 'A novel by Mary Shelley, written when she was 18, widely considered one of the first true works of science fiction.',
    recognitions: [],
  },
  {
    slug: 'orwell-1984', subjectType: 'book', name: 'Nineteen Eighty-Four', era: '1949', earliestYear: 1949,
    summary: "George Orwell's dystopian novel depicting a totalitarian surveillance state, which introduced terms such as \"Big Brother\" and \"doublethink\" into common usage.",
    recognitions: [],
  },
];

function listHistoricEntries(subjectType = null) {
  if (subjectType !== null && !HISTORIC_SUBJECT_TYPES.includes(subjectType)) {
    throw new Error(`listHistoricEntries: invalid subjectType "${subjectType}" (expected one of ${HISTORIC_SUBJECT_TYPES.join(', ')})`);
  }
  return subjectType ? HISTORIC_REGISTRY.filter((e) => e.subjectType === subjectType) : HISTORIC_REGISTRY;
}

function getHistoricEntry(slug) {
  return HISTORIC_REGISTRY.find((e) => e.slug === slug) || null;
}

// The real bridge into `computeGenuineSignificanceScore()`
// (`lib/valueAlgorithm.js`) for a historic card: `longevityOfImpactYears`
// is computed directly from the register's own `earliestYear`, not
// guessed per mint or per scoring call, so the same slug always scores
// the same real way. `documentedHistoricalImpact` is `true` for every
// entry in this register as a matter of definition — being curated
// into a real, cited historic register *is* documented historical
// impact — rather than a second free-typed claim about the same fact.
function genuineSignificanceInputsFor(slug, options = {}) {
  const { now = Date.now() } = options;
  const entry = getHistoricEntry(slug);
  if (!entry) throw new Error(`genuineSignificanceInputsFor: no historic entry "${slug}" in the register`);

  const currentYear = new Date(now).getFullYear();
  return {
    longevityOfImpactYears: currentYear - entry.earliestYear,
    institutionalRecognitionCount: entry.recognitions.length,
    documentedHistoricalImpact: true,
  };
}

module.exports = {
  HISTORIC_SUBJECT_TYPES,
  HISTORIC_REGISTRY,
  listHistoricEntries,
  getHistoricEntry,
  genuineSignificanceInputsFor,
};
