import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { useEffect, useMemo, useState } from "react";

import PondButton from "../PondButton";
import { useIsMobile } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  HIDE_SCROLLBAR_CSS,
} from "../theme/typography";

import {
  BEGIN_NEW_CYCLE_BUTTON,
  FOSSIL_SHOP_INTERSTITIAL_INTRO,
  FOSSIL_SHOP_LABEL,
  PETROGLYPH_CLICK_TO_ETCH,
  PETROGLYPH_I_HEADER,
  PETROGLYPH_I_HEADER_WITH_EMOJI,
  PETROGLYPH_NO_ELIGIBLE_HINT,
} from "./clicker2Copy";
import { FOSSIL_SHOP_INTERSTITIAL_HEADING_PROPS, FOSSIL_SHOP_TREE_NODE_MAX_W } from "./clicker2ShopUi";
import {
  FOSSIL_SHOP_SANDSTONE_TEXTURE_OPACITY,
  FOSSIL_SHOP_SANDSTONE_TEXTURE_SRC,
} from "./clicker2PlaySurfaceTextures";
import Clicker2TiledTextureOverlay from "./Clicker2TiledTextureOverlay";
import { evolutionDisplayEmoji } from "./clicker2OwnedEvolutions";
import { EvolutionShopCard } from "./EvolutionShopCard";
import {
  buildFossilShopTreeGraph,
  FAE_PORTAL_SPECIALTY_ID,
  FOSSIL_SHOP_SPECIALTY_IDS,
  formatFossilCost,
  formatFossilsBalanceHeader,
  initialExpandedFossilShopTreeNodes,
  isFossilShopItemForSale,
  type FossilShopTreeGraph,
} from "./fossilShop";
import {
  FOSSIL_SHOP_ALMOND_BG,
  FOSSIL_SHOP_BACKDROP_BG,
  FOSSIL_SHOP_CARD_BORDER_WIDTH,
  fossilShopCardBackgroundGradient,
} from "./specialtyTierColors";
import { getSpecialtyDef, type SpecialtyDef } from "./specialties";
import {
  findPetroglyphSlotIndex,
  petroglyphSlotCanEtch,
  type PetroglyphSlot,
} from "./petroglyphs";

import "./FossilShopTreeView.css";

const FOSSIL_SHOP_HIDDEN_NODE_LABEL = "???";

