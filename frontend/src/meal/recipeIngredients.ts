/** Split textarea lines into ingredient rows for recipe create/patch. */
export function linesToIngredients(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((raw_line) => ({ raw_line }));
}
