import assert from "node:assert/strict";
import { it } from "node:test";
import { createCalendar } from "./calendar";

it("escapes text and folds UTF-8 lines while preserving the event instant", () => {
  const title = "Reading, notes;\n" + "📚".repeat(40);
  const { googleUrl, ics } = createCalendar({
    id: "session-1",
    title,
    start: new Date("2026-09-18T19:00:00-04:00"),
    description: "one\r\ntwo",
  });
  assert.equal(new URL(googleUrl).searchParams.get("text"), title);
  assert.equal(
    new URL(googleUrl).searchParams.get("dates"),
    "20260918T230000Z/20260919T000000Z",
  );
  for (const line of ics.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  const unfolded = ics.replace(/\r\n /g, "");
  assert.ok(
    unfolded.includes("SUMMARY:Reading\\, notes\\;\\n" + "📚".repeat(40)),
  );
  assert.ok(unfolded.includes("DESCRIPTION:one\\ntwo\r\n"));
  assert.ok(unfolded.includes("UID:session-1@seminar-manager\r\n"));
  assert.ok(unfolded.includes("DTEND:20260919T000000Z\r\n"));
});
