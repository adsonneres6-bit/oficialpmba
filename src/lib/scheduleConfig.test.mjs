import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveScheduleGenerationConfig,
  subjectsPerDayForSchedule,
} from "./scheduleConfig.js";

const defaults = {
  subjectsPerDay: "2",
  dailyStudyMinutes: "180",
  questionMinutes: "30",
  mode: "peso",
  topicLimits: {},
};

test("generation uses the saved configuration when called by a click handler", () => {
  const saved = { ...defaults, subjectsPerDay: "3" };
  const clickEvent = { type: "click", target: {}, currentTarget: {} };
  const config = resolveScheduleGenerationConfig(clickEvent, saved, defaults);

  assert.equal(subjectsPerDayForSchedule(config), 3);
  assert.equal(config.dailyStudyMinutes, "180");
});

for (const subjectCount of [2, 3, 4]) {
  test(`the resolved ${subjectCount}-subject setting applies to all 12 cycles`, () => {
    const saved = { ...defaults, subjectsPerDay: String(subjectCount) };
    const config = resolveScheduleGenerationConfig(undefined, saved, defaults);
    const cycleCounts = Array.from({ length: 12 }, () =>
      subjectsPerDayForSchedule(config),
    );

    assert.deepEqual(cycleCounts, Array(12).fill(subjectCount));
  });
}

test("an explicit generation config overrides the current saved config", () => {
  const config = resolveScheduleGenerationConfig(
    { subjectsPerDay: "4", mode: "manual" },
    { ...defaults, subjectsPerDay: "2" },
    defaults,
  );

  assert.equal(config.subjectsPerDay, "4");
  assert.equal(config.mode, "manual");
  assert.equal(config.dailyStudyMinutes, defaults.dailyStudyMinutes);
});
