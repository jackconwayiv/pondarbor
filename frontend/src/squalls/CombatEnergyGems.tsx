import { Box, HStack } from "@chakra-ui/react";

const GEM_SIZE = "1.375rem";
const GEM_FILLED = {
  bg: "linear-gradient(145deg, #FDE68A 0%, #FBBF24 45%, #D97706 100%)",
  borderColor: "#B45309",
  boxShadow: "0 0 6px rgba(251, 191, 36, 0.55), inset 0 1px 2px rgba(255,255,255,0.45)",
};
const GEM_EMPTY = {
  bg: "rgba(55, 65, 81, 0.35)",
  borderColor: "#9CA3AF",
  boxShadow: "inset 0 1px 3px rgba(0,0,0,0.35)",
};

type Props = {
  energy: number;
  maxEnergy: number;
};

function EnergyGem({ filled }: { filled: boolean }) {
  const style = filled ? GEM_FILLED : GEM_EMPTY;
  return (
    <Box
      w={GEM_SIZE}
      h={GEM_SIZE}
      flexShrink={0}
      transform="rotate(45deg)"
      borderRadius="sm"
      borderWidth="2px"
      borderStyle={filled ? "solid" : "solid"}
      bg={style.bg}
      borderColor={style.borderColor}
      boxShadow={style.boxShadow}
      aria-hidden
    />
  );
}

/** Combat HUD: yellow gems for remaining energy, gray sockets for spent. */
export default function CombatEnergyGems({ energy, maxEnergy }: Props) {
  const slots = Math.max(0, maxEnergy);
  const remaining = Math.max(0, Math.min(energy, slots));

  return (
    <HStack
      gap={2}
      align="center"
      flexShrink={0}
      aria-label={`${remaining} of ${slots} energy remaining`}
    >
      {Array.from({ length: slots }, (_, index) => (
        <EnergyGem key={index} filled={index < remaining} />
      ))}
    </HStack>
  );
}
