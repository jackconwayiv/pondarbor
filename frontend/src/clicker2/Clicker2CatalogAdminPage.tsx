/**
 * Staff-only reference view of the PondClicker Redux catalog.
 * Open from the lobby or directly: `/clicker/dev/redux-catalog`
 */
import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  Grid,
  Heading,
  HStack,
  Stack,
  Tabs,
  Text,
} from "@chakra-ui/react";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { auth0LoginAuthorizationParams } from "../auth/auth0LoginParams";
import { PanelBlockSkeleton } from "../components/panelStatus";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TAB_LIST_INSET_PROPS,
  APP_SHELL_TAB_LIST_NESTED_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { DESIGN } from "../theme/tokens";

import {
  EVOLUTION_LABEL,
  EVOLUTIONS_LABEL,
  EVOLUTIONS_LABEL_LOWER,
} from "./clicker2Copy";
import {
  DENIZENS,
  getDenizenDef,
  getDenizenIndex,
  nextDenizenCost,
} from "./denizens";
import {
  buildDenizenFirstMilestones,
  GLOBAL_MILESTONES,
  MILESTONE_CATALOG_SECTIONS,
  MILESTONES,
  milestoneDisplayEmoji,
  milestonesInCatalogSection,
  type MilestoneCatalogSectionId,
  type MilestoneDef,
} from "./milestones";
import {
  formatPaybackDuration,
  marginalValueAtUnlock,
  paybackSec,
} from "./evolutionPricing";
import {
  CLICK_CHAIN_EMOJI,
  evolutionDisplayEmoji,
  PAIRING_EVOLUTION_EMOJI,
  POND_PRODUCTION_EMOJI,
} from "./clicker2OwnedEvolutions";
import {
  formatPairingUnlockSummary,
  listPairingSpecialties,
  PAIRING_CATALOG_UNLOCK_NOTES,
  PAIRING_LOWER_DENIZEN_IDS,
  PAIRING_SPECIALTY_DENIZEN_ID,
  pairingLowerDenizenTierIndexForId,
  pairingUnlockFormulaDescription,
} from "./pairingEvolutions";
import { formatEnergyAmount, formatEnergyRate, formatShopCost } from "./formatEnergy";
import { specialtyTierGradient } from "./specialtyTierColors";
import { POLLINATOR_SPECIALTY_DENIZEN_ID } from "./pollinatorEvolutions";
import {
  CLICK_SPECIALTY_DENIZEN_ID,
  POND_SPECIALTY_DENIZEN_ID,
  specialtiesForDenizen,
  specialtyTierIndex,
  SPECIALTIES,
  type SpecialtyDef,
} from "./specialties";
import {
  HEADLINE_CATALOG_GLOBAL_NOTES,
  HEADLINES,
  headlineDisplayLines,
  headlineUnlockCriteriaText,
  type HeadlineDef,
} from "./headlines";
import {
  WEATHER_CATALOG_GLOBAL_NOTES,
  WEATHER_EVENT_CATALOG,
  type WeatherEventCatalogEntry,
} from "./weatherEvents";

const CARD_SHELL_PROPS = {
  ...PANEL_ENTRY_CARD_PROPS,
  p: { base: "2", md: "2" },
} as const;

function CatalogFramedChrome({ children }: { children: ReactNode }) {
  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
            {children}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}

function specialtyUnlockSummary(s: SpecialtyDef): string {
  if (s.pairingUnlock) {
    return formatPairingUnlockSummary(s);
  }
  if (s.unlockAllTimeEnergy != null) {
    return `${formatEnergyAmount(s.unlockAllTimeEnergy)} all-time earned`;
  }
  if (s.unlockClickEnergy != null) {
    return `${formatEnergyAmount(s.unlockClickEnergy)} energy from clicking`;
  }
  if (s.unlockBlossoms != null) {
    return `${s.unlockBlossoms.toLocaleString()} Blossoms`;
  }
  const def = getDenizenDef(s.denizenId);
  const label = def?.namePlural ?? s.denizenId;
  return `${s.unlockOwned.toLocaleString()} ${label} owned`;
}

function pairingSourcePerStepFromDef(def: SpecialtyDef): number | null {
  const scaling = def.effects?.find(
    (e) => e.type === "denizen_eps_percent_per_denizen",
  );
  return scaling?.type === "denizen_eps_percent_per_denizen"
    ? scaling.sourcePerStep
    : null;
}

