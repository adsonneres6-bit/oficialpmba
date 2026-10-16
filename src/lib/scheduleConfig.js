const SCHEDULE_CONFIG_KEYS = [
  "subjectsPerDay",
  "dailyStudyMinutes",
  "questionMinutes",
  "mode",
  "topicLimits",
];

export function resolveScheduleGenerationConfig(
  configOverride,
  currentConfig,
  defaultConfig,
) {
  const hasConfigFields =
    configOverride &&
    typeof configOverride === "object" &&
    SCHEDULE_CONFIG_KEYS.some((key) => key in configOverride);
  return {
    ...defaultConfig,
    ...(currentConfig || {}),
    ...(hasConfigFields ? configOverride : {}),
  };
}

export function subjectsPerDayForSchedule(config) {
  return Math.max(1, Number(config?.subjectsPerDay) || 2);
}
