import {
  Box,
  Button,
  Flex,
  IconButton,
  PopoverBody,
  PopoverContent,
  PopoverPositioner,
  PopoverRoot,
  PopoverTrigger,
  Stack,
  Text,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
} from "@chakra-ui/react";
import { memo, useCallback } from "react";

import {
  ecologyPopoverContentProps,
  ecologyTooltipRootBaseProps,
  ecologyTooltipSurfaceProps,
} from "../clicker/ecologyUi.constants";
import { CLICKER_SURFACES } from "../clicker/clickerTheme";
import type { DenizenDef } from "./denizens";
import { denizenLabelForCount, getOwnedDenizenCount, nextDenizenCost } from "./denizens";
import { formatEnergyAmount, formatEnergyRate, formatShopCost } from "./formatEnergy";
import {
  ShopEffectText,
  ShopFlavorText,
  ShopTooltipHeader,
} from "./shopTooltipText";
import { CLICKER2_SHOP_SECTION_HEADING_PROPS } from "./clicker2ShopUi";
import { MUTAGEN_EMOJI } from "./mutagens";
import type {
  DenizenShopTooltipSnapshot,
  GetDenizenShopTooltipSnapshot,
} from "./denizenShopTooltip";
import { useShopTooltipSnapshot } from "./useShopTooltipSnapshot";
import { isDenizenIdentityRevealed } from "./visibility";

/** ~18% from gray.300 toward gray.600 — owned count on unaffordable rows. */
const DENIZEN_OWNED_INACTIVE_COLOR = "#B4BECA";

function formatEpsSharePercent(eps: number, totalEpS: number): string {
  if (totalEpS <= 0 || eps <= 0) return "0";
  const pct = (eps / totalEpS) * 100;
  if (pct >= 10) return Math.round(pct).toString();
  if (pct >= 0.05) return pct.toFixed(1);
  return "<0.1";
}

function DenizenDetails({
  def,
  owned,
  eps,
  perCopyEps,
  totalEpS,
  energyProduced,
  cost,
  maxed,
  mutationLevel,
}: {
  def: DenizenDef;
  owned: number;
  eps: number;
  perCopyEps: number;
  totalEpS: number;
  energyProduced: number;
  cost: number | null;
  maxed: boolean;
  mutationLevel?: number;
}) {
  const singularLabel = def.name.toLowerCase();
  const ownedLabel = denizenLabelForCount(def, owned);

  return (
    <Stack gap="1.5">
      <ShopTooltipHeader
        price={!maxed && cost !== null ? formatShopCost(cost) : undefined}
      >
        {def.emoji} {def.name}
      </ShopTooltipHeader>
      <Text fontSize="xs" lineHeight="1.35">
        Each {singularLabel} produces{" "}
        <ShopEffectText as="span" display="inline" fontVariantNumeric="tabular-nums">
          {formatEnergyRate(perCopyEps)} energy per second
        </ShopEffectText>
        .
      </Text>
      <Text fontSize="xs" lineHeight="1.35" fontVariantNumeric="tabular-nums">
        {owned.toLocaleString()} {ownedLabel} producing{" "}
        <ShopEffectText as="span" display="inline" fontVariantNumeric="tabular-nums">
          {formatEnergyRate(eps)} energy per second
        </ShopEffectText>{" "}
        (
        <ShopEffectText as="span" display="inline" fontVariantNumeric="tabular-nums">
          {formatEpsSharePercent(eps, totalEpS)}% of total EpS
        </ShopEffectText>
        ).
      </Text>
      <Text fontSize="xs" lineHeight="1.35" fontVariantNumeric="tabular-nums">
        <ShopEffectText as="span" display="inline" fontVariantNumeric="tabular-nums">
          {formatEnergyAmount(energyProduced)}
        </ShopEffectText>{" "}
        energy produced so far.
      </Text>
      {mutationLevel != null && mutationLevel > 0 ? (
        <Text fontSize="xs" lineHeight="1.35">
          {MUTAGEN_EMOJI}{" "}
          {mutationLevel}{" "}
          {mutationLevel === 1 ? "mutation" : "mutations"} granting{" "}
          <ShopEffectText as="span" display="inline" fontVariantNumeric="tabular-nums">
            +{mutationLevel}% EpS
          </ShopEffectText>
          .
        </Text>
      ) : null}
      {maxed ? (
        <Text fontSize="2xs" color="gray.600">
          Maximum owned
        </Text>
      ) : null}
      <ShopFlavorText>{def.ecologyNote}</ShopFlavorText>
    </Stack>
  );
}

