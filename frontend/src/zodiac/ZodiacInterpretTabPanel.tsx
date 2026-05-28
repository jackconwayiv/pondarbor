import {
  Box,
  Flex,
  Grid,
  Heading,
  HStack,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { useHorizontalSwipeNavigate } from "../hooks/useHorizontalSwipeNavigate";
import PondButton from "../PondButton";
import { useIsMobile } from "../responsive";
import {
  APP_SHELL_TAB_LIST_INSET_PROPS,
  APP_SHELL_TAB_LIST_MEAL_INNER_PROPS,
  APP_SHELL_TAB_TRIGGER_BASE_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import { APP_TEXT_SIZES } from "../theme/typography";
import {
  bodySymbolForTileId,
  chartPointDisplayLabel,
  youAreSignHeading,
} from "./astroLexicon";
import {
  buildHouseInterpretWriteup,
  interpretPlacementChartKey,
} from "./buildHouseInterpretWriteup";
import {
  buildInterpretPageSubTabs,
  buildInterpretPages,
  buildInterpretSectionNav,
  interpretHousePageIndex,
  interpretPageLabel,
  interpretPageSection,
  interpretPageSubTabValue,
  interpretPlacementPageIndex,
  interpretSignPageIndex,
  type InterpretPage,
  type InterpretSectionId,
} from "./buildInterpretPages";
import InterpretHouseOccupantCard from "./InterpretHouseOccupantCard";
import InterpretPlacementHouseLinkCard from "./InterpretPlacementHouseLinkCard";
import InterpretSearchSuggestions from "./InterpretSearchSuggestions";
import InterpretSignLinkCard from "./InterpretSignLinkCard";
import { buildInterpretSearchSuggestions } from "./buildInterpretSearchSuggestions";
import { buildSignInterpretWriteup } from "./buildSignInterpretWriteup";
import {
  buildInterpretWriteup,
  type InterpretPlanetDomainsLead,
} from "./buildInterpretWriteup";
import { signCardAccent } from "./signCardAccent";
import type { NatalChartPayload } from "./chartTypes";
import type { ZodiacSignCardTile } from "./ZodiacSignCardsStrip";
import {
  INTERPRET_BODY_FONT_SIZE,
  INTERPRET_HEADING_SIZE,
} from "./interpretTypography";
import { ZODIAC_RETROGRADE_EXPLANATION } from "./zodiacRetrogradeCopy";
import { houseEmojiForHouse } from "./zodiacHouseDescriptors";

import "./ZodiacInterpretPager.css";

/** Interpret pager tabs: no gray bar; tighter vertical rhythm than shell defaults. */
const ZODIAC_INTERPRET_SECTION_TAB_LIST_PROPS = {
  ...APP_SHELL_TAB_LIST_INSET_PROPS,
  bg: "transparent",
  py: "1",
  gap: "1",
  borderBottomWidth: "0",
} as const;

const ZODIAC_INTERPRET_SUBTAB_LIST_PROPS = {
  ...APP_SHELL_TAB_LIST_MEAL_INNER_PROPS,
  bg: "transparent",
  px: 0,
  py: "1",
  gap: "1",
  pb: "0.5",
  borderBottomWidth: "0",
  flexWrap: "wrap",
} as const;

const ZODIAC_INTERPRET_SECTION_TAB_TRIGGER_PROPS = {
  ...APP_SHELL_TAB_TRIGGER_PROPS,
  py: "1",
  _hover: { bg: "transparent" },
} as const;

const ZODIAC_INTERPRET_SUBTAB_TRIGGER_PROPS = {
  ...APP_SHELL_TAB_TRIGGER_BASE_PROPS,
  py: "0.75",
  px: "2",
  _hover: { bg: "transparent" },
} as const;

// Temporarily hide Interpret section/subsection tabs to reduce UI clutter.
// Flip back to `true` when we're ready to expose the nav again.
const SHOW_INTERPRET_TABS = false;

type PagerDirection = -1 | 1;

export type ZodiacInterpretTabPanelProps = {
  chart: NatalChartPayload;
  includeHouses: boolean;
  includeRising: boolean;
};

/** Oxford-comma list; first item semibold, rest regular weight. */
function DomainPhraseList({ phrases }: { phrases: readonly string[] }) {
  if (phrases.length === 0) return null;
  const bold = (phrase: string) => (
    <Text as="span" fontWeight="semibold">
      {phrase}
    </Text>
  );
  if (phrases.length === 1) return bold(phrases[0]!);
  const rest = phrases.slice(1);
  return (
    <>
      {bold(phrases[0]!)}
      {rest.length === 1 ? (
        <>
          {", and "}
          {rest[0]}
        </>
      ) : (
        <>
          {", "}
          {rest.slice(0, -1).join(", ")}
          {", and "}
          {rest[rest.length - 1]}
        </>
      )}
    </>
  );
}

/** Oxford-comma list with each item semibold (matches `joinEnglishList` wording). */
function BoldEnglishList({ phrases }: { phrases: readonly string[] }) {
  if (phrases.length === 0) return null;
  const item = (phrase: string, key: string) => (
    <Text as="span" fontWeight="semibold" key={key}>
      {phrase}
    </Text>
  );
  if (phrases.length === 1) return item(phrases[0]!, phrases[0]!);
  if (phrases.length === 2) {
    return (
      <>
        {item(phrases[0]!, "0")}
        {" and "}
        {item(phrases[1]!, "1")}
      </>
    );
  }
  return (
    <>
      {phrases.slice(0, -1).map((phrase, i) => (
        <Fragment key={`${phrase}-${i}`}>
          {i > 0 ? ", " : null}
          {item(phrase, `${phrase}-${i}`)}
        </Fragment>
      ))}
      {", and "}
      {item(phrases[phrases.length - 1]!, "last")}
    </>
  );
}

function InterpretPlanetDomainsLeadText({
  lead,
  textProps,
}: {
  lead: InterpretPlanetDomainsLead;
  textProps?: React.ComponentProps<typeof Text>;
}) {
  return (
    <Text
      fontSize={INTERPRET_BODY_FONT_SIZE}
      lineHeight="tall"
      color="fg"
      {...textProps}
    >
      {lead.isRising ? (
        <>With {lead.signName} Rising, your </>
      ) : (
        <>
          With your {lead.placementPlanet} in {lead.signName}, your{" "}
        </>
      )}
      <DomainPhraseList phrases={lead.domainPhrases} /> manifest as{" "}
      <BoldEnglishList phrases={lead.adjectivePhrases} />.
    </Text>
  );
}

function SymbolPrefix({
  symbol,
  label,
}: {
  symbol: string | null;
  label: string;
}) {
  return (
    <HStack as="span" display="inline-flex" gap="1.5" alignItems="center">
      {symbol ? (
        <Text as="span" aria-hidden="true">
          {symbol}
        </Text>
      ) : null}
      <Text as="span">{label}</Text>
    </HStack>
  );
}

function InterpretPlacementTitle({
  writeup,
  accent,
}: {
  writeup: NonNullable<ReturnType<typeof buildInterpretWriteup>>;
  accent: ReturnType<typeof signCardAccent>;
}) {
  const { planetSymbol, planetLabel, signSymbol, signName, houseOrdinal, retrograde } = writeup;

  return (
    <Flex align="center" gap="2" flexWrap="wrap" w="100%">
      <Heading
        as="h2"
        size={INTERPRET_HEADING_SIZE}
        fontFamily="heading"
        fontWeight="normal"
        lineHeight="short"
        color="fg"
        display="flex"
        flexWrap="wrap"
        alignItems="center"
        gap={{ base: "1", md: "1.5" }}
        mb="0"
      >
        <SymbolPrefix symbol={planetSymbol} label={planetLabel} />
        <Text as="span" fontWeight="normal" color="fg.muted">
          in
        </Text>
        <SymbolPrefix symbol={signSymbol} label={signName} />
        {houseOrdinal != null ? (
          <>
            <Text as="span" fontWeight="normal" color="fg.muted">
              in the
            </Text>
            <Text as="span">{houseOrdinal} House</Text>
          </>
        ) : null}
      </Heading>
      {retrograde ? (
        <Text
          as="span"
          fontSize="xs"
          fontWeight="bold"
          letterSpacing="0.12em"
          textTransform="uppercase"
          px="2"
          py="1"
          borderRadius="md"
          bg={accent.bg}
          color={accent.valueColor}
          flexShrink={0}
        >
          RETROGRADE
        </Text>
      ) : null}
    </Flex>
  );
}

function InterpretPlacementPageContent({
  tile,
  chart,
  pages,
  onGoToPage,
}: {
  tile: ZodiacSignCardTile;
  chart: NatalChartPayload;
  pages: InterpretPage[];
  onGoToPage: (pageIndex: number) => void;
}) {
  const writeup = buildInterpretWriteup(tile, chart);
  const accent = signCardAccent(tile.sign);
  if (!writeup) return null;

  const houseFollowUp = writeup.houseFollowUp;
  const housePageIdx =
    houseFollowUp != null
      ? interpretHousePageIndex(pages, houseFollowUp.house)
      : null;
  const signPageIdx = interpretSignPageIndex(pages, tile.sign);
  const signInteractive = signPageIdx != null;

  return (
    <Grid
      templateColumns={{ base: "1fr", md: "2fr 1fr" }}
      gap={{ base: "5", md: "6" }}
      alignItems="start"
      w="100%"
    >
      <Stack gap="4" minW="0">
        <Stack gap="2" w="100%">
          <InterpretPlacementTitle writeup={writeup} accent={accent} />
          {tile.id === "sun" && youAreSignHeading(tile.sign) ? (
            <Heading
              as="h2"
              size={INTERPRET_HEADING_SIZE}
              fontFamily="heading"
              fontWeight="normal"
              lineHeight="short"
              color="fg"
              mb="0"
            >
              {youAreSignHeading(tile.sign)}
            </Heading>
          ) : null}
        </Stack>
        {writeup.retrograde ? (
          <Text
            fontSize={{ base: "xs", md: "sm" }}
            color="fg"
            lineHeight="tall"
            fontStyle="italic"
          >
            {ZODIAC_RETROGRADE_EXPLANATION}
          </Text>
        ) : null}
        <InterpretPlanetDomainsLeadText lead={writeup.planetDomainsLead} />
        {houseFollowUp ? (
          <InterpretPlacementHouseLinkCard
            house={houseFollowUp.house}
            text={houseFollowUp.text}
            chart={chart}
            bodyFontSize={INTERPRET_BODY_FONT_SIZE}
            showHeading={false}
            onOpen={
              housePageIdx != null ? () => onGoToPage(housePageIdx) : undefined
            }
          />
        ) : null}
        {writeup.housesRuled.length > 0 ? (
          <SimpleGrid
            columns={
              writeup.housesRuled.length >= 2 ? { base: 1, md: 2 } : { base: 1 }
            }
            gap="3"
            w="100%"
          >
            {writeup.housesRuled.map((ruled) => {
              const ruledHousePageIdx = interpretHousePageIndex(pages, ruled.house);
              return (
                <InterpretPlacementHouseLinkCard
                  key={`ruled-${ruled.house}`}
                  house={ruled.house}
                  text={ruled.text}
                  chart={chart}
                  accentSign={ruled.cuspSign}
                  showHeading={false}
                  bodyFontSize={INTERPRET_BODY_FONT_SIZE}
                  onOpen={
                    ruledHousePageIdx != null
                      ? () => onGoToPage(ruledHousePageIdx)
                      : undefined
                  }
                />
              );
            })}
          </SimpleGrid>
        ) : null}
      </Stack>

      <Box
        role={signInteractive ? "button" : undefined}
        tabIndex={signInteractive ? 0 : undefined}
        aria-label={
          signInteractive ? `Open ${writeup.signName} interpretation.` : undefined
        }
        cursor={signInteractive ? "pointer" : "default"}
        borderRadius="xl"
        borderWidth="1px"
        borderColor={accent.borderColor}
        borderLeftWidth="3px"
        borderLeftColor={accent.borderColor}
        bg={accent.bg}
        p={{ base: "4", md: "5" }}
        minW="0"
        transition="box-shadow 0.15s ease"
        _hover={signInteractive ? { boxShadow: "md" } : undefined}
        _focusVisible={
          signInteractive
            ? {
                outline: "2px solid",
                outlineColor: "fg",
                outlineOffset: "2px",
              }
            : undefined
        }
        onClick={signInteractive ? () => onGoToPage(signPageIdx) : undefined}
        onKeyDown={
          signInteractive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onGoToPage(signPageIdx);
                }
              }
            : undefined
        }
      >
        <Flex align="center" gap="2" mb="3" flexWrap="wrap">
          {writeup.signSymbol ? (
            <Text fontSize="xl" lineHeight="1" aria-hidden="true">
              {writeup.signSymbol}
            </Text>
          ) : null}
          <Heading
            as="h3"
            size={INTERPRET_HEADING_SIZE}
            fontFamily="heading"
            fontWeight="normal"
            lineHeight="short"
            color={accent.labelColor}
            textTransform="capitalize"
            mb="0"
          >
            {writeup.signName}
          </Heading>
        </Flex>
        <Text
          fontSize={INTERPRET_BODY_FONT_SIZE}
          lineHeight="tall"
          color={accent.valueColor}
          mb="4"
        >
          {writeup.signCalloutParagraph}
        </Text>
      </Box>
    </Grid>
  );
}

