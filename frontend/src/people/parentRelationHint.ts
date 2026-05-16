import { shouldLinkAsTreeParent } from "./parentSync";

export function parentRelationHintText(
  relationCore: string,
  prefixTokens: string[],
  suffixTokens: string[],
): string {
  const role = relationCore === "mother" ? "mother" : "father";
  if (shouldLinkAsTreeParent(relationCore, prefixTokens, suffixTokens)) {
    return (
      `Saving links them as your tree ${role} (My parents on your card) and draws a solid line on the tree. ` +
      `To add their parents (your grandparents), edit this person after saving.`
    );
  }
  if (suffixTokens.includes("in_law")) {
    return (
      `Saving labels them as your ${role} in-law only — not your tree parent. ` +
      `Set your biological parents under Edit on your own card. Link partners or their parents after saving if you want more tree lines.`
    );
  }
  if (prefixTokens.includes("step")) {
    return (
      `Saving labels them as your step-${role}. A dashed line appears if you also set them under ` +
      `My step-parents on your card (or they are your step-${role} in Relation to me). ` +
      `Biological ${role} stays under My parents (solid line).`
    );
  }
  return (
    `Saving labels how you relate to them; they are not auto-linked as your tree ${role}. ` +
    `Pick tree parents under Edit on your own card, or add guardian / partner links after saving.`
  );
}