function FossilShopTreeBranch({
  specialtyId,
  graph,
  expandedNodeIds,
  ownedSpecialties,
  fossils,
  petroglyphSlots,
  petroglyphEtchPool,
  canHoverFinePointer,
  isMobile,
  onBuy,
  onEtchPetroglyph,
}: {
  specialtyId: number;
  graph: FossilShopTreeGraph;
  expandedNodeIds: ReadonlySet<number>;
  ownedSpecialties: Record<number, boolean>;
  fossils: number;
  petroglyphSlots: readonly PetroglyphSlot[];
  petroglyphEtchPool: readonly number[];
  canHoverFinePointer: boolean;
  isMobile: boolean;
  onBuy: (def: SpecialtyDef) => void;
  onEtchPetroglyph: (slotIndex: number) => void;
}) {
  const node = graph.nodes.get(specialtyId);
  const def = getSpecialtyDef(specialtyId);
  if (!node || !def) return null;

  const owned = ownedSpecialties[specialtyId] === true;
  const fossilCost = def.priceFossils ?? 0;
  const canAffordFossils = fossils >= fossilCost;
  const forSale = isFossilShopItemForSale(def, ownedSpecialties);
  const revealed = owned || forSale;
  const hasChildren = node.children.length > 0;
  const expanded =
    (owned && hasChildren) || expandedNodeIds.has(specialtyId);
  const showBuy = forSale;
  const isPetroglyph = def.effect.type === "petroglyph_slot";
  const slotIndex = isPetroglyph
    ? findPetroglyphSlotIndex(petroglyphSlots, specialtyId)
    : -1;
  const slot = slotIndex >= 0 ? petroglyphSlots[slotIndex] : undefined;
  const etchedDef =
    slot?.etched_specialty_id != null
      ? getSpecialtyDef(slot.etched_specialty_id)
      : undefined;

  const isFaePortal = specialtyId === FAE_PORTAL_SPECIALTY_ID;
  const faeForkExpanded = isFaePortal && expanded && hasChildren;
  const petroglyphBlank = owned && isPetroglyph && etchedDef == null;
  const canEtchPetroglyph =
    owned &&
    isPetroglyph &&
    slotIndex >= 0 &&
    petroglyphSlotCanEtch(
      ownedSpecialties,
      petroglyphSlots,
      slotIndex,
      petroglyphEtchPool,
    );
  const petroglyphCardName =
    owned && isPetroglyph
      ? etchedDef
        ? etchedDef.name
        : canEtchPetroglyph
          ? PETROGLYPH_CLICK_TO_ETCH
          : def.name
      : revealed
        ? def.name
        : FOSSIL_SHOP_HIDDEN_NODE_LABEL;

  return (
    <Stack
      align="center"
      gap="2"
      minW="0"
      w={faeForkExpanded ? "max-content" : "full"}
      maxW={faeForkExpanded ? "none" : "100%"}
    >
      <Stack align="center" gap="1" maxW={FOSSIL_SHOP_TREE_NODE_MAX_W} w="full">
        <EvolutionShopCard
          def={def}
          canHoverFinePointer={canHoverFinePointer && revealed}
          owned={owned}
          canAfford={forSale && canAffordFossils}
          emphasized={revealed}
          displayName={petroglyphCardName}
          displayEmoji={
            owned && isPetroglyph && etchedDef
              ? evolutionDisplayEmoji(etchedDef)
              : undefined
          }
          cardHeaderLabel={
            owned && isPetroglyph && etchedDef
              ? isMobile
                ? PETROGLYPH_I_HEADER
                : PETROGLYPH_I_HEADER_WITH_EMOJI
              : undefined
          }
          backgroundGradient={fossilShopCardBackgroundGradient(
            owned,
            showBuy,
            canAffordFossils,
          )}
          borderWidth={FOSSIL_SHOP_CARD_BORDER_WIDTH}
          borderStyle={owned && isPetroglyph && petroglyphBlank ? "dashed" : "solid"}
          costLabel={formatFossilCost(fossilCost)}
          cardPriceLabel={showBuy ? formatFossilCost(fossilCost) : undefined}
          onBuy={showBuy ? onBuy : undefined}
          onActivate={
            canEtchPetroglyph ? () => onEtchPetroglyph(slotIndex) : undefined
          }
          activateAriaLabel={PETROGLYPH_CLICK_TO_ETCH}
        />
        {petroglyphBlank && !canEtchPetroglyph ? (
          <Text fontSize="2xs" color="gray.500" textAlign="center" lineHeight="1.2">
            {PETROGLYPH_NO_ELIGIBLE_HINT}
          </Text>
        ) : null}
      </Stack>

      {hasChildren && expanded ? (
        <Stack align="center" gap="2" w={isFaePortal ? "max-content" : "full"}>
          <Box className="fossilShopTreeConnector" aria-hidden />
          <Flex
            className={isFaePortal ? "fossilShopTreeView__faeFork" : undefined}
            gap="3"
            justify="center"
            align="flex-start"
            flexWrap={isFaePortal ? "nowrap" : "wrap"}
            w={isFaePortal ? "max-content" : "full"}
            maxW="100%"
          >
            {node.children.map((childId) => {
              const childIsFaePortal = childId === FAE_PORTAL_SPECIALTY_ID;
              const faePortalExpanded =
                childIsFaePortal && expandedNodeIds.has(FAE_PORTAL_SPECIALTY_ID);

              return (
                <Box
                  key={childId}
                  flex={
                    isFaePortal || (childIsFaePortal && faePortalExpanded)
                      ? "0 0 auto"
                      : `1 1 ${FOSSIL_SHOP_TREE_NODE_MAX_W}`
                  }
                  w={
                    isFaePortal
                      ? FOSSIL_SHOP_TREE_NODE_MAX_W
                      : childIsFaePortal && faePortalExpanded
                        ? "max-content"
                        : undefined
                  }
                  minW={isFaePortal ? undefined : FOSSIL_SHOP_TREE_NODE_MAX_W}
                  maxW={
                    isFaePortal
                      ? FOSSIL_SHOP_TREE_NODE_MAX_W
                      : childIsFaePortal && faePortalExpanded
                        ? "none"
                        : "9rem"
                  }
                  alignSelf={isFaePortal ? "flex-start" : undefined}
                >
                  <FossilShopTreeBranch
                    specialtyId={childId}
                    graph={graph}
                    expandedNodeIds={expandedNodeIds}
                    ownedSpecialties={ownedSpecialties}
                    fossils={fossils}
                    petroglyphSlots={petroglyphSlots}
                    petroglyphEtchPool={petroglyphEtchPool}
                    canHoverFinePointer={canHoverFinePointer}
                    isMobile={isMobile}
                    onBuy={onBuy}
                    onEtchPetroglyph={onEtchPetroglyph}
                  />
                </Box>
              );
            })}
          </Flex>
        </Stack>
      ) : null}
    </Stack>
  );
}

