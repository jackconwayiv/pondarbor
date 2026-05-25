import {
  Box,
  Flex,
  Stack,
  Text,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
} from "@chakra-ui/react";

import {
  ecologyTooltipRootBaseProps,
  ecologyTooltipSurfaceProps,
} from "../clicker/ecologyUi.constants";
import PondButton from "../PondButton";
import { DESIGN } from "../theme/tokens";

import { MUTAGEN_LABEL, MUTAGENS_LABEL } from "./clicker2Copy";
import {
  CLICKER2_SHOP_SECTION_HEADING_PROPS,
  MUTAGEN_WARM_GRADIENT,
} from "./clicker2ShopUi";
import {
  isMutagenCollectible,
  isMutagenSystemUnlocked,
  msUntilMutagenCollectible,
  mutagenFormingStatusMessage,
  MUTAGEN_EMOJI,
} from "./mutagens";

const MUTAGEN_PANEL_TOOLTIP =
  "Mutagens allow you to permanently upgrade your pond denizens.";

export default function MutagenPanel({
  allTimeEnergyEarned,
  mutagensBank,
  mutagenFormingStartedAtMs,
  nowMs,
  onCollect,
  canHoverFinePointer = true,
}: {
  allTimeEnergyEarned: number;
  mutagensBank: number;
  mutagenFormingStartedAtMs: number;
  nowMs: number;
  onCollect: () => void;
  canHoverFinePointer?: boolean;
}) {
  if (!isMutagenSystemUnlocked(allTimeEnergyEarned)) {
    return null;
  }

  const collectible = isMutagenCollectible(mutagenFormingStartedAtMs, nowMs);
  const msLeft = msUntilMutagenCollectible(mutagenFormingStartedAtMs, nowMs);

  const panel = (
    <Box
      borderRadius="md"
      px="2"
      py="1.5"
      borderWidth="1px"
      borderStyle={mutagensBank > 0 ? "solid" : "dashed"}
      borderColor="lilypad.emphasized"
      background={MUTAGEN_WARM_GRADIENT}
      cursor={canHoverFinePointer ? "help" : undefined}
    >
      <Stack gap="1.5">
        <Flex justify="space-between" align="center" gap="2">
          <Text {...CLICKER2_SHOP_SECTION_HEADING_PROPS}>
            {MUTAGENS_LABEL}
          </Text>
          {mutagensBank > 0 ? (
            <Text fontSize="sm" fontWeight="medium" fontVariantNumeric="tabular-nums">
              {mutagensBank.toLocaleString()} in pond
            </Text>
          ) : null}
        </Flex>

        {collectible ? (
          <Flex align="center" justify="space-between" gap="2" flexWrap="wrap">
            <Text fontSize="sm" lineHeight="1.4">
              {MUTAGEN_EMOJI} {MUTAGEN_LABEL} ready to collect
            </Text>
            <PondButton
              type="button"
              size="sm"
              colorPalette="lilypad"
              onClick={(e) => {
                e.stopPropagation();
                onCollect();
              }}
            >
              Collect
            </PondButton>
          </Flex>
        ) : mutagenFormingStartedAtMs > 0 ? (
          <Text fontSize="sm" lineHeight="1.4" color={DESIGN.textPrimary}>
            {MUTAGEN_EMOJI} {mutagenFormingStatusMessage(msLeft)}
          </Text>
        ) : (
          <Text fontSize="sm" lineHeight="1.4" color={DESIGN.textPrimary}>
            {MUTAGEN_EMOJI} First {MUTAGEN_LABEL.toLowerCase()} forming…
          </Text>
        )}
      </Stack>
    </Box>
  );

  if (!canHoverFinePointer) {
    return panel;
  }

  return (
    <TooltipRoot
      {...ecologyTooltipRootBaseProps}
      openDelay={400}
      positioning={{ placement: "top" }}
    >
      <TooltipTrigger asChild>{panel}</TooltipTrigger>
      <TooltipPositioner>
        <TooltipContent {...ecologyTooltipSurfaceProps} maxW="280px">
          {MUTAGEN_PANEL_TOOLTIP}
        </TooltipContent>
      </TooltipPositioner>
    </TooltipRoot>
  );
}
