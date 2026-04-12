import { useAuth0 } from "@auth0/auth0-react";
import { keyframes } from "@emotion/react";
import { useEffect, useMemo, useState } from "react";

import {
  Box,
  Link as ChakraLink,
  Flex,
  Heading,
  HStack,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Link as RouterLink, useNavigate } from "react-router";
import { useAppSession } from "./auth/AppSessionContext";
import {
  auth0LoginAuthorizationParams,
  auth0SignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import { fetchClosetActionSummary } from "./closet/api";
import { fetchFriendsList } from "./friends/api";
import PondButton from "./PondButton";
import { fullBleedStackProps } from "./responsive";
import { APP_TEXT_SIZES } from "./theme/typography";
import {
  fetchStaffPendingSummary,
  fetchUpcomingBirthdays,
  type StaffPendingSummary,
  type UpcomingBirthday,
} from "./users/api";

const LILYPAD_WEDGE_CLIP_PATH =
  "polygon(0% 0%, 43% 0%, 46% 12%, 48% 24%, 50% 36%, 52% 24%, 54% 12%, 57% 0%, 100% 0%, 100% 100%, 0% 100%)";

const LILYPAD_HOVER_HINT_VISIBLE = {
  opacity: 1,
  maxHeight: "4.5rem",
} as const;

const LILYPAD_FLOAT_KEYFRAMES = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
`;

const HOME_LILYPAD_TILES = [
  {
    to: "/quotes",
    label: "Quotes",
    hoverText: "archive of user-recorded quotes",
  },
  {
    to: "/songaday",
    label: "Song a Day",
    hoverText: "daily music prompts and friends’ picks",
  },
  {
    to: "/closet",
    label: "Community Closet",
    hoverText: "lend and borrow items with friends",
  },
  {
    to: "/meal",
    label: "Meal Maestro",
    hoverText: "manage your meal plans and recipes",
  },
  { to: "/clicker", label: "PondClicker", hoverText: "idle pond-growing game" },
  { to: "/whatif", label: "WhatIf", hoverText: "multiplayer party game" },
] as const;

const HOME_PURPOSE_BLURB =
  "PondArbor is a hobby project by Pond Arbor Workshop: a single place for friends and family to use quotes, a community closet, PondClicker, WhatIf, and more.";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function birthdayMessage(birthday: UpcomingBirthday): string {
  const monthName =
    MONTH_NAMES[birthday.birth_month - 1] ?? String(birthday.birth_month);
  return `${birthday.display_name}'s birthday is ${monthName} ${birthday.birth_day}!`;
}

function accountStatusMessage(
  accountStatus: string | undefined,
): string | null {
  if (!accountStatus || accountStatus === "approved") return null;
  if (accountStatus === "pending") return "Your account is awaiting approval.";
  if (accountStatus === "rejected")
    return "Your account was rejected. Please contact support.";
  if (accountStatus === "suspended")
    return "Your account is suspended. Please contact support.";
  return "Your account is not currently approved.";
}

type HomePrompt = { id: string; text: string; to: string };
type HomeNoticeItem = { id: string; text: string };

function HomeNoticeLilypadCard({ text }: { text: string }) {
  return (
    <Box
      bg="lilypad.solid"
      color="lilypad.contrast"
      borderRadius="xl"
      px={{ base: 2, md: 2 }}
      py={{ base: 2, md: 2 }}
      fontWeight="bold"
      textStyle={{ base: "sm", md: "md" }}
      lineHeight="short"
      maxW={{ base: "100%", md: "22rem" }}
    >
      {text}
    </Box>
  );
}

