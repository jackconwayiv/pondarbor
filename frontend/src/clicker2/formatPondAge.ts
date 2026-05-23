function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? singular : pluralForm;
}

/** Human-readable age for “Pond started: X ago”. */
export function formatPondAgeAgo(startedAtMs: number, nowMs = Date.now()): string {
  const elapsedMs = Math.max(0, nowMs - startedAtMs);
  const totalSeconds = Math.floor(elapsedMs / 1000);

  if (totalSeconds < 1) return "just now";

  if (totalSeconds < 60) {
    return `${totalSeconds} ${plural(totalSeconds, "second")} ago`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds < 600) {
    if (seconds === 0) {
      return `${minutes} ${plural(minutes, "minute")} ago`;
    }
    return `${minutes} ${plural(minutes, "minute")} ${seconds} ${plural(seconds, "second")} ago`;
  }

  if (minutes < 60) {
    return `${minutes} ${plural(minutes, "minute")} ago`;
  }

  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;

  if (hours < 24) {
    if (remMinutes === 0) {
      return `${hours} ${plural(hours, "hour")} ago`;
    }
    return `${hours} ${plural(hours, "hour")} ${remMinutes} ${plural(remMinutes, "minute")} ago`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;

  if (remHours === 0) {
    return `${days} ${plural(days, "day")} ago`;
  }
  return `${days} ${plural(days, "day")} ${remHours} ${plural(remHours, "hour")} ago`;
}