function InterpretSignPageContent({
  sign,
  chart,
  pages,
  onGoToPage,
}: {
  sign: string;
  chart: NatalChartPayload;
  pages: InterpretPage[];
  onGoToPage: (pageIndex: number) => void;
}) {
  const writeup = buildSignInterpretWriteup(sign, chart);
  if (!writeup) return null;

  return (
    <Stack gap="4" w="100%">
      <Flex align="center" gap="2" flexWrap="wrap">
        {writeup.signSymbol ? (
          <Text fontSize="2xl" lineHeight="1" aria-hidden="true">
            {writeup.signSymbol}
          </Text>
        ) : null}
        <Heading
          as="h2"
          size={INTERPRET_HEADING_SIZE}
          fontFamily="heading"
          fontWeight="normal"
          lineHeight="short"
          color="fg"
          mb="0"
        >
          {writeup.signHeading}
        </Heading>
        {writeup.signEmoji ? (
          <Text fontSize="2xl" lineHeight="1" aria-hidden="true">
            {writeup.signEmoji}
          </Text>
        ) : null}
      </Flex>

      {writeup.calloutParagraph ? (
        <Text
          fontSize={INTERPRET_BODY_FONT_SIZE}
          lineHeight="tall"
          color="fg"
        >
          {writeup.calloutParagraph}
        </Text>
      ) : null}

      {writeup.ruledHouses.length > 0 ? (
        <SimpleGrid
          columns={
            writeup.ruledHouses.length >= 2 ? { base: 1, md: 2 } : { base: 1 }
          }
          gap="3"
          w="100%"
        >
          {writeup.ruledHouses.map((ruled) => {
            const housePageIdx = interpretHousePageIndex(pages, ruled.house);
            return (
              <InterpretPlacementHouseLinkCard
                key={ruled.house}
                house={ruled.house}
                text={ruled.text}
                chart={chart}
                accentSign={writeup.sign}
                showHeading={false}
                bodyFontSize={INTERPRET_BODY_FONT_SIZE}
                onOpen={
                  housePageIdx != null ? () => onGoToPage(housePageIdx) : undefined
                }
              />
            );
          })}
        </SimpleGrid>
      ) : null}

      {writeup.occupants.length > 0 ? (
        <Stack gap="3" w="100%">
          <Text
            fontSize={INTERPRET_BODY_FONT_SIZE}
            lineHeight="tall"
            color="fg"
            fontWeight="normal"
          >
            Your planetary placements in {writeup.signName}:
          </Text>
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap="3" w="100%">
            {writeup.occupants.map((occ) => {
              const placementIdx = interpretPlacementPageIndex(pages, occ.chartKey);
              return (
                <InterpretHouseOccupantCard
                  key={occ.chartKey}
                  occupant={occ}
                  onOpen={
                    placementIdx != null ? () => onGoToPage(placementIdx) : undefined
                  }
                />
              );
            })}
          </SimpleGrid>
        </Stack>
      ) : writeup.ruledHouses.length > 0 ? (
        <Text
          fontSize={INTERPRET_BODY_FONT_SIZE}
          lineHeight="tall"
          color="fg"
          fontWeight="normal"
        >
          You have no planetary placements in {writeup.signName}.
        </Text>
      ) : null}
    </Stack>
  );
}