function SpecialtyTierTitleCard({
  def,
  tierIndex,
}: {
  def: SpecialtyDef;
  tierIndex: number;
}) {
  const denizenLabel =
    def.denizenId === POND_SPECIALTY_DENIZEN_ID
      ? "pond"
      : (getDenizenDef(def.denizenId)?.name ?? def.denizenId);

  return (
    <Box
      {...PANEL_ENTRY_CARD_PROPS}
      bg={specialtyTierGradient(tierIndex)}
      borderColor="blackAlpha.200"
      py="2"
      px="3"
    >
      <HStack gap="2" align="flex-start">
        <Text fontSize="lg" lineHeight="1" aria-hidden>
          {evolutionDisplayEmoji(def)}
        </Text>
        <Stack gap="0.5" flex="1" minW="0">
          <Text fontWeight="bold" fontSize="sm" lineHeight="1.25">
            #{def.id} {def.name}
          </Text>
          <Text fontSize="2xs" color="gray.700" fontFamily="mono" lineHeight="1.25">
            Tier {tierIndex + 1} · {denizenLabel}
          </Text>
        </Stack>
      </HStack>
    </Box>
  );
}

function SpecialtyCatalogCard({ def }: { def: SpecialtyDef }) {
  const denizenLabel =
    def.denizenId === POND_SPECIALTY_DENIZEN_ID
      ? "pond"
      : (getDenizenDef(def.denizenId)?.name ?? def.denizenId);
  const { marginalEps, marginalClick, incomePerSec } = marginalValueAtUnlock(def);
  const payback = paybackSec(def.price, incomePerSec);

  return (
    <Box {...CARD_SHELL_PROPS}>
      <Stack gap="1" fontSize="xs">
        <Text>
          <Text as="span" fontWeight="semibold">
            Price:
          </Text>{" "}
          {formatShopCost(def.price)}
        </Text>
        <Text>
          <Text as="span" fontWeight="semibold">
            Marginal at unlock:
          </Text>{" "}
          {formatEnergyRate(marginalEps)} EpS
          {def.denizenId === "ripples" && marginalClick > 0
            ? ` · +${formatEnergyAmount(marginalClick)} click`
            : null}
        </Text>
        <Text>
          <Text as="span" fontWeight="semibold">
            Payback:
          </Text>{" "}
          {formatPaybackDuration(payback)} (ref. income{" "}
          {formatEnergyRate(incomePerSec)}/s)
        </Text>
        <Text>
          <Text as="span" fontWeight="semibold">
            Unlock:
          </Text>{" "}
          {specialtyUnlockSummary(def)}
        </Text>
        {def.pairingUnlock &&
        def.pairingLowerDenizenId &&
        def.pairingHigherDenizenId ? (
          <Text color="gray.600" fontFamily="mono" fontSize="2xs" lineHeight="1.35">
            {pairingUnlockFormulaDescription(
              def.pairingLowerDenizenId,
              def.pairingHigherDenizenId,
            )}
          </Text>
        ) : null}
        <Text>
          <Text as="span" fontWeight="semibold">
            Gate:
          </Text>{" "}
          {denizenLabel}
        </Text>
        <Text>
          <Text as="span" fontWeight="semibold">
            Effect:
          </Text>{" "}
          {def.effectText}
        </Text>
        <Text color="gray.600" lineHeight="1.35">
          {def.ecologyNote}
        </Text>
      </Stack>
    </Box>
  );
}

function WeatherEventCatalogCard({ def }: { def: WeatherEventCatalogEntry }) {
  return (
    <Box {...CARD_SHELL_PROPS}>
      <HStack gap="2" align="flex-start" mb="1">
        <Text fontSize="xl" lineHeight="1" aria-hidden>
          {def.emoji}
        </Text>
        <Stack gap="0.5" flex="1" minW="0">
          <Text fontWeight="bold" fontSize="sm">
            {def.name}
          </Text>
          <Text fontSize="2xs" color="gray.600" fontFamily="mono">
            {def.variantId} · {def.family}
          </Text>
        </Stack>
      </HStack>
      <Stack gap="1" fontSize="xs">
        <Text>
          <Text as="span" fontWeight="semibold">
            Spawn chance:
          </Text>{" "}
          {def.spawnChancePercent}%
        </Text>
        <Text>
          <Text as="span" fontWeight="semibold">
            On click:
          </Text>{" "}
          {def.effectSummary}
        </Text>
        {def.notes.map((note) => (
          <Text key={note} color="gray.600" lineHeight="1.35">
            {note}
          </Text>
        ))}
      </Stack>
    </Box>
  );
}