function App() {
  const { loginWithRedirect } = useAuth0();
  const navigate = useNavigate();

  const {
    isLoading,
    isAuthenticated,
    error,
    auth0User,
    sessionUser,
    getApiAccessToken,
    refreshSession,
  } = useAppSession();
  const [upcomingBirthdays, setUpcomingBirthdays] = useState<
    UpcomingBirthday[]
  >([]);
  const [staffPendingSummary, setStaffPendingSummary] =
    useState<StaffPendingSummary | null>(null);
  const [pendingFriendCount, setPendingFriendCount] = useState(0);
  const [closetOutstandingActions, setClosetOutstandingActions] = useState(0);
  const nickname =
    sessionUser?.profile?.display_name ??
    auth0User?.nickname ??
    auth0User?.name ??
    "friend";

  const { homePrompts, homeNoticeItems } = useMemo(() => {
    const prompts: HomePrompt[] = [];
    const notices: HomeNoticeItem[] = [];

    if (!isAuthenticated || !sessionUser) {
      return { homePrompts: prompts, homeNoticeItems: notices };
    }

    const statusMsg = accountStatusMessage(sessionUser.user?.account_status);
    if (statusMsg) {
      notices.push({ id: "account-status", text: statusMsg });
    }

    if (
      sessionUser.user?.is_staff &&
      staffPendingSummary &&
      (staffPendingSummary.pending_members > 0 ||
        staffPendingSummary.pending_whatif_questions > 0)
    ) {
      if (staffPendingSummary.pending_members > 0) {
        prompts.push({
          id: "staff-pending-members",
          to: "/staff",
          text:
            staffPendingSummary.pending_members === 1
              ? "1 member is awaiting approval."
              : `${staffPendingSummary.pending_members} members are awaiting approval.`,
        });
      }
      if (staffPendingSummary.pending_whatif_questions > 0) {
        prompts.push({
          id: "staff-pending-whatif",
          to: "/staff",
          text:
            staffPendingSummary.pending_whatif_questions === 1
              ? "1 WhatIf question is awaiting review."
              : `${staffPendingSummary.pending_whatif_questions} WhatIf questions are awaiting review.`,
        });
      }
    }

    if (sessionUser.user?.is_approved && pendingFriendCount > 0) {
      prompts.push({
        id: "pending-friends",
        to: "/friends",
        text:
          pendingFriendCount === 1
            ? "You have 1 pending friend request."
            : `You have ${pendingFriendCount} pending friend requests.`,
      });
    }

    if (sessionUser.user?.is_approved && closetOutstandingActions > 0) {
      prompts.push({
        id: "closet-actions",
        to: "/closet?tab=my",
        text:
          closetOutstandingActions === 1
            ? "You have 1 outstanding action for items in your community closet."
            : `You have ${closetOutstandingActions} outstanding actions for items in your community closet.`,
      });
    }

    if (sessionUser.user?.is_approved && sessionUser.profile.meal_partner_incoming_pending) {
      prompts.push({
        id: "meal-partner-incoming",
        to: "/meal/settings",
        text: "You have a Meal Maestro partner request. Open Meal Settings to accept or decline.",
      });
    }

    if (sessionUser.user?.is_approved && upcomingBirthdays.length > 0) {
      for (const birthday of upcomingBirthdays) {
        notices.push({
          id: `birthday-${birthday.display_name}-${birthday.birth_month}-${birthday.birth_day}`,
          text: birthdayMessage(birthday),
        });
      }
    }

    return { homePrompts: prompts, homeNoticeItems: notices };
  }, [
    isAuthenticated,
    sessionUser,
    staffPendingSummary,
    pendingFriendCount,
    closetOutstandingActions,
    upcomingBirthdays,
  ]);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser?.user?.is_approved) return;
    void refreshSession().catch(() => {
      /* ignore initial refresh failure */
    });
    const tid = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshSession().catch(() => {
        /* ignore periodic refresh failures */
      });
    }, 60000);
    return () => {
      window.clearInterval(tid);
    };
  }, [isAuthenticated, sessionUser?.user?.is_approved, refreshSession]);

  useEffect(() => {
    let isCancelled = false;

    async function loadUpcomingBirthdays() {
      if (!isAuthenticated || !sessionUser?.user?.is_approved) {
        if (!isCancelled) {
          setUpcomingBirthdays([]);
        }
        return;
      }

      try {
        const token = await getApiAccessToken();
        const birthdays = await fetchUpcomingBirthdays(token);
        if (!isCancelled) {
          setUpcomingBirthdays(birthdays);
        }
      } catch {
        if (!isCancelled) {
          setUpcomingBirthdays([]);
        }
      }
    }

    void loadUpcomingBirthdays();
    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, sessionUser?.user?.is_approved, getApiAccessToken]);

  useEffect(() => {
    let isCancelled = false;

    async function loadStaffPendingSummary() {
      if (!isAuthenticated || !sessionUser?.user?.is_staff) {
        if (!isCancelled) {
          setStaffPendingSummary(null);
        }
        return;
      }

      try {
        const token = await getApiAccessToken();
        const summary = await fetchStaffPendingSummary(token);
        if (!isCancelled) {
          setStaffPendingSummary(summary);
        }
      } catch {
        if (!isCancelled) {
          setStaffPendingSummary(null);
        }
      }
    }

    void loadStaffPendingSummary();
    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, sessionUser?.user?.is_staff, getApiAccessToken]);

  useEffect(() => {
    let isCancelled = false;
    async function loadPendingFriends() {
      if (!isAuthenticated || !sessionUser?.user?.is_approved) {
        if (!isCancelled) setPendingFriendCount(0);
        return;
      }
      try {
        const token = await getApiAccessToken();
        const payload = await fetchFriendsList(token);
        if (!isCancelled) setPendingFriendCount(payload.pending_count);
      } catch {
        if (!isCancelled) setPendingFriendCount(0);
      }
    }
    void loadPendingFriends();
    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, sessionUser?.user?.is_approved, getApiAccessToken]);

  useEffect(() => {
    let isCancelled = false;
    async function loadClosetActionSummary() {
      if (!isAuthenticated || !sessionUser?.user?.is_approved) {
        if (!isCancelled) setClosetOutstandingActions(0);
        return;
      }
      try {
        const token = await getApiAccessToken();
        const summary = await fetchClosetActionSummary(token);
        if (!isCancelled)
          setClosetOutstandingActions(summary.outstanding_actions_count);
      } catch {
        if (!isCancelled) setClosetOutstandingActions(0);
      }
    }
    void loadClosetActionSummary();
    return () => {
      isCancelled = true;
    };
  }, [isAuthenticated, sessionUser?.user?.is_approved, getApiAccessToken]);

  if (isLoading) {
    return (
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        minH="40vh"
      >
        <Text fontSize="lg">Loading…</Text>
      </Box>
    );
  }

  return (
    <Stack flex="1" minH="0" gap="0" align="stretch" {...fullBleedStackProps}>
      <Box
        bg="bg"
        w="full"
        px={{ base: "2", md: "2" }}
        py={{ base: "2", md: "2" }}
      >
        <Stack gap="1" w="full" mb="3">
          <Heading as="h1" size={{ base: "lg", md: "xl" }}>
            PondArbor
          </Heading>
          {isAuthenticated ? (
            <Text
              fontSize={{ base: "md", md: "lg" }}
              fontWeight="medium"
              color="fg"
            >
              Welcome, {nickname}!
            </Text>
          ) : null}
        </Stack>
        <Stack gap="3" w="full" maxW="3xl">
          {isAuthenticated ? (
            homePrompts.length > 0 || homeNoticeItems.length > 0 ? (
              <Stack gap="3" w="100%">
                {homePrompts.length > 0 ? (
                  <HStack
                    gap="3"
                    flexWrap="wrap"
                    align="stretch"
                    w="100%"
                    role="region"
                    aria-label="Prompts"
                  >
                    {homePrompts.map((prompt) => (
                      <PondButton
                        key={prompt.id}
                        type="button"
                        colorPalette="nautical"
                        fontWeight="bold"
                        whiteSpace="normal"
                        textAlign="center"
                        h="auto"
                        py={{ base: 2, md: 2 }}
                        px={{ base: 2, md: 2 }}
                        maxW={{ base: "100%", md: "22rem" }}
                        onClick={() => void navigate(prompt.to)}
                      >
                        {prompt.text}
                      </PondButton>
                    ))}
                  </HStack>
                ) : null}
                {homeNoticeItems.length > 0 ? (
                  <HStack
                    gap="3"
                    flexWrap="wrap"
                    align="stretch"
                    w="100%"
                    role="region"
                    aria-label="Notices"
                  >
                    {homeNoticeItems.map((item) => (
                      <HomeNoticeLilypadCard key={item.id} text={item.text} />
                    ))}
                  </HStack>
                ) : null}
              </Stack>
            ) : null
          ) : (
            <>
              <HStack gap="3" align="center" flexWrap="wrap">
                <PondButton
                  colorPalette="sky"
                  onClick={() =>
                    loginWithRedirect({
                      authorizationParams: auth0LoginAuthorizationParams(),
                    })
                  }
                >
                  Log in
                </PondButton>
                <PondButton
                  colorPalette="lilypad"
                  onClick={() =>
                    loginWithRedirect({
                      authorizationParams: auth0SignupAuthorizationParams(),
                    })
                  }
                >
                  Sign up
                </PondButton>
              </HStack>
              <Text
                fontSize={APP_TEXT_SIZES.body}
                lineHeight="tall"
                color="fg"
                maxW="3xl"
              >
                {HOME_PURPOSE_BLURB}{" "}
                <ChakraLink
                  asChild
                  color="black"
                  textDecoration="underline"
                  _hover={{ color: "sky.solid" }}
                >
                  <RouterLink to="/about">Learn more</RouterLink>
                </ChakraLink>
              </Text>
            </>
          )}
          {!isAuthenticated && error && <Text color="fg">Error: {error}</Text>}
        </Stack>
      </Box>

      <Box
        flex="1"
        w="full"
        bg="transparent"
        // leave these at 4:
        px={{ base: "4", md: "4" }}
        py={{ base: "4", md: "4" }}
      >
        <Flex
          flexWrap="wrap"
          gap={{ base: "4", md: "6" }}
          alignItems="flex-start"
          w="100%"
        >
          {HOME_LILYPAD_TILES.map((tile, index) => {
            const tileInteractive = isAuthenticated || tile.to === "/whatif";
            const tileWrapProps = {
              flex: "0 0 auto",
              w: { base: "10.25rem", sm: "11rem", md: "12rem" },
              maxW: "100%",
              position: "relative",
              animation: `${LILYPAD_FLOAT_KEYFRAMES} 5.6s ease-in-out infinite`,
              animationDelay: `${index * 0.35}s`,
              willChange: "transform",
              filter: "drop-shadow(0 8px 10px rgba(0, 0, 0, 0.16))",
              sx: {
                "@media (prefers-reduced-motion: reduce)": {
                  animation: "none",
                },
              },
            } as const;
            const card = (
              <Box
                bg={tileInteractive ? "lilypad.solid" : "#A4B89A"}
                borderRadius="9999px"
                borderWidth="20px"
                borderColor={tileInteractive ? "lilypad.solid" : "#A4B89A"}
                aspectRatio={1}
                p={{ base: "2", md: "2" }}
                display="flex"
                alignItems="center"
                justifyContent="center"
                textAlign="center"
                position="relative"
                boxShadow="md"
                transform="translateZ(0)"
                overflow="hidden"
                clipPath={LILYPAD_WEDGE_CLIP_PATH}
                transition="background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease"
                cursor={tileInteractive ? "pointer" : "not-allowed"}
                _hover={
                  tileInteractive
                    ? {
                        bg: "bg",
                        transform: "scale(1.02)",
                        boxShadow: "xl",
                        "& .lilypad-hover-hint": LILYPAD_HOVER_HINT_VISIBLE,
                      }
                    : {
                        "& .lilypad-hover-hint": LILYPAD_HOVER_HINT_VISIBLE,
                      }
                }
                _active={
                  tileInteractive
                    ? {
                        bg: "bg",
                        transform: "scale(0.99)",
                        boxShadow: "lg",
                      }
                    : undefined
                }
              >
                <Stack
                  gap="1"
                  align="center"
                  justify="center"
                  w="full"
                  minH="0"
                  px="0.5"
                >
                  <Heading
                    as="h2"
                    size={{ base: "md", md: "lg" }}
                    position="relative"
                    zIndex={2}
                    color={tileInteractive ? "fg" : "gray.600"}
                    lineHeight="1.2"
                  >
                    {tile.label}
                  </Heading>
                  <Text
                    className="lilypad-hover-hint"
                    textAlign="center"
                    fontSize={{ base: "2xs", md: "xs" }}
                    lineHeight="1.35"
                    fontWeight="medium"
                    color={tileInteractive ? "fg" : "gray.600"}
                    opacity={0}
                    maxHeight="0"
                    overflow="hidden"
                    transitionProperty="opacity, max-height"
                    transitionDuration="0.2s"
                    transitionTimingFunction="ease"
                    px="1"
                  >
                    {tile.hoverText}
                  </Text>
                </Stack>
              </Box>
            );

            if (!tileInteractive) {
              return (
                <Box key={tile.to} {...tileWrapProps}>
                  {card}
                </Box>
              );
            }

            return (
              <Box key={tile.to} {...tileWrapProps}>
                <Box
                  asChild
                  display="block"
                  textDecoration="none"
                  color="inherit"
                  h="100%"
                  _focusVisible={{
                    "& .lilypad-hover-hint": LILYPAD_HOVER_HINT_VISIBLE,
                  }}
                >
                  <RouterLink to={tile.to}>{card}</RouterLink>
                </Box>
              </Box>
            );
          })}
        </Flex>
      </Box>

      <Box as="footer" w="full" flexShrink={0} bg="lilypad.solid" mt="auto">
        <Box py="2" px={{ base: "2", md: "2" }}>
          <Box
            display="flex"
            flexDirection={{ base: "column", md: "row" }}
            alignItems={{ base: "flex-end", md: "center" }}
            justifyContent="flex-end"
            flexWrap="wrap"
            columnGap={{ md: "3" }}
            rowGap="1"
          >
            <Text textAlign="right" fontSize="xs" color="fg">
              © 2026{" "}
              <ChakraLink
                asChild
                color="black"
                textDecoration="none"
                _hover={{ color: "sky.solid", textDecoration: "none" }}
              >
                <RouterLink to="/about">Pond Arbor Workshop</RouterLink>
              </ChakraLink>
              . All rights reserved.
            </Text>
            <Text textAlign="right" fontSize="xs" color="fg">
              <ChakraLink
                asChild
                color="black"
                textDecoration="none"
                _hover={{ color: "sky.solid", textDecoration: "none" }}
              >
                <RouterLink to="/about/terms">Terms of Service</RouterLink>
              </ChakraLink>{" "}
              |{" "}
              <ChakraLink
                asChild
                color="black"
                textDecoration="none"
                _hover={{ color: "sky.solid", textDecoration: "none" }}
              >
                <RouterLink to="/about/privacy">Privacy Policy</RouterLink>
              </ChakraLink>
            </Text>
          </Box>
        </Box>
      </Box>
    </Stack>
  );
}

export default App;
