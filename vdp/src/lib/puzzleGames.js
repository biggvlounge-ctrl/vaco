// VDP -- Puzzle & Casual Games: real procedural generation for sudoku,
// word search, crossword, memory match and trivia, plus the one session
// lifecycle every one of them shares.
//
// Per direct instruction, naming a long list of puzzle/card/board game
// types and an "AI puzzle generator" with difficulty tiers and themes.
// Same "borrow the shape, not the scale" discipline this whole
// directory already applies (see `combatSports.js`'s own header):
// this module builds REAL, working generation for the five puzzle
// types that are genuinely tractable as pure algorithms --
// `crossword`, `word-search`, `sudoku`, `memory-match`, `trivia` --
// and names, rather than fakes, the three the instruction also asked
// for that this pass does not build a generator for yet
// (`UNBUILT_PUZZLE_TYPES`: `hidden-object`, `logic`, `picture-match`).
// `createPuzzle` refuses those with a clear error rather than
// returning something that looks like a puzzle and is not one.
//
// **No generative AI is used or required here, despite the
// instruction's own name for this ("AI puzzle generator").** Crossword
// and word-search layout, sudoku grid generation, and themed word/
// question banks are all solved, deterministic algorithms -- the
// "AI" in the ask is the generation being automatic, not a model call.
// This matters because this session's environment has no image/video/
// voice-generation API key configured at all (checked directly), so
// anything that genuinely needed a model call could not be built for
// real right now -- these five do not need one, so they are built for
// real.
//
// **The crossword generator is real but intentionally simple.** It
// places the longest word first, then greedily places each remaining
// word at the first letter-intersection it can find without a
// conflict. That is a real, working interlocking layout, not every
// word guaranteed a slot the way a full constraint solver would
// manage -- words that cannot be placed are reported, not silently
// dropped and not forced in with a fabricated intersection.
//
// **The sudoku generator does not verify unique solvability.** A
// backtracking filler produces a real, valid, fully-solved grid, and
// difficulty controls how many cells are removed -- but confirming
// the resulting puzzle has exactly one solution is a genuinely hard
// constraint-satisfaction problem on its own, out of scope here, and
// said so rather than silently assumed.
//
// **Themes are an open vocabulary, the same as `combatSportType`.** A
// caller supplies `wordList`/`tiles`/`questions` directly for a custom
// theme ("unlimited custom themes," per the instruction); the built-in
// `THEME_LIBRARY` is a convenience default for a handful of named
// themes, not a closed list.

export const PUZZLE_TYPES = ["sudoku", "word-search", "crossword", "memory-match", "trivia"];

// Named per the instruction, real vocabulary, no generator yet -- see
// the header. `createPuzzle` refuses these explicitly.
export const UNBUILT_PUZZLE_TYPES = ["hidden-object", "logic", "picture-match"];

// Ordered, the same progression-path reasoning `combatSports.js`'s
// `SKILL_LEVELS` already uses.
export const DIFFICULTY_LEVELS = ["beginner", "easy", "medium", "hard", "expert", "master"];

export class PuzzleError extends Error {}