function InterpretHousePageContent({
  house,
  chart,
  pages,
  onGoToPage,
}: {
  house: number;
  chart: NatalChartPayload;
  pages: InterpretPage[];
  onGoToPage: (pageIndex: number) => void;
}) {
  const writeup = buildHouseInterpretWriteup(house, chart);
  if (!writeup) return null;

  const houseEmoji = houseEmojiForHouse(house);

  return (
    <Stack gap="4" w="100%">
      <Flex align="center" gap="2" flexWrap="wrap">
        {houseEmoji ? (
          <Text fontSize="2xl" lineHeight="1" aria-hidden="true">
            {houseEmoji}
          </Text>
        ) : null}
        <Heading
          as="h2"
          size={INTERPRET_HEADING_SIZE}
          fontFamily="heading"
          fontWeight="normal"
          lineHeight="short"
          color="fg"
          mb="0"
        >
          {writeup.title}
        </Heading>
      </Flex>
      {writeup.staticParagraphs.map((paragraph) => (
        <Text
          key={paragraph}
          fontSize={INTERPRET_BODY_FONT_SIZE}
          lineHeight="tall"
          color="fg"
        >
          {paragraph}
        </Text>
      ))}
      {writeup.rulerSignLinks.length > 0 ? (
        <SimpleGrid columns={{ base: 1, md: 2 }} gap="3" w="100%">
          {writeup.rulerSignLinks.map((link) => {
            const placementKey = link.placementChartKey
              ? interpretPlacementChartKey(link.placementChartKey)
              : null;
            const pageIdx =
              placementKey != null
                ? interpretPlacementPageIndex(pages, placementKey)
                : interpretSignPageIndex(pages, link.sign);
            const openLabel =
              placementKey != null
                ? chartPointDisplayLabel(placementKey)
                : undefined;
            return (
              <InterpretSignLinkCard
                key={`${link.sign}-${link.text}`}
                sign={link.sign}
                text={link.text}
                openLabel={openLabel}
                onOpen={pageIdx != null ? () => onGoToPage(pageIdx) : undefined}
              />
            );
          })}
        </SimpleGrid>
      ) : null}
      {writeup.emptyHouseParagraph ? (
        <Text
          fontSize={INTERPRET_BODY_FONT_SIZE}
          lineHeight="tall"
          color="fg"
          fontWeight="normal"
        >
          {writeup.emptyHouseParagraph}
        </Text>
      ) : null}
      {writeup.occupantsLeadIn ? (
        <Text
          fontSize={INTERPRET_BODY_FONT_SIZE}
          lineHeight="tall"
          color="fg"
          fontWeight="normal"
        >
          {writeup.occupantsLeadIn}
        </Text>
      ) : null}
      {writeup.occupants.length > 0 ? (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap="3" w="100%">
          {writeup.occupants.map((occ) => {
            const placementIdx = interpretPlacementPageIndex(pages, occ.chartKey);
            return (
              <InterpretHouseOccupantCard
                key={occ.chartKey}
                occupant={occ}
                onOpen={
                  placementIdx != null ? () => onGoToPage(placementIdx) : undefined
                }
              />
            );
          })}
        </SimpleGrid>
      ) : null}
    </Stack>
  );
}

