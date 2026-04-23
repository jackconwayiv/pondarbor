import { useAuth0 } from "@auth0/auth0-react";
import { useEffect, useMemo, useState } from "react";

import {
  Box,
  Link as ChakraLink,
  Flex,
  Heading,
  HStack,
  Image,
  SimpleGrid,
  Stack,
  Text,
} from "@chakra-ui/react";
import { Link as RouterLink, useNavigate } from "react-router";
import { APP_HOME_APPS } from "./appNavConfig";
import { useAppSession } from "./auth/AppSessionContext";
import {
  auth0LoginAuthorizationParams,
  auth0SignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import { fetchClosetActionSummary } from "./closet/api";
import { fetchFriendsList } from "./friends/api";
import PondButton from "./PondButton";
import { pondarborProfileSrc } from "./publicAsset";
import { fullBleedStackProps, viewPortWidthBarProps } from "./responsive";
import { APP_SHELL_CONTENT_MAX_PROPS, APP_TEXT_SIZES } from "./theme/typography";
import {
  fetchStaffPendingSummary,
  fetchUpcomingBirthdays,
  type StaffPendingSummary,
  type UpcomingBirthday,
} from "./users/api";

const HOME_PURPOSE_BLURB =
  "Welcome to PondArbor! This is a hobby project by Pond Arbor Workshop (Jack Conway) for friends and family to enjoy a variety of social and lifestyle apps and games.";

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

function HomeNoticeCard({ text }: { text: string }) {
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

function HomeAppNavList({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <SimpleGrid
      as="ul"
      w="100%"
      maxW="100%"
      p="0"
      m="0"
      listStyleType="none"
      columns={{ base: 1, md: 3 }}
      gap="2.5"
      role="list"
      aria-label="Apps"
    >
      {APP_HOME_APPS.map((item) => {
        const canOpen =
          isAuthenticated ||
          item.to === "/games" ||
          item.to === "/about";
        const cardBody = (
          <HStack
            w="100%"
            align="center"
            gap="3"
            py="2.5"
            px="3"
            minH="11"
            _hover={canOpen ? { bg: "bg.subtle" } : undefined}
            transition="background 0.12s ease"
            cursor={canOpen ? "pointer" : "not-allowed"}
            opacity={canOpen ? 1 : 0.55}
          >
            <Text as="span" fontSize="1.5rem" lineHeight="1" aria-hidden>
              {item.emoji}
            </Text>
            <Text
              as="span"
              fontSize="md"
              fontWeight="semibold"
              color="fg"
              lineClamp={2}
              flex="1"
              textAlign="left"
            >
              {item.label}
            </Text>
          </HStack>
        );
        const content = canOpen ? (
          <RouterLink
            to={item.to}
            style={{ textDecoration: "none", color: "inherit", display: "block" }}
          >
            {cardBody}
          </RouterLink>
        ) : (
          <Box
            aria-label={`${item.label} (log in to open)`}
            display="block"
            w="100%"
          >
            {cardBody}
          </Box>
        );
        return (
          <Box
            as="li"
            key={item.to}
            w="100%"
            listStyleType="none"
            borderWidth="1px"
            borderColor="border"
            borderRadius="lg"
            overflow="hidden"
            boxShadow="sm"
            bg="bg.subtle"
          >
            {content}
          </Box>
        );
      })}
    </SimpleGrid>
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

    if (
      sessionUser.user?.is_approved &&
      sessionUser.profile.meal_partner_incoming_pending
    ) {
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
    if (!isAuthenticated || !sessionUser) return;
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
  }, [isAuthenticated, sessionUser?.user?.id, refreshSession]);

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
    <Stack flex="1" minH="full" gap="0" align="stretch" w="100%" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" w="100%" px={0} py={{ base: "2", md: "2" }}>
        <Stack
          gap={{ base: "4", md: "4" }}
          align="stretch"
          {...APP_SHELL_CONTENT_MAX_PROPS}
          px={{ base: "2", md: "2" }}
        >
          <Stack gap="1" w="100%">
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
                      <HomeNoticeCard key={item.id} text={item.text} />
                    ))}
                  </HStack>
                ) : null}
              </Stack>
            ) : null
          ) : (
            <Stack gap="3" w="100%">
              <HStack gap="3" align="center" flexWrap="wrap">
                <PondButton
                  colorPalette="lilypad"
                  onClick={() =>
                    loginWithRedirect({
                      authorizationParams: auth0LoginAuthorizationParams(),
                    })
                  }
                >
                  Log in
                </PondButton>
                <PondButton
                  colorPalette="teal"
                  onClick={() =>
                    loginWithRedirect({
                      authorizationParams: auth0SignupAuthorizationParams(),
                    })
                  }
                >
                  Sign up
                </PondButton>
              </HStack>
              <Flex alignItems="center" width="100%" flexWrap="wrap" gap="3">
                <Image src={pondarborProfileSrc()} width="150px" flexShrink={0} />
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  lineHeight="tall"
                  color="fg"
                  flex="1"
                  minW="0"
                >
                  {HOME_PURPOSE_BLURB}{" "}
                </Text>
              </Flex>
            </Stack>
          )}

          {!isAuthenticated && error && <Text color="fg">Error: {error}</Text>}

          <Stack gap="2" align="flex-start" w="100%" pt={{ base: "2", md: "3" }}>
            <Text
              fontSize="xs"
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wider"
              color="fg.muted"
              w="100%"
            >
              Apps
            </Text>
            <HomeAppNavList isAuthenticated={isAuthenticated} />
          </Stack>
        </Stack>
      </Box>

      <Box
        as="footer"
        flexShrink={0}
        bg="navy.solid"
        mt="auto"
        color="navy.fg"
        {...viewPortWidthBarProps}
      >
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
            <Text textAlign="right" fontSize="xs" color="inherit">
              © 2026{" "}
              <ChakraLink
                asChild
                color="inherit"
                textDecoration="none"
                _hover={{ color: "sky.solid", textDecoration: "none" }}
              >
                <RouterLink to="/about">Pond Arbor Workshop</RouterLink>
              </ChakraLink>
              . All rights reserved.
            </Text>
            <Text textAlign="right" fontSize="xs" color="inherit">
              <ChakraLink
                asChild
                color="inherit"
                textDecoration="none"
                _hover={{ color: "sky.solid", textDecoration: "none" }}
              >
                <RouterLink to="/about/terms">Terms of Service</RouterLink>
              </ChakraLink>{" "}
              |{" "}
              <ChakraLink
                asChild
                color="inherit"
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
