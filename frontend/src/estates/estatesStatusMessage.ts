/**
 * Rewrites server status lines that use the winner's display name so the
 * current player sees "You" / "you" instead of their own username.
 */
export function personalizeEstatesStatusMessage(
  message: string,
  myDisplayName: string | undefined,
): string {
  const name = myDisplayName?.trim();
  if (!message || !name) return message;

  if (message.startsWith(`Waiting for ${name} `)) {
    return `Waiting for you${message.slice(`Waiting for ${name}`.length)}`;
  }

  if (!message.startsWith(`${name} `)) return message;
  const rest = message.slice(name.length + 1);

  if (rest.startsWith("wins the Throne and wins the game!")) {
    return "You won the Throne and won the game!";
  }
  if (rest.startsWith("wins the Throne and gains 1 point.")) {
    return "You won the Throne and gained 1 point.";
  }
  if (rest.startsWith("wins Road and will draw 2 extra cards next round.")) {
    return "You won Road and will draw 2 extra cards next round.";
  }
  if (rest.startsWith("wins ")) {
    return `You won ${rest.slice(5)}`;
  }
  if (rest.startsWith("applies ")) {
    return `You applied ${rest.slice(8)}`;
  }
  if (rest.startsWith("permanently upgrades ")) {
    return `You permanently upgraded ${rest.slice(21)}`;
  }
  if (rest.startsWith("keeps their hand (Tower)")) {
    return "You keep your hand (Tower) and will go second next round.";
  }
  if (rest.startsWith("discards ")) {
    return `You discard ${rest.slice(9)}`;
  }
  if (rest.startsWith("will go ")) {
    return `You ${rest}`;
  }

  return `You ${rest}`;
}
