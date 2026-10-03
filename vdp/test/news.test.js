import test from "node:test";
import assert from "node:assert/strict";
import { createNewsLog, recordEvent, listNews, MAX_NEWS_EVENTS } from "../src/lib/news.js";

test("recordEvent requires a kind and text", () => {
  const log = createNewsLog();
  assert.throws(() => recordEvent(log, { text: "hi" }), /kind/);
  assert.throws(() => recordEvent(log, { kind: "job" }), /text/);
});

test("recordEvent assigns increasing ids and listNews returns newest first", () => {
  const log = createNewsLog();
  recordEvent(log, { kind: "job", text: "a clocked out", at: 1 });
  recordEvent(log, { kind: "property", text: "b bought a home", at: 2 });
  recordEvent(log, { kind: "library", text: "c read a book", at: 3 });

  const news = listNews(log);
  assert.deepEqual(news.map((e) => e.text), [
    "c read a book",
    "b bought a home",
    "a clocked out",
  ]);
  assert.deepEqual(news.map((e) => e.id), [3, 2, 1]);
});

test("listNews respects limit", () => {
  const log = createNewsLog();
  for (let i = 0; i < 10; i++) recordEvent(log, { kind: "chat", text: `msg ${i}` });
  assert.equal(listNews(log, 3).length, 3);
  assert.deepEqual(listNews(log, 3).map((e) => e.text), ["msg 9", "msg 8", "msg 7"]);
});

test("the log is capped at MAX_NEWS_EVENTS, oldest dropped first", () => {
  const log = createNewsLog();
  for (let i = 0; i < MAX_NEWS_EVENTS + 5; i++) {
    recordEvent(log, { kind: "chat", text: `msg ${i}` });
  }
  assert.equal(log.events.length, MAX_NEWS_EVENTS);
  assert.equal(log.events[0].text, "msg 5");
  assert.equal(log.events[log.events.length - 1].text, `msg ${MAX_NEWS_EVENTS + 4}`);
});