function requireString(value, field, action) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new PuzzleError(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function difficultyIndex(difficulty) {
  const i = DIFFICULTY_LEVELS.indexOf(difficulty);
  if (i < 0) throw new PuzzleError(`difficulty must be one of ${DIFFICULTY_LEVELS.join(", ")}, got "${difficulty}"`);
  return i;
}

// A small, deterministic PRNG (mulberry32) so a seeded puzzle --
// `dailyChallengeFor` -- is reproducible across callers and across
// time, the same real reason VACON-C's own `seeded.js` exists. Not
// cryptographic, and does not need to be: nothing here settles money.
function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------
// THEME_LIBRARY -- a convenience default, never the only path
// ---------------------------------------------------------------------
// Real words and real, correct clues/facts for a handful of named
// themes. Any caller can bypass this entirely with its own
// `wordList`/`questions` -- this exists so a themed puzzle works out
// of the box for the themes actually named in the instruction.
export const THEME_LIBRARY = {
  sports: {
    words: [
      { word: "SOCCER", clue: "The world's most-watched sport, called football outside the US" },
      { word: "TENNIS", clue: "Played with a racquet across a net, scored love-15-30-40" },
      { word: "HOCKEY", clue: "Played on ice with a puck and a stick" },
      { word: "BOXING", clue: "A combat sport decided by punches and rounds" },
      { word: "RUGBY", clue: "A full-contact sport with an oval ball, no forward pass" },
      { word: "GOLF", clue: "Fewest strokes wins, played over 18 holes" },
      { word: "CRICKET", clue: "Bat-and-ball sport with wickets, popular across the Commonwealth" },
      { word: "SWIMMING", clue: "Olympic sport raced in a pool over fixed distances" },
    ],
  },
  movies: {
    words: [
      { word: "DIRECTOR", clue: "The person who oversees a film's creative vision" },
      { word: "SEQUEL", clue: "A follow-up film continuing an earlier story" },
      { word: "TRAILER", clue: "A short preview released before a film's debut" },
      { word: "ANIMATION", clue: "Frame-by-frame art brought to motion" },
      { word: "SCRIPT", clue: "The written dialogue and action a film is shot from" },
      { word: "STUDIO", clue: "The company that finances and produces a film" },
      { word: "PREMIERE", clue: "A film's first public screening" },
      { word: "CASTING", clue: "The process of choosing actors for roles" },
    ],
  },
  science: {
    words: [
      { word: "OXYGEN", clue: "Element with chemical symbol O, essential for breathing" },
      { word: "GRAVITY", clue: "The force that pulls objects toward each other" },
      { word: "ATOM", clue: "The smallest unit of a chemical element" },
      { word: "GALAXY", clue: "A vast system of stars bound by gravity" },
      { word: "ENZYME", clue: "A protein that speeds up a biological reaction" },
      { word: "VOLTAGE", clue: "The electrical potential difference driving current" },
      { word: "FOSSIL", clue: "The preserved remains of an ancient organism" },
      { word: "ORBIT", clue: "The curved path a body takes around another in space" },
    ],
  },
  nature: {
    words: [
      { word: "FOREST", clue: "A large area densely covered in trees" },
      { word: "GLACIER", clue: "A slow-moving mass of compacted ice" },
      { word: "CORAL", clue: "A marine invertebrate that builds reef structures" },
      { word: "DESERT", clue: "An arid region with very little rainfall" },
      { word: "WETLAND", clue: "Land saturated with water, like a marsh or swamp" },
      { word: "CANYON", clue: "A deep gorge carved by a river over time" },
      { word: "TUNDRA", clue: "A cold, treeless biome with permafrost below" },
      { word: "VOLCANO", clue: "A vent in the Earth's crust that can erupt molten rock" },
    ],
  },
  business: {
    words: [
      { word: "REVENUE", clue: "The total income a business earns before expenses" },
      { word: "INVOICE", clue: "A document requesting payment for goods or services" },
      { word: "MERGER", clue: "Two companies combining into one" },
      { word: "EQUITY", clue: "Ownership value remaining after debts are subtracted" },
      { word: "STARTUP", clue: "A newly founded company, usually seeking rapid growth" },
      { word: "LOGISTICS", clue: "The coordination of moving goods from origin to destination" },
      { word: "BRANDING", clue: "Shaping how the public perceives a company or product" },
      { word: "PAYROLL", clue: "The total wages a business owes its employees" },
    ],
  },
  cars: {
    words: [
      { word: "ENGINE", clue: "The component that converts fuel into motion" },
      { word: "CHASSIS", clue: "The structural frame a vehicle is built on" },
      { word: "TURBO", clue: "A forced-induction system that boosts engine power" },
      { word: "SEDAN", clue: "A passenger car body style with four doors and a trunk" },
      { word: "CONVERTIBLE", clue: "A car with a top that folds down or removes" },
      { word: "ODOMETER", clue: "The instrument that measures distance travelled" },
      { word: "SUSPENSION", clue: "The system of springs and dampers smoothing the ride" },
      { word: "HYBRID", clue: "A vehicle combining a combustion engine with an electric motor" },
    ],
  },
  history: {
    words: [
      { word: "EMPIRE", clue: "A large territory ruled by a single sovereign authority" },
      { word: "TREATY", clue: "A formal agreement between nations" },
      { word: "DYNASTY", clue: "A sequence of rulers from the same family" },
      { word: "REVOLUTION", clue: "A fundamental, often sudden change in government or society" },
      { word: "ARTIFACT", clue: "An object of historical or cultural interest made by humans" },
      { word: "COLONY", clue: "A territory under the control of a distant ruling power" },
      { word: "MONARCHY", clue: "A government headed by a king or queen" },
      { word: "ARCHIVE", clue: "A collection of historical documents or records" },
    ],
  },
};

// A small, genuinely true starter trivia bank. Common-knowledge-level
// facts, not contested or obscure ones -- an "unlimited custom
// themes" caller supplies its own `questions` for anything beyond
// this starter set, same discipline as `wordList` above.
export const TRIVIA_LIBRARY = {
  science: [
    { question: "What is the chemical symbol for gold?", answer: "AU" },
    { question: "What is the largest planet in our solar system?", answer: "JUPITER" },
    { question: "How many bones are in the adult human body?", answer: "206" },
    { question: "What gas do plants absorb from the atmosphere for photosynthesis?", answer: "CARBON DIOXIDE" },
    { question: "What is the speed of light in a vacuum, in km/s (rounded)?", answer: "300000" },
  ],
  history: [
    { question: "In what year did World War II end?", answer: "1945" },
    { question: "Who was the first President of the United States?", answer: "GEORGE WASHINGTON" },
    { question: "What ancient wonder stood in the city of Giza?", answer: "GREAT PYRAMID" },
  ],
  sports: [
    { question: "How many players are on a standard soccer team on the field?", answer: "11" },
    { question: "In which sport is the term 'love' used for a zero score?", answer: "TENNIS" },
    { question: "How many rings are on the Olympic flag?", answer: "5" },
  ],
  nature: [
    { question: "What is the largest mammal on Earth?", answer: "BLUE WHALE" },
    { question: "What is the fastest land animal?", answer: "CHEETAH" },
  ],
};

function themeWordList(theme, wordList) {
  if (Array.isArray(wordList) && wordList.length > 0) return wordList;
  const library = THEME_LIBRARY[theme];
  if (!library) {
    throw new PuzzleError(
      `no built-in word list for theme "${theme}" -- supply options.wordList directly `
      + "(custom themes are supported, just not pre-loaded)",
    );
  }
  return library.words;
}

// ---------------------------------------------------------------------
// Sudoku -- real backtracking generation, difficulty controls clue count
// ---------------------------------------------------------------------

const SUDOKU_CLUES_BY_DIFFICULTY = {
  beginner: 48, easy: 42, medium: 34, hard: 28, expert: 24, master: 20,
};

function emptyGrid9() {
  return Array.from({ length: 9 }, () => new Array(9).fill(0));
}

function canPlace(grid, row, col, value) {
  for (let i = 0; i < 9; i += 1) {
    if (grid[row][i] === value) return false;
    if (grid[i][col] === value) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r += 1) {
    for (let c = boxCol; c < boxCol + 3; c += 1) {
      if (grid[r][c] === value) return false;
    }
  }
  return true;
}

function fillSudoku(grid, rng, position = 0) {
  if (position === 81) return true;
  const row = Math.floor(position / 9);
  const col = position % 9;
  const candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  // Shuffle candidates with the seeded RNG so generation is
  // reproducible from a seed, never from `Math.random`.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  for (const value of candidates) {
    if (!canPlace(grid, row, col, value)) continue;
    grid[row][col] = value;
    if (fillSudoku(grid, rng, position + 1)) return true;
    grid[row][col] = 0;
  }
  return false;
}