function MilestoneCatalogCard({ def }: { def: MilestoneDef }) {
  const emoji = milestoneDisplayEmoji(def);

  return (
    <Box
      {...CARD_SHELL_PROPS}
      borderColor={DESIGN.nautical}
      borderWidth="2px"
    >
      <HStack gap="2" align="flex-start" mb="1">
        {emoji ? (
          <Text fontSize="xl" lineHeight="1" aria-hidden>
            {emoji}
          </Text>
        ) : null}
        <Stack gap="0.5" flex="1" minW="0">
          <Text fontWeight="bold" fontSize="sm">
            {def.title}
          </Text>
          <Text fontSize="2xs" color="gray.600" fontFamily="mono">
            {def.id}
          </Text>
        </Stack>
      </HStack>
      <Stack gap="1" fontSize="xs">
        <Text lineHeight="1.35">{def.description}</Text>
        <Text>
          <Text as="span" fontWeight="semibold">
            Unlock:
          </Text>{" "}
          {def.criteriaText}
        </Text>
        <Text fontSize="2xs" color="gray.600">
          kind: {def.kind}
        </Text>
      </Stack>
    </Box>
  );
}

function MilestoneCatalogSectionPage({
  sectionId,
}: {
  sectionId: MilestoneCatalogSectionId;
}) {
  const section = MILESTONE_CATALOG_SECTIONS.find((s) => s.id === sectionId)!;
  const defs = milestonesInCatalogSection(sectionId);

  return (
    <Stack gap="2">
      <Heading as="h2" size="sm">
        {section.label}
      </Heading>
      <Text fontSize="xs" color="gray.600" lineHeight="1.35">
        {section.blurb}
      </Text>
      <Grid
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
        gap="2"
      >
        {defs.map((def) => (
          <MilestoneCatalogCard key={def.id} def={def} />
        ))}
      </Grid>
    </Stack>
  );
}

function MilestoneCatalogSectionTabTrigger({
  sectionId,
}: {
  sectionId: MilestoneCatalogSectionId;
}) {
  const section = MILESTONE_CATALOG_SECTIONS.find((s) => s.id === sectionId)!;
  const count = milestonesInCatalogSection(sectionId).length;

  return (
    <Tabs.Trigger
      value={sectionId}
      {...APP_SHELL_TAB_TRIGGER_PROPS}
      fontSize={APP_TEXT_SIZES.label}
      px="2.5"
      py="1.5"
      aria-label={`${section.label} (${count} milestones)`}
      title={section.label}
    >
      <Text as="span" fontSize="lg" lineHeight="1" aria-hidden>
        {section.emoji}
      </Text>
    </Tabs.Trigger>
  );
}

