import { Box, Card, HStack, Image, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { useIsMobile } from "../responsive";
import {
  APP_TEXT_SIZES,
  MAPPED_CLOSET_TAB_STACK_GAP,
  MEAL_NAV_LINK_CARD_PROPS,
  PANEL_ENTRY_CARD_BODY_PROPS,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "../theme/typography";
import { copyFriendMeal, fetchSharedMeals } from "./api";
import { mealLabel } from "./mealLabels";
import {
  MealApprovalRequired,
  MealLoading,
  MealSessionReconnect,
} from "./mealPageStates";
import type { SharedMeal } from "./types";

export default function MealSharedPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, sessionUser, getApiAccessToken, refreshSession } =
    useAppSession();
  const [meals, setMeals] = useState<SharedMeal[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [copyBusyId, setCopyBusyId] = useState<number | null>(null);
  const isMobile = useIsMobile();

  const refresh = useCallback(async () => {
    const t = await getApiAccessToken();
    const m = await fetchSharedMeals(t, q.trim() || undefined);
    setMeals(m);
  }, [getApiAccessToken, q]);

  useEffect(() => {
    if (!sessionUser?.user.is_approved) return;
    const tid = window.setTimeout(() => {
      void refresh().catch((e) => setErr(e instanceof Error ? e.message : "Load failed"));
    }, 0);
    return () => window.clearTimeout(tid);
  }, [sessionUser?.user.is_approved, refresh]);

  if (isLoading) return <MealLoading />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!sessionUser) {
    return <MealSessionReconnect onRetry={() => void refreshSession()} />;
  }
  if (!sessionUser.user.is_approved) {
    return <MealApprovalRequired />;
  }

  return (
    <Stack gap={MAPPED_CLOSET_TAB_STACK_GAP} w="100%">
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Recipes friends have published. Save a copy to your meals to cook from Meal Maestro.
      </Text>
      <HStack gap="2" flexWrap="wrap" w="100%">
        <Input
          flex="1"
          minW="min(100%, 12rem)"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void refresh().catch(() => {});
          }}
          {...PANEL_FIELD_PROPS}
        />
        <PondButton
          colorPalette="sky"
          variant="outline"
          onClick={() => void refresh().catch((e) => setErr(e instanceof Error ? e.message : "Failed"))}
        >
          Search
        </PondButton>
      </HStack>

      {err ? (
        <Text fontSize={APP_TEXT_SIZES.helper} fontWeight="medium" color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}

      <SimpleGrid
        columns={isMobile ? 1 : 2}
        gap={MAPPED_CLOSET_TAB_STACK_GAP}
        w="100%"
        alignItems="stretch"
      >
        {meals.map((m) => (
          <Card.Root
            key={m.id}
            {...PANEL_ENTRY_CARD_PROPS}
            p="0"
            {...MEAL_NAV_LINK_CARD_PROPS}
            overflow="hidden"
            h="100%"
            display="flex"
            flexDirection="column"
          >
            <Box
              position="relative"
              w="100%"
              aspectRatio="4 / 3"
              minH="0"
              flexShrink={0}
              bg="bg.subtle"
              borderBottomWidth="1px"
              borderColor="border"
              overflow="hidden"
            >
              {(m.image_url ?? "").trim() ? (
                <Image
                  position="absolute"
                  inset="0"
                  src={(m.image_url ?? "").trim()}
                  alt=""
                  w="100%"
                  h="100%"
                  objectFit="cover"
                />
              ) : null}
            </Box>
            <Card.Body {...PANEL_ENTRY_CARD_BODY_PROPS} flex="1" display="flex" flexDirection="column">
              <Stack gap="2" minW="0" flex="1">
                <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} lineClamp={2}>
                  {mealLabel(m)}
                </Text>
                <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
                  From {m.author_display?.trim() || "Friend"}
                </Text>
                <PondButton
                  colorPalette="lilypad"
                  alignSelf="flex-start"
                  loading={copyBusyId === m.id}
                  disabled={copyBusyId != null}
                  onClick={() => {
                    void (async () => {
                      setCopyBusyId(m.id);
                      setErr(null);
                      try {
                        const t = await getApiAccessToken();
                        const created = await copyFriendMeal(t, m.id);
                        setMeals((prev) => prev.filter((x) => x.id !== m.id));
                        navigate(`/meal/meals/${created.id}`);
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : "Could not save recipe");
                      } finally {
                        setCopyBusyId(null);
                      }
                    })();
                  }}
                >
                  Save to my meals
                </PondButton>
              </Stack>
            </Card.Body>
          </Card.Root>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