export function generateSudoku({ difficulty = "medium", seed = null } = {}) {
  difficultyIndex(difficulty);
  const rng = seededRandom(seed === null ? Date.now() ^ Math.floor(Math.random() * 1e9) : hashStringToSeed(String(seed)));
  const solution = emptyGrid9();
  const filled = fillSudoku(solution, rng);
  if (!filled) throw new PuzzleError("generateSudoku: failed to fill a valid grid -- this should not happen");

  const clueCount = SUDOKU_CLUES_BY_DIFFICULTY[difficulty];
  const removeCount = 81 - clueCount;
  const cells = [];
  for (let r = 0; r < 9; r += 1) for (let c = 0; c < 9; c += 1) cells.push([r, c]);
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const puzzleGrid = solution.map((row) => [...row]);
  for (let i = 0; i < removeCount; i += 1) {
    const [r, c] = cells[i];
    puzzleGrid[r][c] = 0;
  }

  return { grid: puzzleGrid, solution, clueCount };
}

export function checkSudokuSolution(attempt, solution) {
  if (!Array.isArray(attempt) || attempt.length !== 9) throw new PuzzleError("checkSudokuSolution requires a 9x9 grid");
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (Number(attempt[r][c]) !== Number(solution[r][c])) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------
// Word search -- real grid placement in up to 8 directions
// ---------------------------------------------------------------------

const WORD_SEARCH_SIZE_BY_DIFFICULTY = {
  beginner: 10, easy: 12, medium: 14, hard: 16, expert: 18, master: 20,
};
const WORD_SEARCH_COUNT_BY_DIFFICULTY = {
  beginner: 5, easy: 6, medium: 8, hard: 10, expert: 12, master: 14,
};
// Only the four "easy to scan" directions at lower tiers; all 8,
// including diagonals and reversed words, once difficulty earns it.
const DIRECTIONS_BY_DIFFICULTY = {
  beginner: [[0, 1], [1, 0]],
  easy: [[0, 1], [1, 0], [0, -1], [-1, 0]],
  medium: [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1]],
  hard: [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]],
  expert: [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]],
  master: [[0, 1], [1, 0], [0, -1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]],
};

