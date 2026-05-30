import { Box, Text, chakra } from "@chakra-ui/react";

import { formatCombatTagEmojis } from "./combatTagEmojis";
import { getCardBorderColor, getCardTags, CARD_ASPECT_RATIO } from "./combatCardStyle";
import { getCardEffectText, AMMO_COST_TEXT } from "./combatRules";
import { cardRequiresAmmo, getCardName } from "./shantiesTypes";
import type { CombatCard, EquippedGear } from "./shantiesTypes";
import { SQUALLS_HUD_COLORS } from "./squallsTheme";

const CardButton = chakra("button");

const CARD_OUTER_BORDER = "#000000";
const CARD_INNER_BG = "#FFFFFF";
const CARD_TITLE_COLOR = "#1A1A1A";
const CARD_BODY_COLOR = "#4A4A4A";
/** Halfway between 2xs (0.625rem) and the prior 2× title size. */
const CARD_NAME_FONT_SIZE = "0.9375rem";
const CARD_EFFECT_FONT_SIZE = "xs";

type Props = {
  card: CombatCard;
  cost: number;
  equipped?: EquippedGear;
  layout?: "default" | "hand";
  selected?: boolean;
  disabled?: boolean;
  viewOnly?: boolean;
  /** Fill a 2.5×3.5 slot; parent must set `aspectRatio` and `position="relative"`. */
  fillSlot?: boolean;
  /** Let a parent drag handle receive touches (attack cards). */
  dragPassthrough?: boolean;
  onClick: () => void;
};

export default function CombatHandCard({
  card,
  cost,
  equipped,
  layout = "default",
  selected = false,
  disabled = false,
  viewOnly = false,
  fillSlot = false,
  dragPassthrough = false,
  onClick,
}: Props) {
  const effectText = getCardEffectText(card, equipped);
  const costsAmmo = cardRequiresAmmo(card);
  const isHandLayout = layout === "hand";
  const tags = getCardTags(card, equipped);
  const tagEmojis = formatCombatTagEmojis(tags);
  const cardName = getCardName(card);
  const classStripColor = getCardBorderColor(card);
  const stripPadding = isHandLayout ? "2px" : "3px";
  const contentPx = "0.5";
  const tagPb = isHandLayout ? "0.5" : "0.5";

  return (
    <CardButton
      type="button"
      disabled={!viewOnly && disabled}
      onClick={onClick}
      aria-disabled={!viewOnly && disabled}
      position={fillSlot ? "absolute" : "relative"}
      inset={fillSlot ? 0 : undefined}
      w="100%"
      maxW="100%"
      aspectRatio={fillSlot ? undefined : CARD_ASPECT_RATIO}
      justifySelf="center"
      borderRadius="md"
      borderWidth="2px"
      borderColor={selected ? SQUALLS_HUD_COLORS.focusRing : CARD_OUTER_BORDER}
      bg={classStripColor}
      p={stripPadding}
      boxShadow={selected ? "0 0 0 2px rgba(205,170,99,0.45)" : "md"}
      opacity={!viewOnly && disabled ? 0.45 : 1}
      cursor={viewOnly || disabled ? (viewOnly ? "pointer" : "not-allowed") : "pointer"}
      transition="transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease"
      _hover={
        viewOnly || disabled
          ? undefined
          : {
              transform: "translateY(-3px)",
              boxShadow: "md",
            }
      }
      _disabled={{ pointerEvents: "none" }}
      _focusVisible={{
        outline: `2px solid ${SQUALLS_HUD_COLORS.focusRing}`,
        outlineOffset: "2px",
      }}
      pointerEvents={dragPassthrough ? "none" : undefined}
      tabIndex={dragPassthrough ? -1 : undefined}
      display="flex"
      flexDirection="column"
      overflow="hidden"
    >
      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        bg={CARD_INNER_BG}
        borderRadius="sm"
        overflow="hidden"
        minH={0}
        position="relative"
        color={CARD_TITLE_COLOR}
      >
        <Text
          position="absolute"
          top={isHandLayout ? "0.5" : "0.5"}
          right={isHandLayout ? "0.5" : "0.5"}
          fontSize={isHandLayout ? "2xs" : "2xs"}
          fontWeight="bold"
          lineHeight="1"
          minW="1rem"
          textAlign="center"
          px="0.5"
          py="0.5"
          borderRadius="sm"
          borderWidth="1px"
          borderColor="#D1D5DB"
          bg={CARD_INNER_BG}
          color={CARD_TITLE_COLOR}
          zIndex={1}
        >
          {cost}
        </Text>

        <Box
          flex="1"
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          px={contentPx}
          py={1}
          minH={0}
          gap="0.5px"
        >
          <Text
            fontSize={CARD_NAME_FONT_SIZE}
            fontWeight="bold"
            textTransform="uppercase"
            textAlign="center"
            lineHeight="1.1"
            wordBreak="break-word"
            color={CARD_TITLE_COLOR}
            w="100%"
          >
            {cardName}
          </Text>
          <Text
            w="100%"
            fontSize={CARD_EFFECT_FONT_SIZE}
            fontWeight="normal"
            textAlign="center"
            lineHeight="1.15"
            wordBreak="break-word"
            color={CARD_BODY_COLOR}
            mt="1lh"
          >
            {effectText}
          </Text>
          {costsAmmo ? (
            <Text
              w="100%"
              fontSize={CARD_EFFECT_FONT_SIZE}
              fontWeight="normal"
              textAlign="center"
              lineHeight="1.15"
              wordBreak="break-word"
              color={CARD_BODY_COLOR}
            >
              {AMMO_COST_TEXT}
            </Text>
          ) : null}
        </Box>

        {tagEmojis ? (
          <Text
            textAlign="center"
            fontSize={isHandLayout ? "2xs" : "xs"}
            lineHeight="1"
            letterSpacing="0.05em"
            px="0.5"
            pb={tagPb}
            pt={0}
            flexShrink={0}
            aria-label={tags.join(", ")}
          >
            {tagEmojis}
          </Text>
        ) : null}
      </Box>
    </CardButton>
  );
}
