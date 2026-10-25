// VOKEN — the real historic register: historic places, people
// (inventors, authors, notable historical figures), inventions, and
// books, each a mintable Cvltvre Card subject in its own right.
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

const HISTORIC_SUBJECT_TYPES = ['place', 'person', 'invention', 'book'];

const HISTORIC_REGISTRY = [
  // -- places --
  {
    slug: 'great-wall-of-china', subjectType: 'place', name: 'The Great Wall of China', era: '7th century BCE – 17th century CE',
    summary: 'A series of fortifications built across northern China by successive dynasties, most famously extended and reinforced during the Ming dynasty (1368–1644) to defend against northern invasions.',
  },
  {
    slug: 'machu-picchu', subjectType: 'place', name: 'Machu Picchu', era: 'c. 1450 CE',
    summary: 'A 15th-century Inca citadel set high in the Andes Mountains of Peru, built during the reign of Pachacuti and brought to wider international attention in 1911 by Hiram Bingham.',
  },
  {
    slug: 'library-of-alexandria', subjectType: 'place', name: 'The Library of Alexandria', era: 'c. 3rd century BCE – 4th century CE',
    summary: 'One of the largest and most significant libraries of the ancient world, founded in Alexandria, Egypt under the Ptolemaic dynasty and a major center of scholarship until its gradual decline.',
  },
  {
    slug: 'pompeii', subjectType: 'place', name: 'Pompeii', era: '79 CE',
    summary: 'A Roman city near modern Naples, Italy, buried and preserved under volcanic ash after the eruption of Mount Vesuvius in 79 CE, and rediscovered in the 18th century.',
  },

  // -- people (inventors, authors, notable historical figures) --
  {
    slug: 'johannes-gutenberg', subjectType: 'person', name: 'Johannes Gutenberg', era: 'c. 1400–1468',
    summary: 'German craftsman credited with introducing movable-type printing to Europe around 1440, enabling the mass production of books, starting with the Gutenberg Bible.',
  },
  {
    slug: 'nikola-tesla', subjectType: 'person', name: 'Nikola Tesla', era: '1856–1943',
    summary: 'Serbian-American inventor and engineer known for his contributions to the design of the modern alternating-current (AC) electrical supply system.',
  },
  {
    slug: 'marie-curie', subjectType: 'person', name: 'Marie Curie', era: '1867–1934',
    summary: 'Physicist and chemist who discovered the elements polonium and radium, and the first person to win Nobel Prizes in two different sciences (Physics, 1903; Chemistry, 1911).',
  },
  {
    slug: 'hedy-lamarr', subjectType: 'person', name: 'Hedy Lamarr', era: '1914–2000',
    summary: 'Austrian-American actress and inventor who co-invented a frequency-hopping spread-spectrum communication technique during WWII that later underpinned technologies such as Wi-Fi and Bluetooth.',
  },

  // -- inventions --
  {
    slug: 'printing-press', subjectType: 'invention', name: 'The Printing Press', era: 'c. 1440',
    summary: "Johannes Gutenberg's movable-type printing press made books dramatically faster and cheaper to produce, and is widely credited with accelerating the spread of literacy and ideas across Europe.",
  },
  {
    slug: 'telephone', subjectType: 'invention', name: 'The Telephone', era: '1876',
    summary: 'Alexander Graham Bell was awarded the first US patent for a device transmitting speech electrically — a genuinely disputed historical claim, since Elisha Gray filed a competing claim the same day.',
  },
  {
    slug: 'penicillin', subjectType: 'invention', name: 'Penicillin', era: '1928',
    summary: 'Discovered by Alexander Fleming when he noticed a mold accidentally contaminating a bacterial culture was killing the bacteria around it — the first true antibiotic, which transformed modern medicine.',
  },

  // -- books (and their authors) --
  {
    slug: 'shakespeare-hamlet', subjectType: 'book', name: 'Hamlet', era: 'c. 1600',
    summary: 'A tragedy written by William Shakespeare, widely regarded as one of the most influential works in the English language and among the most-performed plays in history.',
  },
  {
    slug: 'shelley-frankenstein', subjectType: 'book', name: 'Frankenstein', era: '1818',
    summary: 'A novel by Mary Shelley, written when she was 18, widely considered one of the first true works of science fiction.',
  },
  {
    slug: 'orwell-1984', subjectType: 'book', name: 'Nineteen Eighty-Four', era: '1949',
    summary: "George Orwell's dystopian novel depicting a totalitarian surveillance state, which introduced terms such as \"Big Brother\" and \"doublethink\" into common usage.",
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

module.exports = {
  HISTORIC_SUBJECT_TYPES,
  HISTORIC_REGISTRY,
  listHistoricEntries,
  getHistoricEntry,
};
