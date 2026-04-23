/**
 * Staff-only reference view of the PondClicker upgrade catalog.
 * Intentionally not linked from the public UI — open directly:
 * `/clicker/dev/catalog`
 */
import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  Grid,
  Heading,
  HStack,
  Stack,
  Tabs,
  Tag,
  Text,
} from "@chakra-ui/react";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import { auth0LoginAuthorizationParams } from "../auth/auth0LoginParams";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TAB_LIST_INSET_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import {
  CATALOG_UPGRADES,
  FAMILY_PRESENTATION,
  POND_STAT_LABELS,
  RESOURCE_PRESENTATION,
  type UpgradeDef,
  type UpgradeEffect,
} from "./catalog";
import { requirementSummary } from "./ruleEngine";

/** Dense catalog cards: tighter padding for 2–3 column layouts. */
const UPGRADE_CARD_SHELL_PROPS = {
  ...PANEL_ENTRY_CARD_PROPS,
  p: { base: "2", md: "2" },
} as const;

/** Body / list copy inside upgrade cards (narrow columns). */
const UPGRADE_CARD_BODY = { base: "2xs", md: "xs" } as const;

const UPGRADE_CARD_SECTION_LABEL_PROPS = {
  fontSize: { base: "2xs", md: "xs" },
  fontWeight: "bold",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  color: "fg.muted",
  mb: "0.5",
} as const;

function ClickerCatalogFramedChrome({ children }: { children: ReactNode }) {
  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="bg"
        px={0}
        py={{ base: "2", md: "2" }}
      >
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack gap={{ base: "4", md: "4" }} p={{ base: "2", md: "2" }}>
            {children}
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}

function formatPassiveRate(n: number): string {
  const r = Math.round(n * 100) / 100;
  if (Number.isInteger(r)) return String(r);
  const s = r.toFixed(2);
  return s.endsWith("0") ? s.slice(0, -1) : s;
}

function multiplierTargetLabel(target: "global" | "click" | "passive"): string {
  if (target === "click") return "click energy";
  if (target === "passive") return "passive energy";
  return "all outputs";
}

const MECHANIC_DISPLAY: Record<string, string> = {
  pond_unlocked: "Pond",
};

function effectSummaryLine(e: UpgradeEffect): string {
  switch (e.type) {
    case "passive_generation": {
      const meta = RESOURCE_PRESENTATION[e.resource];
      return `+${formatPassiveRate(e.amount)} ${meta.label}/s (passive)`;
    }
    case "multiplier": {
      const pct = Math.round(e.value * 100);
      return `${multiplierTargetLabel(e.target)} +${pct}%`;
    }
    case "click_bonus":
      return `+${formatPassiveRate(e.amount)} energy per click`;
    case "unlock":
      return `Unlock: ${MECHANIC_DISPLAY[e.mechanicId] ?? e.mechanicId}`;
    case "threshold_delta":
      return `+${formatPassiveRate(e.delta)} ${POND_STAT_LABELS[e.stat]}`;
    default:
      return JSON.stringify(e);
  }
}

function CatalogTag({
  children,
  borderAccent,
  greenAccent,
}: {
  children: ReactNode;
  /** Theme token or CSS color for border (family strip). */
  borderAccent?: string;
  /** Use lilypad-tinted chip (biodiversity). */
  greenAccent?: boolean;
}) {
  if (greenAccent) {
    return (
      <Tag.Root size="sm" variant="surface" colorPalette="teal">
        <Tag.Label fontSize={UPGRADE_CARD_BODY} fontWeight="medium">
          {children}
        </Tag.Label>
      </Tag.Root>
    );
  }
  return (
    <Tag.Root
      size="sm"
      bg="white"
      borderWidth="1px"
      borderColor={borderAccent ?? "border"}
      color="fg"
    >
      <Tag.Label fontSize={UPGRADE_CARD_BODY} fontWeight="medium">
        {children}
      </Tag.Label>
    </Tag.Root>
  );
}