function InterpretPageBody({
  page,
  chart,
  pages,
  onGoToPage,
}: {
  page: InterpretPage;
  chart: NatalChartPayload;
  pages: InterpretPage[];
  onGoToPage: (pageIndex: number) => void;
}) {
  if (page.kind === "placement") {
    const accent = signCardAccent(page.tile.sign);
    return (
      <Box
        borderRadius="xl"
        bg={accent.bg}
        p={{ base: "4", md: "5" }}
        minH={{ base: "240px", md: "260px" }}
      >
        <Box
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          boxShadow="sm"
          p={{ base: "5", md: "6" }}
        >
          <Stack gap="4" w="100%">
            <InterpretPlacementPageContent
              tile={page.tile}
              chart={chart}
              pages={pages}
              onGoToPage={onGoToPage}
            />
            <InterpretSearchSuggestions
              items={buildInterpretSearchSuggestions(page, chart)}
            />
          </Stack>
        </Box>
      </Box>
    );
  }

  if (page.kind === "sign") {
    const accent = signCardAccent(page.sign);
    return (
      <Box
        borderRadius="xl"
        borderWidth="1px"
        borderColor={accent.borderColor}
        bg={accent.bg}
        p={{ base: "4", md: "5" }}
        minH={{ base: "240px", md: "260px" }}
      >
        <Box
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          borderLeftWidth="3px"
          borderLeftColor={accent.borderColor}
          borderRadius="xl"
          boxShadow="sm"
          p={{ base: "5", md: "6" }}
        >
          <Stack gap="4" w="100%">
            <InterpretSignPageContent
              sign={page.sign}
              chart={chart}
              pages={pages}
              onGoToPage={onGoToPage}
            />
            <InterpretSearchSuggestions
              items={buildInterpretSearchSuggestions(page, chart)}
            />
          </Stack>
        </Box>
      </Box>
    );
  }

  const houseWriteup = buildHouseInterpretWriteup(page.house, chart);
  const accent = signCardAccent(houseWriteup?.cuspSign ?? "aries");

  return (
    <Box
      borderRadius="xl"
      borderWidth="1px"
      borderColor={accent.borderColor}
      bg={accent.bg}
      p={{ base: "4", md: "5" }}
      minH={{ base: "240px", md: "260px" }}
    >
      <Box
        bg="bg.panel"
        borderWidth="1px"
        borderColor="border"
        borderLeftWidth="3px"
        borderLeftColor={accent.borderColor}
        borderRadius="xl"
        boxShadow="sm"
        p={{ base: "5", md: "6" }}
      >
        <Stack gap="4" w="100%">
          <InterpretHousePageContent
            house={page.house}
            chart={chart}
            pages={pages}
            onGoToPage={onGoToPage}
          />
          <InterpretSearchSuggestions
            items={buildInterpretSearchSuggestions(page, chart)}
          />
        </Stack>
      </Box>
    </Box>
  );
}

