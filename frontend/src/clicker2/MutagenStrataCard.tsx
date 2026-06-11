import { Box, Flex } from "@chakra-ui/react";

import { MUTAGEN_WARM_GRADIENT } from "./clicker2ShopUi";
import { FOSSIL_SHOP_CARD_GRADIENT } from "./specialtyTierColors";
import MutagenPanel from "./MutagenPanel";
import { isMutagenSystemUnlocked } from "./mutagens";
import StrataProgressRow from "./StrataProgressRow";
import { isStratumSystemUnlocked } from "./strata";

export default function MutagenStrataCard({
  allTimeEnergyEarned,
  pondEra,
  unfossilizedStrata,
  fossils,
  onCycleClick,
  mutagensBank,
  mutagenFormingStartedAtMs,
  nowMs,
  onCollect,
  canHoverFinePointer = true,
}: {
  allTimeEnergyEarned: number;
  pondEra: number;
  unfossilizedStrata: number;
  fossils: number;
  onCycleClick: () => void;
  mutagensBank: number;
  mutagenFormingStartedAtMs: number;
  nowMs: number;
  onCollect: () => void;
  canHoverFinePointer?: boolean;
}) {
  const mutagenUnlocked = isMutagenSystemUnlocked(allTimeEnergyEarned);
  const strataUnlocked = isStratumSystemUnlocked(allTimeEnergyEarned);

  if (!mutagenUnlocked) {
    return null;
  }

  return (
    <Box
      w="full"
      mb="2"
      borderWidth="1px"
      borderColor="lilypad.emphasized"
      borderRadius="md"
      overflow="hidden"
    >
      <Flex direction={{ base: "column", md: "row" }} align="stretch">
        <Box
          flex={strataUnlocked ? 1 : undefined}
          w="full"
          minW="0"
          background={MUTAGEN_WARM_GRADIENT}
          px="2"
          py="1.5"
          transition="flex 0.35s ease-out"
        >
          <MutagenPanel
            embedded
            allTimeEnergyEarned={allTimeEnergyEarned}
            mutagensBank={mutagensBank}
            mutagenFormingStartedAtMs={mutagenFormingStartedAtMs}
            nowMs={nowMs}
            onCollect={onCollect}
            canHoverFinePointer={canHoverFinePointer}
          />
        </Box>
        {strataUnlocked ? (
          <>
            <Box
              flexShrink={0}
              w={{ base: "full", md: "1px" }}
              h={{ base: "1px", md: "auto" }}
              bg="blackAlpha.200"
              alignSelf="stretch"
            />
            <Box
              flex={1}
              minW="0"
              background={FOSSIL_SHOP_CARD_GRADIENT}
              px="2"
              py="1.5"
              transition="flex 0.35s ease-out"
            >
              <StrataProgressRow
                embedded
                allTimeEnergyEarned={allTimeEnergyEarned}
                pondEra={pondEra}
                unfossilizedStrata={unfossilizedStrata}
                fossils={fossils}
                onCycleClick={onCycleClick}
                canHoverFinePointer={canHoverFinePointer}
              />
            </Box>
          </>
        ) : null}
      </Flex>
    </Box>
  );
}
