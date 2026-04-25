export const APP_MOTION = {
  durations: {
    fast: "120ms",
    standard: "150ms",
    slow: "200ms",
  },
  easing: {
    standard: "ease",
  },
} as const;

export const APP_TRANSITIONS = {
  backgroundFast: `background ${APP_MOTION.durations.fast} ${APP_MOTION.easing.standard}`,
  backgroundStandard: `background ${APP_MOTION.durations.standard} ${APP_MOTION.easing.standard}`,
  borderAndShadowStandard: `border-color ${APP_MOTION.durations.standard} ${APP_MOTION.easing.standard}, box-shadow ${APP_MOTION.durations.standard} ${APP_MOTION.easing.standard}`,
  transformStandard: `transform ${APP_MOTION.durations.standard} ${APP_MOTION.easing.standard}`,
} as const;