export function generateWordSearch({ theme = null, wordList = null, difficulty = "medium", seed = null } = {}) {
  difficultyIndex(difficulty);
  const rng = seededRandom(seed === null ? Date.now() ^ Math.floor(Math.random() * 1e9) : hashStringToSeed(String(seed)));
  const size = WORD_SEARCH_SIZE_BY_DIFFICULTY[difficulty];
  const count = WORD_SEARCH_COUNT_BY_DIFFICULTY[difficulty];
  const directions = DIRECTIONS_BY_DIFFICULTY[difficulty];

  const pool = themeWordList(theme, wordList)
    .map((w) => (typeof w === "string" ? { word: w } : w))
    .map((w) => ({ ...w, word: w.word.toUpperCase().replace(/[^A-Z]/g, "") }))
    .filter((w) => w.word.length > 0 && w.word.length <= size);

  if (pool.length === 0) throw new PuzzleError("generateWordSearch: no usable words fit this grid size");

  // Longest words first -- they are the hardest to place, so give
  // them the whole empty grid rather than whatever is left over.
  const chosen = [...pool].sort((a, b) => b.word.length - a.word.length).slice(0, count);

  const grid = Array.from({ length: size }, () => new Array(size).fill(null));
  const placements = [];

  for (const entry of chosen) {
    const word = entry.word;
    let placed = false;
    const attempts = 200;
    for (let attempt = 0; attempt < attempts && !placed; attempt += 1) {
      const [dr, dc] = directions[Math.floor(rng() * directions.length)];
      const row = Math.floor(rng() * size);
      const col = Math.floor(rng() * size);
      const endRow = row + dr * (word.length - 1);
      const endCol = col + dc * (word.length - 1);
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;

      let fits = true;
      for (let i = 0; i < word.length; i += 1) {
        const r = row + dr * i;
        const c = col + dc * i;
        const existing = grid[r][c];
        if (existing !== null && existing !== word[i]) { fits = false; break; }
      }
      if (!fits) continue;

      for (let i = 0; i < word.length; i += 1) {
        const r = row + dr * i;
        const c = col + dc * i;
        grid[r][c] = word[i];
      }
      placements.push({ word, row, col, dr, dc, clue: entry.clue ?? null });
      placed = true;
    }
    // Not every word is guaranteed a slot -- reported, not forced.
  }

  const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (grid[r][c] === null) grid[r][c] = ALPHABET[Math.floor(rng() * ALPHABET.length)];
    }
  }

  const unplaced = chosen.filter((entry) => !placements.some((p) => p.word === entry.word)).map((entry) => entry.word);
  return { grid, size, placements, words: chosen.map((c) => c.word), unplaced };
}

export function checkWordSearchFind(puzzle, word, row, col, dr, dc) {
  const upper = String(word).toUpperCase();
  const placement = puzzle.placements.find((p) => p.word === upper);
  if (!placement) return false;
  return placement.row === row && placement.col === col && placement.dr === dr && placement.dc === dc;
}

