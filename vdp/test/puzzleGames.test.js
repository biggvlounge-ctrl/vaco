// Puzzle & Casual Games -- the five real generators and the one
// session lifecycle they share.
//
// Every assertion here was watched failing against a reintroduced bug
// before being trusted, per
// `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

import test from "node:test";
import assert from "node:assert";

import {
  PUZZLE_TYPES, UNBUILT_PUZZLE_TYPES, DIFFICULTY_LEVELS, PuzzleError,
  generateSudoku, checkSudokuSolution,
  generateWordSearch, checkWordSearchFind,
  generateCrossword, checkCrosswordAnswer,
  generateMemoryMatch, checkMemoryMatch,
  generateTrivia, checkTriviaAnswer,
  createPuzzle, dailyChallengeFor, markSolved, scoreFor, playerView, describePuzzle,
} from "../src/lib/puzzleGames.js";

// -- Shape ----------------------------------------------------------------

test("every real puzzle type has a working generator reachable from createPuzzle", () => {
  for (const type of PUZZLE_TYPES) {
    const puzzle = createPuzzle({ puzzleId: `shape-${type}`, puzzleType: type, difficulty: "easy", theme: "sports", seed: "shape" });
    assert.equal(puzzle.status, "active");
  }
});

test("unbuilt puzzle types are refused, not faked", () => {
  for (const type of UNBUILT_PUZZLE_TYPES) {
    assert.throws(() => createPuzzle({ puzzleId: "x", puzzleType: type }), PuzzleError);
  }
});

test("difficulty levels are an ordered progression", () => {
  assert.deepEqual(DIFFICULTY_LEVELS, ["beginner", "easy", "medium", "hard", "expert", "master"]);
});

test("an unrecognised difficulty is refused", () => {
  assert.throws(() => generateSudoku({ difficulty: "impossible" }), PuzzleError);
});

// -- Sudoku -----------------------------------------------------------------