function DenizenHelpMobileButton({
  def,
  captureSnapshot,
}: {
  def: DenizenDef;
  captureSnapshot: () => DenizenShopTooltipSnapshot;
}) {
  const { snapshot, onOpenChange } = useShopTooltipSnapshot(captureSnapshot);

  return (
    <PopoverRoot positioning={{ placement: "bottom-end" }} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <IconButton
          variant="plain"
          borderRadius="full"
          bg={CLICKER_SURFACES.active}
          color="black"
          borderWidth="1px"
          borderStyle="solid"
          borderColor="black"
          minW="1rem"
          w="1rem"
          h="1rem"
          minH="1rem"
          fontSize="8px"
          fontWeight="extrabold"
          lineHeight="1"
          p="0"
          flexShrink={0}
          aria-label={`Denizen details: ${def.name}`}
          _hover={{ bg: "gray.100" }}
          _active={{ bg: CLICKER_SURFACES.inactive }}
          onClick={(e) => e.stopPropagation()}
        >
          ?
        </IconButton>
      </PopoverTrigger>
      <PopoverPositioner>
        <PopoverContent
          {...ecologyPopoverContentProps}
          w={{ base: "calc(100vw - 2rem)", md: "auto" }}
        >
          <PopoverBody bg={CLICKER_SURFACES.active} color="black" p="3" border="none">
            {snapshot ? (
              <DenizenDetails def={def} {...snapshot} />
            ) : null}
          </PopoverBody>
        </PopoverContent>
      </PopoverPositioner>
    </PopoverRoot>
  );
}

const DenizenShopRow = memo(function DenizenShopRow({
  def,
  owned,
  identityRevealed,
  cost,
  maxed,
  canAfford,
  getTooltipSnapshot,
  canHoverFinePointer,
  onBuy,
}: {
  def: DenizenDef;
  owned: number;
  identityRevealed: boolean;
  cost: number | null;
  maxed: boolean;
  canAfford: boolean;
  getTooltipSnapshot: GetDenizenShopTooltipSnapshot;
  canHoverFinePointer: boolean;
  onBuy: (def: DenizenDef) => void;
}) {
  const captureSnapshot = useCallback(
    () => getTooltipSnapshot(def.id, owned, cost, maxed),
    [getTooltipSnapshot, def.id, owned, cost, maxed],
  );
  const { snapshot: tooltipSnap, onOpenChange: onTooltipOpenChange } =
    useShopTooltipSnapshot(captureSnapshot);

  const purchasable = !maxed && canAfford;
  const showDetails = owned > 0;
  const displayName = identityRevealed ? def.name : "???";

  const row = (
    <Button
      type="button"
      variant="outline"
      w="full"
      h="auto"
      display="flex"
      alignItems="center"
      justifyContent="flex-start"
      gap="1"
      px="0.5"
      py="0"
      minH="3.25rem"
      overflow="hidden"
      borderWidth="2px"
      borderColor="border"
      borderRadius="md"
      bg={
        canAfford || maxed
          ? CLICKER_SURFACES.active
          : CLICKER_SURFACES.inactive
      }
      cursor={purchasable ? "pointer" : maxed ? "default" : "not-allowed"}
      position="relative"
      textAlign="left"
      fontWeight="normal"
      aria-label={
        owned === 0
          ? `${displayName}, ${formatShopCost(cost ?? 0)}`
          : maxed
            ? `${displayName}, ${owned.toLocaleString()} owned, maximum`
            : `${displayName}, ${owned.toLocaleString()} owned, ${formatShopCost(cost ?? 0)}`
      }
      _hover={
        purchasable
          ? { bg: "gray.50", borderColor: "gray.400" }
          : undefined
      }
      _active={purchasable ? { bg: CLICKER_SURFACES.inactive } : undefined}
      onClick={() => {
        if (purchasable) onBuy(def);
      }}
    >
      <Text
        as="span"
        fontSize="2.5rem"
        lineHeight="1"
        flexShrink={0}
        aria-hidden
        style={identityRevealed ? undefined : { filter: "brightness(0)" }}
      >
        {def.emoji}
      </Text>
      <Stack gap="0" flex="1" minW="0" align="flex-start" justify="center">
        <Text
          fontSize="xl"
          lineHeight="1"
          fontWeight="normal"
          fontFamily="heading"
          truncate
          w="full"
        >
          {displayName}
        </Text>
        {!maxed && cost !== null ? (
          <Text
            fontSize="sm"
            lineHeight="1.1"
            color="gray.500"
            fontVariantNumeric="tabular-nums"
            truncate
            w="full"
          >
            {formatShopCost(cost)}
          </Text>
        ) : null}
      </Stack>
      <Box
        position="relative"
        flexShrink={0}
        alignSelf="stretch"
        minW="3.5rem"
        pr="0.5"
      >
        {!canHoverFinePointer && showDetails ? (
          <Box position="absolute" top="0.25rem" right="0.25rem" zIndex={2}>
            <DenizenHelpMobileButton
              def={def}
              captureSnapshot={captureSnapshot}
            />
          </Box>
        ) : null}
        {owned > 0 ? (
          <Text
            position="absolute"
            right="0"
            bottom="0"
            fontSize="2.5rem"
            lineHeight="0.85"
            fontWeight="bold"
            fontVariantNumeric="tabular-nums"
            color={!canAfford && !maxed ? DENIZEN_OWNED_INACTIVE_COLOR : "gray.300"}
            pointerEvents="none"
            userSelect="none"
            aria-hidden
          >
            {owned.toLocaleString()}
          </Text>
        ) : null}
      </Box>
    </Button>
  );

  if (!canHoverFinePointer || !showDetails) {
    return row;
  }

  return (
    <TooltipRoot
      {...ecologyTooltipRootBaseProps}
      openDelay={400}
      positioning={{ placement: "top" }}
      onOpenChange={onTooltipOpenChange}
    >
      <TooltipTrigger asChild>{row}</TooltipTrigger>
      <TooltipPositioner>
        <TooltipContent {...ecologyTooltipSurfaceProps} maxW="300px">
          {tooltipSnap ? <DenizenDetails def={def} {...tooltipSnap} /> : null}
        </TooltipContent>
      </TooltipPositioner>
    </TooltipRoot>
  );
});