// ---------------------------------------------------------------------
// Crossword -- real but simple greedy interlocking placement
// ---------------------------------------------------------------------

const CROSSWORD_GRID_BY_DIFFICULTY = {
  beginner: 11, easy: 13, medium: 15, hard: 17, expert: 19, master: 21,
};
const CROSSWORD_WORD_COUNT_BY_DIFFICULTY = {
  beginner: 4, easy: 6, medium: 8, hard: 10, expert: 12, master: 14,
};

export function generateCrossword({ theme = null, wordList = null, difficulty = "medium", seed = null } = {}) {
  difficultyIndex(difficulty);
  const rng = seededRandom(seed === null ? Date.now() ^ Math.floor(Math.random() * 1e9) : hashStringToSeed(String(seed)));
  const size = CROSSWORD_GRID_BY_DIFFICULTY[difficulty];
  const count = CROSSWORD_WORD_COUNT_BY_DIFFICULTY[difficulty];

  const pool = themeWordList(theme, wordList)
    .map((w) => (typeof w === "string" ? { word: w, clue: null } : w))
    .map((w) => ({ ...w, word: w.word.toUpperCase().replace(/[^A-Z]/g, "") }))
    .filter((w) => w.word.length > 1 && w.word.length <= size);

  if (pool.length === 0) throw new PuzzleError("generateCrossword: no usable words fit this grid size");

  const chosen = [...pool].sort((a, b) => b.word.length - a.word.length).slice(0, count);
  const grid = Array.from({ length: size }, () => new Array(size).fill(null));
  const entries = [];
  const center = Math.floor(size / 2);

  function canPlaceWord(word, row, col, dir) {
    for (let i = 0; i < word.length; i += 1) {
      const r = dir === "down" ? row + i : row;
      const c = dir === "across" ? col + i : col;
      if (r < 0 || r >= size || c < 0 || c >= size) return false;
      const existing = grid[r][c];
      if (existing !== null && existing !== word[i]) return false;
    }
    return true;
  }

  function placeWord(word, row, col, dir, clue) {
    for (let i = 0; i < word.length; i += 1) {
      const r = dir === "down" ? row + i : row;
      const c = dir === "across" ? col + i : col;
      grid[r][c] = word[i];
    }
    entries.push({ word, row, col, direction: dir, clue });
  }

  // First (longest) word, centered horizontally.
  const first = chosen[0];
  const startCol = Math.max(0, center - Math.floor(first.word.length / 2));
  if (!canPlaceWord(first.word, center, startCol, "across")) {
    throw new PuzzleError("generateCrossword: grid too small for the longest word");
  }
  placeWord(first.word, center, startCol, "across", first.clue);

  const unplaced = [];
  for (let k = 1; k < chosen.length; k += 1) {
    const { word, clue } = chosen[k];
    let placed = false;
    // Try every letter of the new word against every already-placed
    // letter on the grid that matches it, perpendicular to whichever
    // direction the existing word runs.
    for (let li = 0; li < word.length && !placed; li += 1) {
      for (let r = 0; r < size && !placed; r += 1) {
        for (let c = 0; c < size && !placed; c += 1) {
          if (grid[r][c] !== word[li]) continue;
          // Try placing this word DOWN through (r, c) at letter index li,
          // and ACROSS through (r, c) at letter index li -- whichever fits.
          const downRow = r - li;
          if (canPlaceWord(word, downRow, c, "down")) {
            placeWord(word, downRow, c, "down", clue);
            placed = true;
            break;
          }
          const acrossCol = c - li;
          if (canPlaceWord(word, r, acrossCol, "across")) {
            placeWord(word, r, acrossCol, "across", clue);
            placed = true;
            break;
          }
        }
      }
    }
    if (!placed) unplaced.push(word);
  }

  // Number the entries left-to-right, top-to-bottom, by their
  // starting cell -- standard crossword numbering, one number per
  // starting square shared by an across and/or down entry there.
  const starts = new Map();
  for (const entry of [...entries].sort((a, b) => (a.row - b.row) || (a.col - b.col))) {
    const key = `${entry.row},${entry.col}`;
    if (!starts.has(key)) starts.set(key, starts.size + 1);
    entry.number = starts.get(key);
  }

  return { grid, size, entries, unplaced };
}

