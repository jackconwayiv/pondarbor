import {
  Box,
  Button,
  Flex,
  Stack,
  Text,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
} from "@chakra-ui/react";
import { memo, useCallback } from "react";

import {
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
import type { GetDenizenShopTooltipSnapshot } from "./denizenShopTooltip";
import { ShopHelpMobilePopover } from "./ShopHelpMobilePopover";
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

  const showMobileHelp = !canHoverFinePointer && showDetails;

  const row = (
    <Flex gap="1" align="stretch" w="full">
      <Button
        type="button"
        variant="outline"
        flex="1"
        minW="0"
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
      {!canHoverFinePointer ? (
        <Flex
          align="center"
          justify="center"
          flexShrink={0}
          w="1rem"
          minW="1rem"
          alignSelf="stretch"
        >
          {showMobileHelp ? (
            <ShopHelpMobilePopover
              ariaLabel={`Denizen details: ${def.name}`}
              onOpenChange={onTooltipOpenChange}
            >
              {tooltipSnap ? (
                <DenizenDetails def={def} {...tooltipSnap} />
              ) : null}
            </ShopHelpMobilePopover>
          ) : null}
        </Flex>
      ) : null}
    </Flex>
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
  hideSavedIndicator = false,
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
  /** When true, saved indicator is rendered elsewhere (e.g. mobile HUD). */
  hideSavedIndicator?: boolean;
}) {
  const showSavedIndicator = !hideSavedIndicator && savedBannerKey > 0;
  if (denizens.length === 0 && !showSavedIndicator) return null;

  return (
    <Box>
      <Flex align="center" justify="space-between" gap="2" mb="1">
        <Text {...CLICKER2_SHOP_SECTION_HEADING_PROPS} mb="0">
          Denizens
        </Text>
        {hideSavedIndicator ? null : (
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
        )}
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