function DenizenShopList({
  denizens,
  spendableEnergy,
  ownedDenizens,
  revealedDenizens,
  effectiveEnergy,
  getTooltipSnapshot,
  canHoverFinePointer,
  onBuy,
  savedBannerKey = 0,
}: {
  denizens: readonly DenizenDef[];
  spendableEnergy: number;
  ownedDenizens: Record<string, number>;
  revealedDenizens: Record<string, boolean>;
  effectiveEnergy: number;
  getTooltipSnapshot: GetDenizenShopTooltipSnapshot;
  canHoverFinePointer: boolean;
  onBuy: (def: DenizenDef) => void;
  /** Non-zero while the post-save indicator is visible. */
  savedBannerKey?: number;
}) {
  const showSavedIndicator = savedBannerKey > 0;
  if (denizens.length === 0 && !showSavedIndicator) return null;

  return (
    <Box>
      <Flex align="center" justify="space-between" gap="2" mb="1">
        <Text {...CLICKER2_SHOP_SECTION_HEADING_PROPS} mb="0">
          Denizens
        </Text>
        <Box flexShrink={0} display="flex" alignItems="center" justifyContent="flex-end">
          <Text
            key={
              showSavedIndicator
                ? `saved-indicator-${savedBannerKey}`
                : "saved-indicator-slot"
            }
            as="span"
            className={showSavedIndicator ? "pond2SavedBanner" : undefined}
            role={showSavedIndicator ? "status" : undefined}
            aria-hidden={!showSavedIndicator}
            fontSize="xs"
            fontWeight="bold"
            color="black"
            visibility={showSavedIndicator ? "visible" : "hidden"}
          >
            Saved
          </Text>
        </Box>
      </Flex>
      {denizens.length > 0 ? (
      <Stack gap="0.5">
        {denizens.map((def) => {
          const owned = getOwnedDenizenCount(ownedDenizens, def.id);
          const cost = nextDenizenCost(def, owned);
          const maxed = cost === null;
          const canAfford = cost !== null && spendableEnergy >= cost;
          const identityRevealed = isDenizenIdentityRevealed(
            def.id,
            effectiveEnergy,
            ownedDenizens,
            revealedDenizens,
          );
          return (
            <DenizenShopRow
              key={def.id}
              def={def}
              owned={owned}
              identityRevealed={identityRevealed}
              cost={cost}
              maxed={maxed}
              canAfford={canAfford}
              getTooltipSnapshot={getTooltipSnapshot}
              canHoverFinePointer={canHoverFinePointer}
              onBuy={onBuy}
            />
          );
        })}
      </Stack>
      ) : null}
    </Box>
  );
}

export default memo(DenizenShopList);