export function checkCrosswordAnswer(puzzle, number, direction, answer) {
  const entry = puzzle.entries.find((e) => e.number === number && e.direction === direction);
  if (!entry) return false;
  return entry.word === String(answer).toUpperCase().replace(/[^A-Z]/g, "");
}

// ---------------------------------------------------------------------
// Memory match -- real paired-tile shuffle and match checking
// ---------------------------------------------------------------------

const MEMORY_PAIRS_BY_DIFFICULTY = {
  beginner: 6, easy: 8, medium: 10, hard: 12, expert: 15, master: 18,
};

export function generateMemoryMatch({ theme = null, tiles = null, difficulty = "medium", seed = null } = {}) {
  difficultyIndex(difficulty);
  const rng = seededRandom(seed === null ? Date.now() ^ Math.floor(Math.random() * 1e9) : hashStringToSeed(String(seed)));
  const pairCount = MEMORY_PAIRS_BY_DIFFICULTY[difficulty];

  let source;
  if (Array.isArray(tiles) && tiles.length > 0) {
    source = tiles;
  } else {
    const library = THEME_LIBRARY[theme];
    if (!library) {
      throw new PuzzleError(
        `no built-in tile set for theme "${theme}" -- supply options.tiles directly`,
      );
    }
    source = library.words.map((w) => w.word);
  }
  // A built-in theme is a modest starter set, not guaranteed to reach
  // every difficulty's full pair count on its own -- capped to what
  // is actually available, the same honest shortfall `word-search`
  // and `crossword` already allow via their own `unplaced`/truncated
  // results, rather than an error that would otherwise block
  // "master" difficulty on every named theme above.
  const usablePairCount = Math.min(pairCount, source.length);

  const chosen = [...source];
  for (let i = chosen.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [chosen[i], chosen[j]] = [chosen[j], chosen[i]];
  }
  const picked = chosen.slice(0, usablePairCount);
  const board = [];
  picked.forEach((value, pairIndex) => {
    board.push({ value, pairIndex }, { value, pairIndex });
  });
  for (let i = board.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [board[i], board[j]] = [board[j], board[i]];
  }

  return {
    board: board.map((tile, position) => ({ position, value: tile.value, pairIndex: tile.pairIndex })),
    pairCount: usablePairCount,
    requestedPairCount: pairCount,
  };
}

export function checkMemoryMatch(puzzle, positionA, positionB) {
  const a = puzzle.board[positionA];
  const b = puzzle.board[positionB];
  if (!a || !b) throw new PuzzleError("checkMemoryMatch: position out of range");
  if (positionA === positionB) throw new PuzzleError("checkMemoryMatch: cannot flip the same tile twice");
  return a.pairIndex === b.pairIndex;
}

// ---------------------------------------------------------------------
// Trivia -- real themed question bank + session scoring
// ---------------------------------------------------------------------

const TRIVIA_COUNT_BY_DIFFICULTY = {
  beginner: 5, easy: 8, medium: 10, hard: 12, expert: 15, master: 20,
};

export function generateTrivia({ theme = null, questions = null, difficulty = "medium", seed = null } = {}) {
  difficultyIndex(difficulty);
  const rng = seededRandom(seed === null ? Date.now() ^ Math.floor(Math.random() * 1e9) : hashStringToSeed(String(seed)));
  const requested = TRIVIA_COUNT_BY_DIFFICULTY[difficulty];

  const pool = Array.isArray(questions) && questions.length > 0 ? questions : TRIVIA_LIBRARY[theme];
  if (!pool) {
    throw new PuzzleError(
      `no built-in trivia for theme "${theme}" -- supply options.questions directly`,
    );
  }

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  // Repeats rather than truncates if the bank is smaller than the
  // requested count -- a themed bank this small genuinely cannot fill
  // "master" difficulty's 20 questions without reuse, and reuse is
  // the honest answer, not a shorter round silently substituted.
  const selected = [];
  for (let i = 0; i < requested; i += 1) selected.push(shuffled[i % shuffled.length]);

  return {
    questions: selected.map((q) => ({ question: q.question, answer: q.answer })),
  };
}