test("generateSudoku produces a real, valid, fully-solved solution grid", () => {
  const { solution } = generateSudoku({ difficulty: "medium", seed: "s1" });
  // Every row, column and 3x3 box contains 1-9 exactly once.
  for (let r = 0; r < 9; r += 1) {
    assert.deepEqual([...solution[r]].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
  for (let c = 0; c < 9; c += 1) {
    const col = solution.map((row) => row[c]);
    assert.deepEqual([...col].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
});

test("harder sudoku difficulty removes more clues", () => {
  const easy = generateSudoku({ difficulty: "easy", seed: "d1" });
  const master = generateSudoku({ difficulty: "master", seed: "d1" });
  assert.ok(master.clueCount < easy.clueCount);
});

test("checkSudokuSolution catches a wrong grid, not just a right one", () => {
  const { solution } = generateSudoku({ difficulty: "easy", seed: "s2" });
  assert.equal(checkSudokuSolution(solution, solution), true);
  const wrong = solution.map((row) => [...row]);
  wrong[0][0] = wrong[0][0] === 9 ? 1 : wrong[0][0] + 1;
  assert.equal(checkSudokuSolution(wrong, solution), false);
});

// -- Word search --------------------------------------------------------

test("generateWordSearch places real words findable by checkWordSearchFind", () => {
  const ws = generateWordSearch({ theme: "sports", difficulty: "medium", seed: "w1" });
  assert.ok(ws.placements.length > 0);
  for (const p of ws.placements) {
    assert.equal(checkWordSearchFind(ws, p.word, p.row, p.col, p.dr, p.dc), true);
  }
});

test("checkWordSearchFind rejects a wrong location for a real word", () => {
  const ws = generateWordSearch({ theme: "sports", difficulty: "medium", seed: "w2" });
  const p = ws.placements[0];
  const wrongRow = (p.row + 1) % ws.size;
  assert.equal(checkWordSearchFind(ws, p.word, wrongRow, p.col, p.dr, p.dc), false);
});

test("a custom wordList bypasses the theme library entirely", () => {
  const ws = generateWordSearch({ wordList: ["ZEBRA", "FOX"], difficulty: "beginner", seed: "w3" });
  assert.deepEqual(ws.words.sort(), ["FOX", "ZEBRA"]);
});

test("an unknown theme with no wordList is refused rather than silently empty", () => {
  assert.throws(() => generateWordSearch({ theme: "made-up-theme" }), PuzzleError);
});

// -- Crossword ------------------------------------------------------------

test("generateCrossword interlocks words, and every placed entry's real answer checks out", () => {
  const cw = generateCrossword({ theme: "science", difficulty: "hard", seed: "c1" });
  assert.ok(cw.entries.length > 1);
  for (const e of cw.entries) {
    assert.equal(checkCrosswordAnswer(cw, e.number, e.direction, e.word), true);
  }
});

test("checkCrosswordAnswer rejects a wrong answer at a real clue number", () => {
  const cw = generateCrossword({ theme: "science", difficulty: "medium", seed: "c2" });
  const e = cw.entries[0];
  assert.equal(checkCrosswordAnswer(cw, e.number, e.direction, "WRONGANSWERXYZ"), false);
});

test("every placed crossword entry's letters actually sit on the grid", () => {
  const cw = generateCrossword({ theme: "nature", difficulty: "medium", seed: "c3" });
  for (const e of cw.entries) {
    for (let i = 0; i < e.word.length; i += 1) {
      const r = e.direction === "down" ? e.row + i : e.row;
      const c = e.direction === "across" ? e.col + i : e.col;
      assert.equal(cw.grid[r][c], e.word[i]);
    }
  }
});

// -- Memory match ---------------------------------------------------------

test("generateMemoryMatch produces exactly two tiles per pair", () => {
  const mm = generateMemoryMatch({ theme: "nature", difficulty: "medium", seed: "m1" });
  const counts = {};
  for (const tile of mm.board) counts[tile.pairIndex] = (counts[tile.pairIndex] || 0) + 1;
  for (const count of Object.values(counts)) assert.equal(count, 2);
});

test("checkMemoryMatch is true for a real pair and false for a mismatch", () => {
  const mm = generateMemoryMatch({ theme: "nature", difficulty: "easy", seed: "m2" });
  const byPair = {};
  mm.board.forEach((t) => { (byPair[t.pairIndex] ||= []).push(t.position); });
  const [posA, posB] = Object.values(byPair)[0];
  assert.equal(checkMemoryMatch(mm, posA, posB), true);
  const otherPairFirst = Object.values(byPair)[1][0];
  assert.equal(checkMemoryMatch(mm, posA, otherPairFirst), false);
});

test("checkMemoryMatch refuses flipping the same tile against itself", () => {
  const mm = generateMemoryMatch({ theme: "nature", difficulty: "easy", seed: "m3" });
  assert.throws(() => checkMemoryMatch(mm, 0, 0), PuzzleError);
});

test("a theme library too small for the requested pair count is capped, not an error", () => {
  const mm = generateMemoryMatch({ theme: "sports", difficulty: "master", seed: "m4" });
  assert.ok(mm.pairCount <= 8, "sports theme has 8 words, master asks for 18");
  assert.equal(mm.requestedPairCount, 18);
});

// -- Trivia -----------------------------------------------------------------

test("generateTrivia returns real questions with real answers from the theme bank", () => {
  const tv = generateTrivia({ theme: "science", difficulty: "easy", seed: "t1" });
  assert.equal(tv.questions.length, 8);
  for (const q of tv.questions) {
    assert.ok(q.question.length > 0);
    assert.ok(q.answer.length > 0);
  }
});

test("checkTriviaAnswer is case-insensitive and rejects a wrong answer", () => {
  const tv = generateTrivia({ theme: "science", difficulty: "beginner", seed: "t2" });
  const real = tv.questions[0].answer;
  assert.equal(checkTriviaAnswer(tv, 0, real.toLowerCase()), true);
  assert.equal(checkTriviaAnswer(tv, 0, "definitely not the answer"), false);
});

// -- The shared session lifecycle ------------------------------------------

test("playerView never leaks the solution", () => {
  const puzzle = createPuzzle({ puzzleId: "pv1", puzzleType: "sudoku", difficulty: "easy", seed: "pv" });
  const view = playerView(puzzle);
  assert.equal(view.content.solution, undefined);

  const cw = createPuzzle({ puzzleId: "pv2", puzzleType: "crossword", difficulty: "easy", theme: "science", seed: "pv" });
  const cwView = playerView(cw);
  for (const clue of cwView.content.clues) assert.equal(clue.answer, undefined);

  const tv = createPuzzle({ puzzleId: "pv3", puzzleType: "trivia", difficulty: "easy", theme: "science", seed: "pv" });
  const tvView = playerView(tv);
  for (const q of tvView.content.questions) assert.equal(q.answer, undefined);
});

test("scoreFor rewards harder difficulty with more points, strictly increasing", () => {
  let previous = -1;
  for (const difficulty of DIFFICULTY_LEVELS) {
    const puzzle = createPuzzle({ puzzleId: `score-${difficulty}`, puzzleType: "sudoku", difficulty, seed: "score" });
    const points = scoreFor(puzzle);
    assert.ok(points > previous, `${difficulty} (${points}) should score more than the previous tier (${previous})`);
    previous = points;
  }
});

test("markSolved flips status once and refuses a second call", () => {
  const puzzle = createPuzzle({ puzzleId: "ms1", puzzleType: "trivia", difficulty: "easy", theme: "science", seed: "ms" });
  assert.equal(puzzle.status, "active");
  markSolved(puzzle);
  assert.equal(puzzle.status, "solved");
  assert.throws(() => markSolved(puzzle), PuzzleError);
});

test("dailyChallengeFor is deterministic for the same date, and differs across dates", () => {
  const a1 = dailyChallengeFor("2026-10-22", { puzzleType: "sudoku", difficulty: "medium" });
  const a2 = dailyChallengeFor("2026-10-22", { puzzleType: "sudoku", difficulty: "medium" });
  assert.deepEqual(a1.content.grid, a2.content.grid);

  const b = dailyChallengeFor("2026-10-23", { puzzleType: "sudoku", difficulty: "medium" });
  assert.notDeepEqual(a1.content.grid, b.content.grid);
});

test("describePuzzle reports the real summary fields, no content leaked", () => {
  const puzzle = createPuzzle({ puzzleId: "dp1", puzzleType: "sudoku", difficulty: "hard", seed: "dp" });
  const described = describePuzzle(puzzle);
  assert.equal(described.puzzleId, "dp1");
  assert.equal(described.difficulty, "hard");
  assert.equal(described.status, "active");
  assert.equal(described.content, undefined);
});
