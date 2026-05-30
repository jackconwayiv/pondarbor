function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? singular : pluralForm;
}

/** Relative elapsed time for “Last saved” (seconds/minutes when recent). */
function formatRecentElapsedAgo(totalSeconds: number): string {
  if (totalSeconds < 60) {
    return `${totalSeconds} ${plural(totalSeconds, "second")} ago`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (totalSeconds < 3600) {
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

/** Human-readable “Last saved” line — e.g. `11:53 AM · 05/30 · 1 second ago`. */
export function formatLastSaved(savedAtMs: number, nowMs = Date.now()): string {
  if (!Number.isFinite(savedAtMs) || savedAtMs <= 0) {
    return "Not saved yet";
  }

  const savedAt = new Date(savedAtMs);
  const time = savedAt.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const month = String(savedAt.getMonth() + 1).padStart(2, "0");
  const day = String(savedAt.getDate()).padStart(2, "0");
  const totalSeconds = Math.floor(Math.max(0, nowMs - savedAtMs) / 1000);
  const ago =
    totalSeconds < 1
      ? "just now"
      : formatRecentElapsedAgo(totalSeconds);

  return `${time} · ${month}/${day} · ${ago}`;
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