export function checkTriviaAnswer(puzzle, questionIndex, answer) {
  const q = puzzle.questions[questionIndex];
  if (!q) throw new PuzzleError("checkTriviaAnswer: questionIndex out of range");
  return String(answer).trim().toUpperCase() === String(q.answer).trim().toUpperCase();
}

// ---------------------------------------------------------------------
// The one session lifecycle every puzzle type shares
// ---------------------------------------------------------------------

const GENERATORS = {
  sudoku: generateSudoku,
  "word-search": generateWordSearch,
  crossword: generateCrossword,
  "memory-match": generateMemoryMatch,
  trivia: generateTrivia,
};

// Points scale with difficulty, the real reason a "master" sudoku is
// worth more on a leaderboard than a "beginner" one -- not an
// invented bonus, just the one number every puzzle type can report
// without this module pretending to know how fast anyone solved it
// (speed-based scoring, if wanted, is the caller's own clock).
const POINTS_BY_DIFFICULTY = {
  beginner: 10, easy: 20, medium: 35, hard: 55, expert: 80, master: 120,
};

export function createPuzzle(options = {}) {
  const a = "createPuzzle";
  const { puzzleId, puzzleType, difficulty = "medium", theme = null } = options;
  const id = requireString(puzzleId, "puzzleId", a);

  if (UNBUILT_PUZZLE_TYPES.includes(puzzleType)) {
    throw new PuzzleError(
      `${a}: "${puzzleType}" is a real, named puzzle type with no generator built yet -- see this `
      + "module's own header. Not faked as a working puzzle.",
    );
  }
  const generator = GENERATORS[puzzleType];
  if (!generator) {
    throw new PuzzleError(`${a}: puzzleType must be one of ${PUZZLE_TYPES.join(", ")}, got "${puzzleType}"`);
  }

  const content = generator(options);
  return {
    puzzleId: id,
    puzzleType,
    difficulty,
    theme,
    status: "active",
    createdAt: options.createdAt ?? null,
    content,
  };
}

// A date-seeded puzzle, the same instance for every player on that
// date -- real determinism from the date string, not a random pick
// that happens to look daily. "Weekly Championships"/"Daily
// Challenges" per the instruction read from this.
export function dailyChallengeFor(dateString, options = {}) {
  requireString(dateString, "dateString", "dailyChallengeFor");
  return createPuzzle({
    ...options,
    puzzleId: `daily-${options.puzzleType}-${dateString}`,
    seed: dateString,
    createdAt: dateString,
  });
}

export function markSolved(puzzle) {
  if (puzzle.status === "solved") throw new PuzzleError("markSolved: already solved");
  puzzle.status = "solved";
  return puzzle;
}

// The one real number a leaderboard needs -- feed straight into
// `rankings.js`'s `rankBy` as `{ id: playerId, value: scoreFor(...) }`.
export function scoreFor(puzzle) {
  return POINTS_BY_DIFFICULTY[puzzle.difficulty] ?? 0;
}

// Strips solution data a player should not see while solving --
// `solution` (sudoku), `placements`/full letter grid reveal (word
// search keeps its letter grid, since finding words IS the puzzle,
// but drops nothing else), the crossword answer key, and the trivia
// answers.
export function playerView(puzzle) {
  const { content, ...rest } = puzzle;
  switch (puzzle.puzzleType) {
    case "sudoku":
      return { ...rest, content: { grid: content.grid, clueCount: content.clueCount } };
    case "word-search":
      return { ...rest, content: { grid: content.grid, size: content.size, words: content.words } };
    case "crossword":
      return {
        ...rest,
        content: {
          size: content.size,
          clues: content.entries.map((e) => ({ number: e.number, direction: e.direction, clue: e.clue, length: e.word.length })),
        },
      };
    case "memory-match":
      return { ...rest, content: { board: content.board.map((t) => ({ position: t.position })), pairCount: content.pairCount } };
    case "trivia":
      return { ...rest, content: { questions: content.questions.map((q) => ({ question: q.question })) } };
    default:
      return puzzle;
  }
}

export function describePuzzle(puzzle) {
  return {
    puzzleId: puzzle.puzzleId,
    puzzleType: puzzle.puzzleType,
    difficulty: puzzle.difficulty,
    theme: puzzle.theme,
    status: puzzle.status,
    points: scoreFor(puzzle),
  };
}