function InterpretPagerControls({
  atStart,
  atEnd,
  onPrevious,
  onNext,
  pagerLabel,
  planetSymbol,
  pageIndex,
  pageCount,
}: {
  atStart: boolean;
  atEnd: boolean;
  onPrevious: () => void;
  onNext: () => void;
  pagerLabel: string;
  planetSymbol: string | null;
  pageIndex: number;
  pageCount: number;
}) {
  return (
    <HStack justify="space-between" align="center" w="100%" flexWrap="wrap" gap="2">
      <PondButton
        size="sm"
        variant="outline"
        colorPalette="sky"
        disabled={atStart}
        onClick={onPrevious}
      >
        Previous
      </PondButton>
      <HStack gap="1.5" fontSize={APP_TEXT_SIZES.helper} color="fg.muted" fontWeight="medium">
        {planetSymbol ? (
          <Text as="span" aria-hidden="true">
            {planetSymbol}
          </Text>
        ) : null}
        <Text as="span">
          {pagerLabel} · {pageIndex + 1} of {pageCount}
        </Text>
      </HStack>
      <PondButton
        size="sm"
        variant="outline"
        colorPalette="sky"
        disabled={atEnd}
        onClick={onNext}
      >
        Next
      </PondButton>
    </HStack>
  );
}

