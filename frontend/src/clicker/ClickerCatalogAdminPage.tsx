/**
 * Staff-only reference view of the PondClicker upgrade catalog.
 * Intentionally not linked from the public UI — open directly:
 * `/clicker/dev/catalog`
 */
import { Box, Grid, Heading, HStack, Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";
import { Link as RouterLink } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import {
  CATALOG_UPGRADES,
  FAMILY_PRESENTATION,
  POND_STAT_LABELS,
  RESOURCE_PRESENTATION,
  type UpgradeDef,
  type UpgradeEffect,
} from "./catalog";
import { ClickerPageShell } from "./ClickerShell";
import { requirementSummary } from "./ruleEngine";

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

function pillProps(accent?: string) {
  return {
    as: "span" as const,
    display: "inline-block",
    fontSize: "xs",
    fontWeight: "medium",
    px: "2",
    py: "0.5",
    borderRadius: "md",
    borderWidth: "1px",
    borderColor: accent ?? "border",
    bg: "bg.subtle",
  };
}

function UpgradeCatalogCard({ upgrade: u }: { upgrade: UpgradeDef }) {
  const fam = FAMILY_PRESENTATION[u.family];
  return (
    <Box
      borderWidth="1px"
      borderColor="border"
      borderLeftWidth="4px"
      borderLeftColor={fam.accent}
      borderRadius="md"
      bg="bg"
      p={{ base: "3", md: "4" }}
      boxShadow="sm"
    >
      <Stack gap="2" align="stretch">
        <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap="2">
          <Stack gap="0.5" align="flex-start">
            <Heading as="h3" size="sm">
              {u.name}
            </Heading>
            <Text fontSize="xs" fontFamily="mono" color="fg.muted">
              {u.id}
            </Text>
          </Stack>
          <HStack flexWrap="wrap" gap="1.5">
            <Box {...pillProps()}>Tier {u.tier}</Box>
            <Box {...pillProps(fam.accent)}>
              {fam.symbol} {fam.label}
            </Box>
          </HStack>
        </HStack>
        <Text fontSize="sm" color="fg">
          {u.description}
        </Text>
        <HStack flexWrap="wrap" gap="3" fontSize="sm">
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
          <Text
            fontSize="xs"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="0.06em"
            color="fg.muted"
            mb="1"
          >
            Requirements
          </Text>
          {u.requirements.length === 0 ? (
            <Text fontSize="sm" color="fg.muted">
              None
            </Text>
          ) : (
            <Box as="ul" pl="5" style={{ listStyleType: "disc" }}>
              {u.requirements.map((r, i) => (
                <Box as="li" key={i} mb="0.5">
                  <Text fontSize="sm">{requirementSummary(r)}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
        <Box>
          <Text
            fontSize="xs"
            fontWeight="bold"
            textTransform="uppercase"
            letterSpacing="0.06em"
            color="fg.muted"
            mb="1"
          >
            Effects
          </Text>
          {u.effects.length === 0 ? (
            <Text fontSize="sm" color="fg.muted">
              (none)
            </Text>
          ) : (
            <Box as="ul" pl="5" style={{ listStyleType: "disc" }}>
              {u.effects.map((e, i) => (
                <Box as="li" key={i} mb="0.5">
                  <Text fontSize="sm">{effectSummaryLine(e)}</Text>
                </Box>
              ))}
            </Box>
          )}
        </Box>
        {u.denizenKind || u.countsTowardBiodiversity || u.pondVisual ? (
          <HStack flexWrap="wrap" gap="1.5" pt="1">
            {u.denizenKind ? (
              <Box {...pillProps()} fontSize="2xs">
                Denizen: {u.denizenKind}
              </Box>
            ) : null}
            {u.countsTowardBiodiversity ? (
              <Box {...pillProps("#2f5a2f")} fontSize="2xs">
                Counts toward biodiversity
              </Box>
            ) : null}
            {u.pondVisual ? (
              <Box {...pillProps()} fontSize="2xs">
                Pond visual: {u.pondVisual.type}
              </Box>
            ) : null}
          </HStack>
        ) : null}
      </Stack>
    </Box>
  );
}

export default function ClickerCatalogAdminPage() {
  const { sessionUser, isAuthenticated, isLoading, error: sessionError } = useAppSession();
  const isStaff = !!sessionUser?.user?.is_staff;

  const tiers = useMemo(() => {
    const map = new Map<number, UpgradeDef[]>();
    for (const u of CATALOG_UPGRADES) {
      const list = map.get(u.tier) ?? [];
      list.push(u);
      map.set(u.tier, list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, []);

  if (!isAuthenticated) {
    return (
      <ClickerPageShell>
        <Box maxW="lg" mx="auto">
          <Text fontSize={{ base: "sm", md: "md" }}>Sign in to open this page.</Text>
        </Box>
      </ClickerPageShell>
    );
  }

  if (isAuthenticated && !sessionUser && !isLoading) {
    return (
      <ClickerPageShell>
        <Box maxW="lg" mx="auto">
          <Text fontSize={{ base: "sm", md: "md" }} color="fg">
            {sessionError ?? "Could not load your account session. Try signing in again."}
          </Text>
        </Box>
      </ClickerPageShell>
    );
  }

  if (isLoading || !sessionUser) {
    return (
      <ClickerPageShell>
        <Text fontSize={{ base: "sm", md: "md" }}>Loading…</Text>
      </ClickerPageShell>
    );
  }

  if (!isStaff) {
    return (
      <ClickerPageShell>
        <Box maxW="lg" mx="auto">
          <Text fontSize={{ base: "sm", md: "md" }}>Staff access required.</Text>
        </Box>
      </ClickerPageShell>
    );
  }

  return (
    <ClickerPageShell
      titleLeft={
        <Stack gap="1" align="flex-start">
          <Box
            asChild
            display="inline-block"
            fontSize="sm"
            color="fg.muted"
            textDecoration="underline"
            textUnderlineOffset="2px"
            _hover={{ color: "fg" }}
          >
            <RouterLink to="/clicker">← PondClicker</RouterLink>
          </Box>
          <Heading as="h1" size={{ base: "md", md: "lg" }}>
            Upgrade catalog (staff)
          </Heading>
          <Text fontSize="sm" color="fg.muted">
            {CATALOG_UPGRADES.length} upgrades · same data as <Text as="span" fontFamily="mono">catalog.ts</Text>
          </Text>
        </Stack>
      }
    >
      <Stack gap="8" pb="10">
        {tiers.map(([tier, upgrades]) => (
          <Stack key={tier} gap="4" align="stretch">
            <Heading as="h2" size="sm" color="fg.muted">
              Tier {tier}
            </Heading>
            <Grid
              templateColumns={{ base: "1fr", lg: "repeat(2, 1fr)" }}
              gap={{ base: "3", md: "4" }}
            >
              {upgrades.map((u) => (
                <UpgradeCatalogCard key={u.id} upgrade={u} />
              ))}
            </Grid>
          </Stack>
        ))}
      </Stack>
    </ClickerPageShell>
  );
}
