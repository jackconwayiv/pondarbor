/** Adaptive font size for vote option text inside square tiles. */
export function voteOptionFontSize(answer: string): string {
  const len = answer.length;
  if (len <= 20) return "clamp(0.78rem, 2.75vw, 1rem)";
  if (len <= 40) return "clamp(0.7rem, 2.4vw, 0.92rem)";
  if (len <= 60) return "clamp(0.62rem, 2vw, 0.85rem)";
  return "clamp(0.55rem, 1.8vw, 0.78rem)";
}