export default function ZodiacInterpretTabPanel({
  chart,
  includeHouses,
  includeRising,
}: ZodiacInterpretTabPanelProps) {
  // Match Clicker2 behavior: avoid waiting on `transitionend` when motion is reduced.
  const motionPaused = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const pages = useMemo(
    () => buildInterpretPages(chart, { includeHouses, includeRising }),
    [chart, includeHouses, includeRising],
  );
  const sectionNav = useMemo(() => buildInterpretSectionNav(pages), [pages]);
  const [renderIndex, setRenderIndex] = useState(0);
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [animatePager, setAnimatePager] = useState(false);
  const [pagerDirection, setPagerDirection] = useState<PagerDirection>(1);

  useEffect(() => {
    setRenderIndex(0);
    setPendingIndex(null);
    setAnimatePager(false);
  }, [pages]);

  const safeRenderIndex =
    pages.length > 0 ? Math.min(renderIndex, pages.length - 1) : 0;
  const page = pages[safeRenderIndex];
  const uiIndex = pendingIndex ?? safeRenderIndex;
  const uiPage = pages[uiIndex];
  const atStart = uiIndex === 0;
  const atEnd = pages.length > 0 && uiIndex === pages.length - 1;
  const isMobile = useIsMobile();

  const requestPageChange = useCallback(
    (nextIndex: number) => {
      if (pages.length === 0) return;
      const next = Math.max(0, Math.min(pages.length - 1, nextIndex));
      const current = safeRenderIndex;
      if (next === current) {
        setPendingIndex(null);
        setAnimatePager(false);
        return;
      }

      const delta = next - current;
      const consecutive = Math.abs(delta) === 1;
      if (!consecutive || motionPaused) {
        setRenderIndex(next);
        setPendingIndex(null);
        setAnimatePager(false);
        return;
      }

      // Consecutive step: slide toward the target, then commit on transition end.
      setPendingIndex(next);
      setPagerDirection(delta < 0 ? -1 : 1);
      setAnimatePager(true);
    },
    [motionPaused, pages.length, safeRenderIndex],
  );

  const goPrevious = useCallback(() => {
    requestPageChange(uiIndex - 1);
  }, [requestPageChange, uiIndex]);

  const goNext = useCallback(() => {
    requestPageChange(uiIndex + 1);
  }, [requestPageChange, uiIndex]);

  const swipeNavigate = useHorizontalSwipeNavigate({
    enabled: isMobile && pages.length > 0,
    onSwipeLeft: atEnd ? undefined : goNext,
    onSwipeRight: atStart ? undefined : goPrevious,
  });

  const activeSection: InterpretSectionId | null = page
    ? interpretPageSection(page)
    : null;

  const activeSectionSubTabs = useMemo(
    () => (activeSection ? buildInterpretPageSubTabs(pages, activeSection, chart) : []),
    [pages, activeSection, chart],
  );

  const activeSubTabValue = page ? interpretPageSubTabValue(page) : null;

  const jumpToSection = useCallback(
    (sectionId: string) => {
      const target = sectionNav.find((s) => s.id === sectionId);
      if (target) requestPageChange(target.startIndex);
    },
    [sectionNav],
  );

  const jumpToSubTab = useCallback(
    (value: string) => {
      const target = activeSectionSubTabs.find((t) => t.value === value);
      if (target) requestPageChange(target.pageIndex);
    },
    [activeSectionSubTabs],
  );

  if (pages.length === 0 || !page || !uiPage) {
    return (
      <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted" lineHeight="tall">
        Placement data is not available for interpretation yet.
      </Text>
    );
  }

  const pagerLabel = interpretPageLabel(uiPage);
  const planetSymbol =
    uiPage.kind === "placement" ? bodySymbolForTileId(uiPage.tile.id) : null;

  const pagerControls = (
    <InterpretPagerControls
      atStart={atStart}
      atEnd={atEnd}
      onPrevious={goPrevious}
      onNext={goNext}
      pagerLabel={pagerLabel}
      planetSymbol={planetSymbol}
      pageIndex={uiIndex}
      pageCount={pages.length}
    />
  );

  const prevPage = safeRenderIndex > 0 ? pages[safeRenderIndex - 1] : null;
  const nextPage =
    safeRenderIndex < pages.length - 1 ? pages[safeRenderIndex + 1] : null;

  // Track is 300% wide; percent transforms are relative to that width.
  // Center slot starts at -33.333% (one panel), animates to 0% or -66.666%.
  const PANEL_SHIFT_PCT = 100 / 3;
  const trackTransformPct = animatePager
    ? pagerDirection === 1
      ? -2 * PANEL_SHIFT_PCT
      : 0
    : -PANEL_SHIFT_PCT;

  const onPagerTransitionEnd = useCallback(() => {
    if (!animatePager) return;
    if (pendingIndex == null) {
      setAnimatePager(false);
      return;
    }
    setAnimatePager(false);
    setPendingIndex(null);
    setRenderIndex(pendingIndex);
  }, [animatePager, pendingIndex]);

  return (
    <Stack gap="4" w="100%">
      {pagerControls}

      <Stack gap="1" w="100%">
        {SHOW_INTERPRET_TABS && sectionNav.length > 1 && activeSection ? (
          <Tabs.Root
            value={activeSection}
            onValueChange={(d) => jumpToSection(d.value)}
            variant="plain"
          >
            <Tabs.List
              {...ZODIAC_INTERPRET_SECTION_TAB_LIST_PROPS}
              aria-label="Interpret sections"
            >
              {sectionNav.map((section) => (
                <Tabs.Trigger
                  key={section.id}
                  value={section.id}
                  {...ZODIAC_INTERPRET_SECTION_TAB_TRIGGER_PROPS}
                >
                  {section.label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
        ) : null}

        {SHOW_INTERPRET_TABS && activeSectionSubTabs.length > 0 && activeSubTabValue ? (
          <Tabs.Root
            value={activeSubTabValue}
            onValueChange={(d) => jumpToSubTab(d.value)}
            variant="plain"
          >
            <Tabs.List
              {...ZODIAC_INTERPRET_SUBTAB_LIST_PROPS}
              aria-label={`${activeSection === "planets" ? "Planets" : activeSection === "houses" ? "Houses" : "Signs"} in this chart`}
            >
              {activeSectionSubTabs.map((subTab) => (
                <Tabs.Trigger
                  key={subTab.value}
                  value={subTab.value}
                  {...ZODIAC_INTERPRET_SUBTAB_TRIGGER_PROPS}
                  bg="transparent"
                  borderWidth="1px"
                  borderColor="transparent"
                  _selected={{
                    bg: subTab.selectedBg,
                    color: subTab.selectedColor,
                    borderWidth: "1px",
                    borderColor: subTab.selectedBorderColor,
                  }}
                  css={{
                    "&[data-selected]": {
                      backgroundColor: subTab.selectedBg,
                      color: subTab.selectedColor,
                      borderColor: subTab.selectedBorderColor,
                    },
                  }}
                  display="inline-flex"
                  alignItems="center"
                  justifyContent="center"
                  textAlign="center"
                  minW="2.25rem"
                  fontSize="md"
                  lineHeight="1"
                  aria-label={subTab.ariaLabel}
                  title={subTab.ariaLabel}
                >
                  {subTab.tabLabel}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs.Root>
        ) : null}
      </Stack>

      <Box
        className="zodiacInterpretPagerViewport"
        w="100%"
        onTouchStart={swipeNavigate.onTouchStart}
        onTouchEnd={swipeNavigate.onTouchEnd}
      >
        {animatePager ? (
          <Flex
            className={
              !motionPaused
                ? "zodiacInterpretPagerTrack zodiacInterpretPagerTrack--animate"
                : "zodiacInterpretPagerTrack"
            }
            style={{ transform: `translateX(${trackTransformPct}%)` }}
            onTransitionEnd={onPagerTransitionEnd}
          >
            <Box className="zodiacInterpretPagerPanel">
              {prevPage ? (
                <InterpretPageBody
                  page={prevPage}
                  chart={chart}
                  pages={pages}
                  onGoToPage={requestPageChange}
                />
              ) : null}
            </Box>
            <Box className="zodiacInterpretPagerPanel">
              <InterpretPageBody
                page={page}
                chart={chart}
                pages={pages}
                onGoToPage={requestPageChange}
              />
            </Box>
            <Box className="zodiacInterpretPagerPanel">
              {nextPage ? (
                <InterpretPageBody
                  page={nextPage}
                  chart={chart}
                  pages={pages}
                  onGoToPage={requestPageChange}
                />
              ) : null}
            </Box>
          </Flex>
        ) : (
          <InterpretPageBody
            page={page}
            chart={chart}
            pages={pages}
            onGoToPage={requestPageChange}
          />
        )}
      </Box>

      {pagerControls}
    </Stack>
  );
}