export default function FossilShopTreeView({
  fossils,
  ownedSpecialties,
  petroglyphSlots,
  petroglyphEtchPool,
  canHoverFinePointer,
  onBuy,
  onEtchPetroglyph,
  onBeginNewCycle,
}: {
  fossils: number;
  ownedSpecialties: Record<number, boolean>;
  petroglyphSlots: readonly PetroglyphSlot[];
  petroglyphEtchPool: readonly number[];
  canHoverFinePointer: boolean;
  onBuy: (def: SpecialtyDef) => void;
  onEtchPetroglyph: (slotIndex: number) => void;
  onBeginNewCycle: () => void;
}) {
  const isMobile = useIsMobile();
  const graph = useMemo(() => buildFossilShopTreeGraph(), []);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<number>>(() =>
    initialExpandedFossilShopTreeNodes(ownedSpecialties, graph),
  );

  useEffect(() => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      for (const id of FOSSIL_SHOP_SPECIALTY_IDS) {
        if (!ownedSpecialties[id]) continue;
        next.add(id);
        let parentId = graph.nodes.get(id)?.parentId ?? null;
        while (parentId != null) {
          next.add(parentId);
          parentId = graph.nodes.get(parentId)?.parentId ?? null;
        }
      }
      return next;
    });
  }, [graph, ownedSpecialties]);

  return (
    <Box
      className="fossilShopTreeView"
      role="dialog"
      aria-label={FOSSIL_SHOP_LABEL}
      bg={FOSSIL_SHOP_BACKDROP_BG}
      px={{ base: "2", md: "2" }}
      py={{ base: "2", md: "2" }}
    >
      <Box
        {...APP_SHELL_TRAY_PROPS}
        bg={FOSSIL_SHOP_ALMOND_BG}
        position="relative"
        flex="1"
        minH="0"
        display="flex"
        flexDirection="column"
      >
        <Clicker2TiledTextureOverlay
          src={FOSSIL_SHOP_SANDSTONE_TEXTURE_SRC}
          opacity={FOSSIL_SHOP_SANDSTONE_TEXTURE_OPACITY}
        />
        <Stack
          gap={{ base: "4", md: "4" }}
          px={{ base: "2", md: "2" }}
          pt={{ base: "2", md: "2" }}
          pb={{ base: "2", md: "2" }}
          flex="1"
          minH="0"
          position="relative"
          zIndex={1}
        >
          <Flex
            align="center"
            justify="space-between"
            gap="3"
            flexWrap="wrap"
            borderBottomWidth="1px"
            borderColor="border"
            pb="2"
          >
            <Text {...FOSSIL_SHOP_INTERSTITIAL_HEADING_PROPS}>
              {FOSSIL_SHOP_LABEL}
            </Text>
            <Text
              fontSize={APP_TEXT_SIZES.label}
              fontWeight="semibold"
              color="gray.700"
              fontVariantNumeric="tabular-nums"
            >
              {formatFossilsBalanceHeader(fossils)}
            </Text>
          </Flex>

          <Flex
            align="center"
            justify="space-between"
            gap="3"
            flexWrap="wrap"
          >
            <Text
              flex="1"
              minW="12rem"
              fontSize={APP_TEXT_SIZES.body}
              lineHeight="1.45"
              color="gray.700"
            >
              {FOSSIL_SHOP_INTERSTITIAL_INTRO}
            </Text>
            <PondButton
              type="button"
              colorPalette="sky"
              size="sm"
              flexShrink={0}
              onClick={onBeginNewCycle}
            >
              {BEGIN_NEW_CYCLE_BUTTON}
            </PondButton>
          </Flex>

          <Box
            className="fossilShopTreeView__treeScroll"
            flex="1"
            minH="0"
            css={HIDE_SCROLLBAR_CSS}
          >
            <FossilShopTreeBranch
              specialtyId={graph.rootId}
              graph={graph}
              expandedNodeIds={expandedNodeIds}
              ownedSpecialties={ownedSpecialties}
              fossils={fossils}
              petroglyphSlots={petroglyphSlots}
              petroglyphEtchPool={petroglyphEtchPool}
              canHoverFinePointer={canHoverFinePointer}
              isMobile={isMobile}
              onBuy={onBuy}
              onEtchPetroglyph={onEtchPetroglyph}
            />
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}