function UpgradeCatalogCard({ upgrade: u }: { upgrade: UpgradeDef }) {
  const fam = FAMILY_PRESENTATION[u.family];
  return (
    <Box
      {...UPGRADE_CARD_SHELL_PROPS}
      borderLeftWidth="3px"
      borderLeftColor={fam.accent}
      boxShadow="sm"
    >
      <Stack gap="1.5" align="stretch">
        <HStack
          justify="space-between"
          align="flex-start"
          flexWrap="wrap"
          gap="1.5"
        >
          <Stack gap="0" align="flex-start" minW={0}>
            <Heading
              as="h3"
              fontSize={{ base: "xs", md: "sm" }}
              fontWeight="semibold"
              lineHeight="short"
              color="fg"
            >
              {u.name}
            </Heading>
            <Text
              fontSize={{ base: "2xs", md: "2xs" }}
              fontFamily="mono"
              color="fg.muted"
              lineHeight="short"
            >
              {u.id}
            </Text>
          </Stack>
          <HStack flexWrap="wrap" gap="1">
            <CatalogTag>Tier {u.tier}</CatalogTag>
            <CatalogTag borderAccent={fam.accent}>
              {fam.symbol} {fam.label}
            </CatalogTag>
          </HStack>
        </HStack>
        <Text fontSize={UPGRADE_CARD_BODY} color="fg" lineHeight="1.45">
          {u.description}
        </Text>
        <HStack flexWrap="wrap" gap="2" fontSize={UPGRADE_CARD_BODY}>
          <Text>
            <Text as="span" fontWeight="semibold">
              Cost
            </Text>{" "}
            {RESOURCE_PRESENTATION.energy.symbol} {u.costs.energy}
          </Text>
          {u.maxOwned != null ? (
            <Text>
              <Text as="span" fontWeight="semibold">
                Max stacks
              </Text>{" "}
              {u.maxOwned}
            </Text>
          ) : null}
        </HStack>
        <Box>
          <Text {...UPGRADE_CARD_SECTION_LABEL_PROPS}>Requirements</Text>
          {u.requirements.length === 0 ? (
            <Text fontSize={UPGRADE_CARD_BODY} color="fg.muted">
              None
            </Text>
          ) : (
            <Box as="ul" pl="3.5" style={{ listStyleType: "disc" }}>
              {u.requirements.map((r, i) => (
                <Box as="li" key={i} mb="0.5">
                  <Text fontSize={UPGRADE_CARD_BODY}>
                    {requirementSummary(r)}
                  </Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
        <Box>
          <Text {...UPGRADE_CARD_SECTION_LABEL_PROPS}>Effects</Text>
          {u.effects.length === 0 ? (
            <Text fontSize={UPGRADE_CARD_BODY} color="fg.muted">
              (none)
            </Text>
          ) : (
            <Box as="ul" pl="3.5" style={{ listStyleType: "disc" }}>
              {u.effects.map((e, i) => (
                <Box as="li" key={i} mb="0.5">
                  <Text fontSize={UPGRADE_CARD_BODY}>
                    {effectSummaryLine(e)}
                  </Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
        {u.denizenKind || u.pondVisual ? (
          <HStack flexWrap="wrap" gap="1" pt="0.5">
            {u.denizenKind ? (
              <CatalogTag>Denizen: {u.denizenKind}</CatalogTag>
            ) : null}
            {u.pondVisual ? (
              <CatalogTag>Pond visual: {u.pondVisual.type}</CatalogTag>
            ) : null}
          </HStack>
        ) : null}
      </Stack>
    </Box>
  );
}

export default function ClickerCatalogAdminPage() {
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();
  const {
    sessionUser,
    isAuthenticated,
    isLoading,
    error: sessionError,
  } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;
  const [activeTierTab, setActiveTierTab] = useState("0");

  const tiers = useMemo(() => {
    const map = new Map<number, UpgradeDef[]>();
    for (const u of CATALOG_UPGRADES) {
      const list = map.get(u.tier) ?? [];
      list.push(u);
      map.set(u.tier, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

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
      <ClickerCatalogFramedChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading
            as="h1"
            size={{ base: "lg", md: "xl" }}
            fontWeight="bold"
            mb="2"
          >
            Upgrade catalog
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
      </ClickerCatalogFramedChrome>
    );
  }

  if (isAuthenticated && !sessionUser && !isLoading) {
    return (
      <ClickerCatalogFramedChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading
            as="h1"
            size={{ base: "lg", md: "xl" }}
            fontWeight="bold"
            mb="2"
          >
            Upgrade catalog
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
      </ClickerCatalogFramedChrome>
    );
  }

  if (isLoading || !sessionUser) {
    return (
      <ClickerCatalogFramedChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Text fontSize={APP_TEXT_SIZES.body} color="fg">
            Loading…
          </Text>
        </Box>
      </ClickerCatalogFramedChrome>
    );
  }

  if (!isStaff) {
    return (
      <ClickerCatalogFramedChrome>
        <Box {...PANEL_ENTRY_CARD_PROPS}>
          <Heading
            as="h1"
            size={{ base: "lg", md: "xl" }}
            fontWeight="bold"
            mb="2"
          >
            Upgrade catalog
          </Heading>
          <Text
            fontSize={APP_TEXT_SIZES.body}
            lineHeight="tall"
            color="fg"
            mb="3"
          >
            Staff access required. This page lists every upgrade from{" "}
            <Text as="span" fontFamily="mono" fontSize={APP_TEXT_SIZES.helper}>
              catalog.ts
            </Text>{" "}
            for debugging and balance review.
          </Text>
          {backButton}
        </Box>
      </ClickerCatalogFramedChrome>
    );
  }

  return (
    <ClickerCatalogFramedChrome>
      <Box {...PANEL_ENTRY_CARD_PROPS}>
        <Stack gap="2" align="flex-start">
          {backButton}
          <Heading as="h1" size={{ base: "lg", md: "xl" }} fontWeight="bold">
            Upgrade catalog (staff)
          </Heading>
          <Text
            fontSize={APP_TEXT_SIZES.helper}
            color="gray.600"
            lineHeight="tall"
          >
            {CATALOG_UPGRADES.length} upgrades — reference data mirrors{" "}
            <Text as="span" fontFamily="mono">
              catalog.ts
            </Text>
            .
          </Text>
        </Stack>
      </Box>

      <Tabs.Root
        value={activeTierTab}
        variant="plain"
        w="100%"
        onValueChange={(details) => setActiveTierTab(details.value)}
      >
        <Tabs.List {...APP_SHELL_TAB_LIST_INSET_PROPS} flexWrap="wrap" rowGap="2">
          {tiers.map(([tier]) => {
            const value = String(tier);
            return (
              <Tabs.Trigger
                key={tier}
                value={value}
                {...APP_SHELL_TAB_TRIGGER_PROPS}
                fontSize={APP_TEXT_SIZES.label}
              >
                Tier {tier}
              </Tabs.Trigger>
            );
          })}
        </Tabs.List>
        {tiers.map(([tier, upgrades]) => (
          <Tabs.Content key={tier} value={String(tier)} px={0} pt="2" pb="0">
            <Grid
              templateColumns={{
                base: "minmax(0, 1fr)",
                md: "repeat(2, minmax(0, 1fr))",
                xl: "repeat(3, minmax(0, 1fr))",
              }}
              gap={{ base: "2", md: "3" }}
            >
              {upgrades.map((u) => (
                <UpgradeCatalogCard key={u.id} upgrade={u} />
              ))}
            </Grid>
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </ClickerCatalogFramedChrome>
  );
}