function MilestonesCatalogBySection({
  sectionTab,
  onSectionTabChange,
}: {
  sectionTab: MilestoneCatalogSectionId;
  onSectionTabChange: (sectionId: MilestoneCatalogSectionId) => void;
}) {
  const sections = MILESTONE_CATALOG_SECTIONS;
  const activeSection = sections.some((s) => s.id === sectionTab)
    ? sectionTab
    : sections[0]!.id;

  return (
    <Stack gap="3">
      <Box {...CARD_SHELL_PROPS}>
        <Stack gap="1" fontSize="xs">
          <Text fontWeight="semibold" fontSize="sm">
            Catalog source
          </Text>
          <Text color="gray.600" lineHeight="1.35">
            {GLOBAL_MILESTONES.length} hand-authored globals in{" "}
            <Text as="span" fontFamily="mono">
              GLOBAL_MILESTONES
            </Text>
            ; {buildDenizenFirstMilestones().length} denizen-first entries from{" "}
            <Text as="span" fontFamily="mono">
              DENIZENS
            </Text>
            . Tabs group by unlock function in{" "}
            <Text as="span" fontFamily="mono">
              milestones.ts
            </Text>
            .
          </Text>
        </Stack>
      </Box>
      <Tabs.Root
        value={activeSection}
        variant="plain"
        w="100%"
        onValueChange={(details) =>
          onSectionTabChange(details.value as MilestoneCatalogSectionId)
        }
      >
        <Tabs.List {...APP_SHELL_TAB_LIST_NESTED_PROPS}>
          {sections.map((section) => (
            <MilestoneCatalogSectionTabTrigger
              key={section.id}
              sectionId={section.id}
            />
          ))}
        </Tabs.List>
        {sections.map((section) => (
          <Tabs.Content key={section.id} value={section.id} pt="3">
            <MilestoneCatalogSectionPage sectionId={section.id} />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </Stack>
  );
}

function HeadlineCatalogCard({ def }: { def: HeadlineDef }) {
  return (
    <Box {...CARD_SHELL_PROPS}>
      <Stack gap="0.5" mb="1">
        <Text fontWeight="bold" fontSize="sm" fontStyle="italic" lineHeight="1.35">
          {headlineDisplayLines(def.text).map((line, index) => (
            <span key={index}>
              {index > 0 ? <br /> : null}
              {line}
            </span>
          ))}
        </Text>
        <Text fontSize="2xs" color="gray.600" fontFamily="mono">
          {def.id}
        </Text>
      </Stack>
      <Stack gap="1" fontSize="xs">
        <Text>
          <Text as="span" fontWeight="semibold">
            Unlock:
          </Text>{" "}
          {headlineUnlockCriteriaText(def)}
        </Text>
        <Text fontSize="2xs" color="gray.600" fontFamily="mono">
          unlockEps: {def.unlockEps}
        </Text>
      </Stack>
    </Box>
  );
}

function HeadlinesCatalogPanel() {
  return (
    <Stack gap="3">
      <Box {...CARD_SHELL_PROPS}>
        <Stack gap="1" fontSize="xs">
          <Text fontWeight="semibold" fontSize="sm">
            Global behavior
          </Text>
          {HEADLINE_CATALOG_GLOBAL_NOTES.map((note) => (
            <Text key={note} color="gray.600" lineHeight="1.35">
              {note}
            </Text>
          ))}
          <Text color="gray.600" lineHeight="1.35" pt="1">
            Catalog source:{" "}
            <Text as="span" fontFamily="mono">
              headlines.ts
            </Text>
            {" · "}
            {HEADLINES.length} EpS tiers
          </Text>
        </Stack>
      </Box>
      <Grid
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
        gap="2"
      >
        {HEADLINES.map((def) => (
          <HeadlineCatalogCard key={def.id} def={def} />
        ))}
      </Grid>
    </Stack>
  );
}

function WeatherCatalogPanel() {
  return (
    <Stack gap="3">
      <Box {...CARD_SHELL_PROPS}>
        <Stack gap="1" fontSize="xs">
          <Text fontWeight="semibold" fontSize="sm">
            Global timing
          </Text>
          {WEATHER_CATALOG_GLOBAL_NOTES.map((note) => (
            <Text key={note} color="gray.600" lineHeight="1.35">
              {note}
            </Text>
          ))}
        </Stack>
      </Box>
      <Grid
        templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
        gap="2"
      >
        {WEATHER_EVENT_CATALOG.map((def) => (
          <WeatherEventCatalogCard key={def.variantId} def={def} />
        ))}
      </Grid>
    </Stack>
  );
}

function DenizenCatalogCard({
  def,
  index,
}: {
  def: (typeof DENIZENS)[number];
  index: number;
}) {
  const cost1 = nextDenizenCost(def, 1);

  return (
    <Box {...CARD_SHELL_PROPS}>
      <HStack gap="2" align="flex-start" mb="1">
        <Text fontSize="xl" lineHeight="1" aria-hidden>
          {def.emoji}
        </Text>
        <Stack gap="0.5" flex="1" minW="0">
          <Text fontWeight="bold" fontSize="sm">
            {index + 1}. {def.name}
          </Text>
          <Text fontSize="2xs" color="gray.600" fontFamily="mono">
            {def.id}
          </Text>
        </Stack>
      </HStack>
      <Stack gap="1" fontSize="xs">
        <Text>
          <Text as="span" fontWeight="semibold">
            Base cost:
          </Text>{" "}
          {formatShopCost(def.baseCost)}
          {cost1 != null ? (
            <>
              {" "}
              → {formatShopCost(cost1)} (2nd copy, ×1.15)
            </>
          ) : null}
        </Text>
        <Text>
          <Text as="span" fontWeight="semibold">
            EpS:
          </Text>{" "}
          {formatEnergyRate(def.baseEps)}/copy
        </Text>
        <Text>
          <Text as="span" fontWeight="semibold">
            Max owned:
          </Text>{" "}
          {def.maxOwned.toLocaleString()}
        </Text>
        <Text color="gray.600" lineHeight="1.35">
          {def.ecologyNote}
        </Text>
      </Stack>
    </Box>
  );
}

const CATALOG_DENIZEN_ORDER: readonly string[] = [
  POND_SPECIALTY_DENIZEN_ID,
  CLICK_SPECIALTY_DENIZEN_ID,
  POLLINATOR_SPECIALTY_DENIZEN_ID,
  ...DENIZENS.map((d) => d.id),
];

const SPECIALTY_CATALOG_CHAIN_IDS: readonly string[] = CATALOG_DENIZEN_ORDER.filter(
  (id) =>
    specialtiesForDenizen(id).length > 0 &&
    id !== PAIRING_SPECIALTY_DENIZEN_ID,
);

function specialtyCatalogChainLabel(denizenId: string): string {
  if (denizenId === POND_SPECIALTY_DENIZEN_ID) return "Pond production";
  if (denizenId === CLICK_SPECIALTY_DENIZEN_ID) return "Click reflections";
  if (denizenId === POLLINATOR_SPECIALTY_DENIZEN_ID) return "Pollinators";
  if (denizenId === PAIRING_SPECIALTY_DENIZEN_ID) return "Pairing";
  return getDenizenDef(denizenId)?.namePlural ?? denizenId;
}

function specialtyCatalogChainEmoji(denizenId: string): string {
  if (denizenId === POND_SPECIALTY_DENIZEN_ID) return POND_PRODUCTION_EMOJI;
  if (denizenId === CLICK_SPECIALTY_DENIZEN_ID) return CLICK_CHAIN_EMOJI;
  if (denizenId === POLLINATOR_SPECIALTY_DENIZEN_ID) return "🐝";
  if (denizenId === PAIRING_SPECIALTY_DENIZEN_ID) return PAIRING_EVOLUTION_EMOJI;
  return getDenizenDef(denizenId)?.emoji ?? "✨";
}

function PairingCatalogLowerPanel({ lowerDenizenId }: { lowerDenizenId: string }) {
  const lowerDef = getDenizenDef(lowerDenizenId);
  const tierIndex = pairingLowerDenizenTierIndexForId(lowerDenizenId);

  const chain = listPairingSpecialties(SPECIALTIES)
    .filter((def) => def.pairingLowerDenizenId === lowerDenizenId)
    .sort(
      (a, b) =>
        getDenizenIndex(a.pairingHigherDenizenId ?? "") -
        getDenizenIndex(b.pairingHigherDenizenId ?? ""),
    );

  return (
    <Stack gap="2">
      <Heading as="h3" size="sm">
        {lowerDef?.emoji} {lowerDef?.namePlural ?? lowerDenizenId} → … (
        {chain.length})
      </Heading>
      <Grid
        templateColumns={{
          base: "1fr",
          md: "repeat(2, 1fr)",
          lg: "repeat(3, 1fr)",
        }}
        gap="2"
      >
        {chain.map((def) => {
          const step = pairingSourcePerStepFromDef(def);
          const h = def.pairingHigherDenizenId
            ? getDenizenDef(def.pairingHigherDenizenId)
            : undefined;
          return (
            <Stack key={def.id} gap="1" minW="0">
              <Box
                {...PANEL_ENTRY_CARD_PROPS}
                bg={specialtyTierGradient(tierIndex)}
                borderColor="blackAlpha.200"
                py="2"
                px="3"
              >
                <HStack gap="2" align="flex-start">
                  <Text fontSize="lg" lineHeight="1" aria-hidden>
                    {evolutionDisplayEmoji(def)}
                  </Text>
                  <Stack gap="0.5" flex="1" minW="0">
                    <Text fontWeight="bold" fontSize="sm" lineHeight="1.25">
                      #{def.id} {def.name}
                    </Text>
                    <Text
                      fontSize="2xs"
                      color="gray.700"
                      fontFamily="mono"
                      lineHeight="1.25"
                    >
                      → {h?.namePlural ?? "?"}
                      {step != null ? ` · per ${step}` : null}
                    </Text>
                  </Stack>
                </HStack>
              </Box>
              <SpecialtyCatalogCard def={def} />
            </Stack>
          );
        })}
      </Grid>
    </Stack>
  );
}

function PairingCatalogLowerTabTrigger({
  lowerDenizenId,
}: {
  lowerDenizenId: string;
}) {
  const def = getDenizenDef(lowerDenizenId);
  const count = listPairingSpecialties(SPECIALTIES).filter(
    (s) => s.pairingLowerDenizenId === lowerDenizenId,
  ).length;

  return (
    <Tabs.Trigger
      value={lowerDenizenId}
      {...APP_SHELL_TAB_TRIGGER_PROPS}
      fontSize={APP_TEXT_SIZES.label}
      px="2.5"
      py="1.5"
      aria-label={`${def?.namePlural ?? lowerDenizenId} booster (${count})`}
      title={def?.namePlural ?? lowerDenizenId}
    >
      <Text as="span" fontSize="lg" lineHeight="1" aria-hidden>
        {def?.emoji ?? "✨"}
      </Text>
    </Tabs.Trigger>
  );
}

function PairingCatalogPage() {
  const [lowerTab, setLowerTab] = useState(
    () => PAIRING_LOWER_DENIZEN_IDS[0] ?? "ripples",
  );
  const total = listPairingSpecialties(SPECIALTIES).length;
  const activeLower = PAIRING_LOWER_DENIZEN_IDS.includes(lowerTab)
    ? lowerTab
    : PAIRING_LOWER_DENIZEN_IDS[0];

  return (
    <Stack gap="3">
      <Heading as="h2" size="sm">
        Pairing {EVOLUTIONS_LABEL_LOWER} ({total})
      </Heading>
      <Box {...CARD_SHELL_PROPS}>
        <Stack gap="1" fontSize="xs">
          <Text fontWeight="semibold" fontSize="sm">
            Unlock rules
          </Text>
          {PAIRING_CATALOG_UNLOCK_NOTES.map((note) => (
            <Text key={note} color="gray.600" lineHeight="1.35">
              {note}
            </Text>
          ))}
        </Stack>
      </Box>
      <Text fontSize="xs" color="gray.600">
        By booster (L) denizen — card colors match shop color tiers (Ripples =
        palest; capped at tier 14 for display only).
      </Text>
      <Tabs.Root
        value={activeLower}
        variant="plain"
        w="100%"
        onValueChange={(details) => setLowerTab(details.value)}
      >
        <Tabs.List {...APP_SHELL_TAB_LIST_NESTED_PROPS} flexWrap="wrap">
          {PAIRING_LOWER_DENIZEN_IDS.map((denizenId) => (
            <PairingCatalogLowerTabTrigger
              key={denizenId}
              lowerDenizenId={denizenId}
            />
          ))}
        </Tabs.List>
        {PAIRING_LOWER_DENIZEN_IDS.map((denizenId) => (
          <Tabs.Content key={denizenId} value={denizenId} pt="3">
            <PairingCatalogLowerPanel lowerDenizenId={denizenId} />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </Stack>
  );
}

function SpecialtiesCatalogChainPage({
  denizenId,
}: {
  denizenId: string;
}) {
  const chain = specialtiesForDenizen(denizenId);
  const heading = specialtyCatalogChainLabel(denizenId);

  return (
    <Stack gap="2">
      <Heading as="h2" size="sm">
        {heading}
      </Heading>
      <Grid
        templateColumns={{
          base: "1fr",
          md: "repeat(2, 1fr)",
          lg: "repeat(3, 1fr)",
        }}
        gap="2"
      >
        {chain.map((def) => {
          const tierIndex = specialtyTierIndex(def);
          return (
            <Stack key={def.id} gap="1" minW="0">
              <SpecialtyTierTitleCard def={def} tierIndex={tierIndex} />
              <SpecialtyCatalogCard def={def} />
            </Stack>
          );
        })}
      </Grid>
    </Stack>
  );
}

function SpecialtyCatalogChainTabTrigger({ denizenId }: { denizenId: string }) {
  const label = specialtyCatalogChainLabel(denizenId);
  const count = specialtiesForDenizen(denizenId).length;

  return (
    <Tabs.Trigger
      value={denizenId}
      {...APP_SHELL_TAB_TRIGGER_PROPS}
      fontSize={APP_TEXT_SIZES.label}
      px="2.5"
      py="1.5"
      aria-label={`${label} (${count} ${EVOLUTIONS_LABEL_LOWER})`}
      title={label}
    >
      <Text as="span" fontSize="lg" lineHeight="1" aria-hidden>
        {specialtyCatalogChainEmoji(denizenId)}
      </Text>
    </Tabs.Trigger>
  );
}

const SPECIALTY_CATALOG_TAB_IDS: readonly string[] = [
  ...SPECIALTY_CATALOG_CHAIN_IDS,
  PAIRING_SPECIALTY_DENIZEN_ID,
];

function SpecialtiesCatalogByDenizen({
  chainTab,
  onChainTabChange,
}: {
  chainTab: string;
  onChainTabChange: (denizenId: string) => void;
}) {
  const chains = SPECIALTY_CATALOG_TAB_IDS;
  const activeChain = chains.includes(chainTab) ? chainTab : chains[0];

  if (chains.length === 0 || !activeChain) return null;

  return (
    <Tabs.Root
      value={activeChain}
      variant="plain"
      w="100%"
      onValueChange={(details) => onChainTabChange(details.value)}
    >
      <Tabs.List {...APP_SHELL_TAB_LIST_NESTED_PROPS}>
        {chains.map((denizenId) => (
          <SpecialtyCatalogChainTabTrigger key={denizenId} denizenId={denizenId} />
        ))}
      </Tabs.List>
      {SPECIALTY_CATALOG_CHAIN_IDS.map((denizenId) => (
        <Tabs.Content key={denizenId} value={denizenId} pt="3">
          <SpecialtiesCatalogChainPage denizenId={denizenId} />
        </Tabs.Content>
      ))}
      <Tabs.Content value={PAIRING_SPECIALTY_DENIZEN_ID} pt="3">
        <PairingCatalogPage />
      </Tabs.Content>
    </Tabs.Root>
  );
}

export default function Clicker2CatalogAdminPage() {
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const {
    sessionUser,
    isAuthenticated,
    isLoading,
    error: sessionError,
  } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [activeTab, setActiveTab] = useState("denizens");
  const [specialtyChainTab, setSpecialtyChainTab] = useState(
    () => SPECIALTY_CATALOG_CHAIN_IDS[0] ?? POND_SPECIALTY_DENIZEN_ID,
  );
  const [milestoneSectionTab, setMilestoneSectionTab] =
    useState<MilestoneCatalogSectionId>(
      () => MILESTONE_CATALOG_SECTIONS[0]!.id,
    );

  const backButton = (
    <PondButton
      type="button"
      size="sm"
      variant="outline"
      colorPalette="gray"
      onClick={() => navigate("/clicker")}
    >
      ← PondClicker
    </PondButton>
  );

  if (!isAuthenticated) {
    return (
      <CatalogFramedChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
            Redux catalog
          </Heading>
          <Stack gap="3" align="flex-start">
            <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
              Sign in to open this staff reference page.
            </Text>
            <HStack flexWrap="wrap" gap="2">
              <PondButton
                type="button"
                colorPalette="lilypad"
                size="sm"
                onClick={() =>
                  void loginWithRedirect({
                    authorizationParams: auth0LoginAuthorizationParams(),
                  })
                }
              >
                Log in
              </PondButton>
              {backButton}
            </HStack>
          </Stack>
        </Box>
      </CatalogFramedChrome>
    );
  }

  if (isAuthenticated && !sessionUser && !isLoading) {
    return (
      <CatalogFramedChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
            Redux catalog
          </Heading>
          <Text
            role="alert"
            fontSize={APP_TEXT_SIZES.body}
            lineHeight="tall"
            color="nautical.solid"
            fontWeight="medium"
            mb="3"
          >
            {sessionError ??
              "Could not load your account session. Try signing in again."}
          </Text>
          {backButton}
        </Box>
      </CatalogFramedChrome>
    );
  }

  if (isLoading || !sessionUser) {
    return (
      <CatalogFramedChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <PanelBlockSkeleton lines={2} showTitleLine />
        </Box>
      </CatalogFramedChrome>
    );
  }

  if (!isStaff) {
    return (
      <CatalogFramedChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
            Redux catalog
          </Heading>
          <Text
            fontSize={APP_TEXT_SIZES.body}
            lineHeight="tall"
            color="fg"
            mb="3"
          >
            Staff access required. This page lists every denizen and{" "}
            {EVOLUTION_LABEL.toLowerCase()} from PondClicker Redux for debugging
            and balance review.
          </Text>
          {backButton}
        </Box>
      </CatalogFramedChrome>
    );
  }

  return (
    <CatalogFramedChrome>
      <Box {...PANEL_ENTRY_CARD_PROPS}>
        <Stack gap="2" align="flex-start">
          {backButton}
          <Heading as="h1" size={{ base: "lg", md: "xl" }}>
            Redux catalog (staff)
          </Heading>
          <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600" lineHeight="tall">
            {DENIZENS.length} denizens, {SPECIALTIES.length} {EVOLUTIONS_LABEL_LOWER},{" "}
            {WEATHER_EVENT_CATALOG.length} weather events, {HEADLINES.length}{" "}
            headlines — mirrors{" "}
            <Text as="span" fontFamily="mono">
              denizens.ts
            </Text>
            ,{" "}
            <Text as="span" fontFamily="mono">
              specialties.ts
            </Text>
            ,{" "}
            <Text as="span" fontFamily="mono">
              weatherEvents.ts
            </Text>
            , and{" "}
            <Text as="span" fontFamily="mono">
              headlines.ts
            </Text>
            .
          </Text>
        </Stack>
      </Box>

      <Tabs.Root
        value={activeTab}
        variant="plain"
        w="100%"
        onValueChange={(details) => setActiveTab(details.value)}
      >
        <Tabs.List {...APP_SHELL_TAB_LIST_INSET_PROPS}>
          <Tabs.Trigger
            value="denizens"
            {...APP_SHELL_TAB_TRIGGER_PROPS}
            fontSize={APP_TEXT_SIZES.label}
          >
            Denizens ({DENIZENS.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="specialties"
            {...APP_SHELL_TAB_TRIGGER_PROPS}
            fontSize={APP_TEXT_SIZES.label}
          >
            {EVOLUTIONS_LABEL} ({SPECIALTIES.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="weather"
            {...APP_SHELL_TAB_TRIGGER_PROPS}
            fontSize={APP_TEXT_SIZES.label}
          >
            Weather ({WEATHER_EVENT_CATALOG.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="milestones"
            {...APP_SHELL_TAB_TRIGGER_PROPS}
            fontSize={APP_TEXT_SIZES.label}
          >
            Milestones ({MILESTONES.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="headlines"
            {...APP_SHELL_TAB_TRIGGER_PROPS}
            fontSize={APP_TEXT_SIZES.label}
          >
            Headlines ({HEADLINES.length})
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="denizens" pt="3">
          <Grid
            templateColumns={{ base: "1fr", md: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }}
            gap="2"
          >
            {DENIZENS.map((def, index) => (
              <DenizenCatalogCard key={def.id} def={def} index={index} />
            ))}
          </Grid>
        </Tabs.Content>

        <Tabs.Content value="specialties" pt="3">
          <SpecialtiesCatalogByDenizen
            chainTab={specialtyChainTab}
            onChainTabChange={setSpecialtyChainTab}
          />
        </Tabs.Content>

        <Tabs.Content value="weather" pt="3">
          <WeatherCatalogPanel />
        </Tabs.Content>

        <Tabs.Content value="milestones" pt="3">
          <MilestonesCatalogBySection
            sectionTab={milestoneSectionTab}
            onSectionTabChange={setMilestoneSectionTab}
          />
        </Tabs.Content>

        <Tabs.Content value="headlines" pt="3">
          <HeadlinesCatalogPanel />
        </Tabs.Content>
      </Tabs.Root>
    </CatalogFramedChrome>
  );
}
