import { useAuth0 } from "@auth0/auth0-react";
import {
  Avatar,
  Box,
  Button,
  Collapsible,
  Link as ChakraLink,
  Flex,
  HStack,
  Image,
  Menu,
  Spacer,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { FaBell } from "react-icons/fa";
import { Link, Outlet, useLocation, useNavigate } from "react-router";

import {
  resolveCurrentUserAvatarUrl,
  useAppSession,
} from "./auth/AppSessionContext";
import {
  auth0LoginAuthorizationParams,
  auth0SignupAuthorizationParams,
  // auth0SlackLoginAuthorizationParams,
  // auth0SlackSignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import {
  ABOUT,
  EXPLORE_APP,
  getFilteredCategoryItems,
  hasUnstarredApps,
  guestHamburgerNavItems,
  NAV_CATEGORIES,
  navLinkLabel,
  NAV_HEADER_LINK_TEXT,
  type AppNavAccess,
  type AppNavItem,
} from "./appNavConfig";
import PondButton from "./PondButton";
import { pondarborLogoSrc } from "./publicAsset";
import BreadcrumbBar from "./BreadcrumbBar";
import { RequireOnboardingComplete } from "./onboarding/RequireOnboardingComplete";
import {
  getSquallsInGame,
  subscribeSquallsInGame,
} from "./squalls/squallsBreadcrumbBridge";
import { HomeInboxProvider, useHomeInbox } from "./home/homeInboxContext";
import { APP_SHELL_OUTLET_MIN_HEIGHT_PROPS, useNavCompactLayout } from "./responsive";
import { APP_SHELL_CONTENT_MAX_PROPS } from "./theme/typography";

/** Wordmark font; fixed look (no route-based styling). */
const NAV_WORDMARK_FONT = '"Caprasimo", "Spinnaker", Verdana, Geneva, "DejaVu Sans", sans-serif';
const NAV_WORDMARK_FONT_SIZE = "calc(1.6em + 2px)";
const NAV_WORDMARK_MOBILE_FONT_SIZE = "calc(1.35em + 1px)";
const NAV_WORDMARK_LINE_HEIGHT = "1.1";
/** Slightly smaller app links in the top bar. */
const NAV_APP_LINK_FONT_SIZE = "0.8125rem";
const NAV_APP_LINK_LINE_HEIGHT = "1.2";
const NAV_HSTACK_GAP = "1.5";
const NAV_APP_LINK_HSTACK_GAP = "2.5";
/** Extra space between wordmark and first top-nav app link (desktop). */
const WORDMARK_TO_APP_NAV_PL = { base: "0", md: "3" } as const;

function BellNavButton() {
  const {
    homePrompts,
    homeNoticeItems,
    inboxError,
    inboxInitialSyncComplete,
    unreadCount,
  } = useHomeInbox();
  const navigate = useNavigate();

  const totalInboxItems = homePrompts.length + homeNoticeItems.length;
  /** Hidden until first sync; only show if there is activity to show or an error to read. */
  const showBell =
    inboxInitialSyncComplete && (Boolean(inboxError) || totalInboxItems > 0);
  if (!showBell) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={
        unreadCount > 0 ? `Activity, ${unreadCount} unread` : "Activity"
      }
      position="relative"
      bg="transparent"
      color={NAV_HEADER_LINK_TEXT.inactive}
      _hover={{
        bg: "transparent",
        color: "white",
      }}
      _active={{ bg: "transparent", color: "white" }}
      _focus={{ boxShadow: "none" }}
      _focusVisible={{
        boxShadow: "none",
        outline: "2px solid",
        outlineColor: "white",
        outlineOffset: "2px",
      }}
      px="2"
      minW="auto"
      h="auto"
      lineHeight="1"
      onClick={() => {
        void navigate("/activity");
      }}
    >
      <Box as="span" display="block" lineHeight="1" aria-hidden>
        <FaBell size={16} style={{ display: "block" }} />
      </Box>
      {unreadCount > 0 ? (
        <Box
          as="span"
          position="absolute"
          top="-1px"
          right="-1px"
          minW="1rem"
          h="1rem"
          px="1"
          display="inline-flex"
          alignItems="center"
          justifyContent="center"
          borderRadius="full"
          bg="orange.solid"
          color="white"
          fontSize="0.6rem"
          fontWeight="bold"
          lineHeight="1"
          borderWidth="1px"
          borderColor="navy.solid"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </Box>
      ) : null}
    </Button>
  );
}

/** Nav bar links: no underline; no sticky focus/hover chrome after click. */
const navBarLinkProps = {
  textDecoration: "none",
  borderBottom: "none",
  boxShadow: "none",
  _hover: {
    textDecoration: "none",
    borderBottom: "none",
    boxShadow: "none",
  },
  _active: {
    textDecoration: "none",
    borderBottom: "none",
    boxShadow: "none",
  },
  _visited: {
    textDecoration: "none",
  },
  _focus: {
    outline: "none",
    boxShadow: "none",
  },
  _focusVisible: {
    outline: "2px solid",
    outlineColor: "rgba(245, 241, 232, 0.85)",
    outlineOffset: "2px",
  },
} as const;

function isDesktopNavRouteActive(
  loc: { pathname: string; search: string },
  to: string,
): boolean {
  const { pathname, search: locSearch } = loc;
  if (to.startsWith("/profile?")) {
    if (pathname !== "/profile") return false;
    const want = new URLSearchParams(to.slice(to.indexOf("?") + 1));
    const have = new URLSearchParams(locSearch);
    for (const key of want.keys()) {
      if (want.get(key) !== have.get(key)) return false;
    }
    return true;
  }
  switch (to) {
    case "/quotes":
      return (
        pathname.startsWith("/quotes") ||
        pathname.startsWith("/friend/") ||
        pathname.includes("/public-quotes")
      );
    case "/songaday":
      return pathname === "/songaday" || pathname.startsWith("/songaday/");
    case "/closet":
      return pathname === "/closet" || pathname.startsWith("/closet/");
    case "/calendar":
      return pathname === "/calendar" || pathname.startsWith("/calendar/");
    case "/meal":
      return pathname === "/meal" || pathname.startsWith("/meal/");
    case "/scorenado":
      return pathname === "/scorenado" || pathname.startsWith("/scorenado/");
    case "/clicker":
      return pathname === "/clicker" || pathname.startsWith("/clicker/");
    case "/whatif":
      return pathname === "/whatif" || pathname.startsWith("/whatif/");
    case "/about":
      return pathname === "/about";
    case "/explore":
      return pathname === "/explore";
    case "/goals":
      return pathname === "/goals" || pathname.startsWith("/goals/");
    case "/zodiac":
      return pathname === "/zodiac" || pathname.startsWith("/zodiac/");
    case "/people":
      return pathname === "/people" || pathname.startsWith("/people/");
    case "/estates":
      return pathname === "/estates" || pathname.startsWith("/estates/");
    case "/qff":
      return pathname === "/qff" || pathname.startsWith("/qff/");
    case "/harbor":
      return pathname === "/harbor" || pathname.startsWith("/harbor/");
    case "/squalls":
      return pathname === "/squalls" || pathname.startsWith("/squalls/");
    default:
      return false;
  }
}

function isCategoryNavActive(
  loc: { pathname: string; search: string },
  items: AppNavItem[],
): boolean {
  return items.some((item) => isDesktopNavRouteActive(loc, item.to));
}

function NavBarLink({
  to,
  label,
  active,
}: {
  to: string;
  label: string;
  active: boolean;
}) {
  return (
    <ChakraLink
      asChild
      colorPalette="gray"
      variant="plain"
      {...navBarLinkProps}
      fontSize={NAV_APP_LINK_FONT_SIZE}
      fontWeight="normal"
      color={active ? NAV_HEADER_LINK_TEXT.active : NAV_HEADER_LINK_TEXT.inactive}
      _visited={{
        ...navBarLinkProps._visited,
        color: active ? NAV_HEADER_LINK_TEXT.active : NAV_HEADER_LINK_TEXT.inactive,
      }}
      _hover={{
        ...navBarLinkProps._hover,
        color: active ? NAV_HEADER_LINK_TEXT.active : "white",
      }}
      _active={{
        ...navBarLinkProps._active,
        color: active ? NAV_HEADER_LINK_TEXT.active : NAV_HEADER_LINK_TEXT.inactive,
      }}
    >
      <Link to={to}>
        <Box
          as="span"
          position="relative"
          display="inline-block"
          lineHeight={NAV_APP_LINK_LINE_HEIGHT}
          fontSize={NAV_APP_LINK_FONT_SIZE}
        >
          <Box as="span" fontWeight="bold" opacity={active ? 1 : 0}>
            {label}
          </Box>
          <Box
            as="span"
            position="absolute"
            top={0}
            left={0}
            fontWeight="normal"
            opacity={active ? 0 : 1}
          >
            {label}
          </Box>
        </Box>
      </Link>
    </ChakraLink>
  );
}

function NavCategoryMenu({
  label,
  items,
  loc,
  navigate,
}: {
  label: string;
  items: AppNavItem[];
  loc: { pathname: string; search: string };
  navigate: (to: string) => void;
}) {
  const active = isCategoryNavActive(loc, items);
  return (
    <Menu.Root positioning={{ placement: "bottom-start", gutter: 4 }}>
      <Menu.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          {...navBarLinkProps}
          fontSize={NAV_APP_LINK_FONT_SIZE}
          lineHeight={NAV_APP_LINK_LINE_HEIGHT}
          fontWeight="normal"
          color={active ? NAV_HEADER_LINK_TEXT.active : NAV_HEADER_LINK_TEXT.inactive}
          bg="transparent"
          _hover={{
            ...navBarLinkProps._hover,
            bg: "transparent",
            color: active ? NAV_HEADER_LINK_TEXT.active : "white",
          }}
          _active={{
            ...navBarLinkProps._active,
            bg: "transparent",
            color: active ? NAV_HEADER_LINK_TEXT.active : NAV_HEADER_LINK_TEXT.inactive,
          }}
          px="0"
          minW="auto"
          h="auto"
        >
          <Box
            as="span"
            position="relative"
            display="inline-block"
            lineHeight={NAV_APP_LINK_LINE_HEIGHT}
            fontSize={NAV_APP_LINK_FONT_SIZE}
          >
            <Box as="span" fontWeight="bold" opacity={active ? 1 : 0}>
              {label} ▾
            </Box>
            <Box
              as="span"
              position="absolute"
              top={0}
              left={0}
              fontWeight="normal"
              opacity={active ? 0 : 1}
            >
              {label} ▾
            </Box>
          </Box>
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="48">
          {items.map((item) => (
            <Menu.Item
              key={item.to}
              value={item.to.slice(1) || "home"}
              onSelect={() => {
                navigate(item.to);
              }}
              fontSize="sm"
            >
              <HStack gap="2" w="100%">
                <Text aria-hidden>{item.emoji}</Text>
                <Text>{navLinkLabel(item)}</Text>
              </HStack>
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
}

function HamburgerCategoryCollapsible({
  label,
  items,
  loc,
  navigate,
}: {
  label: string;
  items: AppNavItem[];
  loc: { pathname: string; search: string };
  navigate: (to: string) => void;
}) {
  const active = isCategoryNavActive(loc, items);
  return (
    <Collapsible.Root defaultOpen={active}>
      <Collapsible.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          w="100%"
          justifyContent="flex-start"
          fontSize="sm"
          fontWeight={active ? "semibold" : "normal"}
          borderRadius="sm"
          px="3"
          py="2"
          h="auto"
          minH="auto"
        >
          {label} ▾
        </Button>
      </Collapsible.Trigger>
      <Collapsible.Content>
        {items.map((item) => (
          <Menu.Item
            key={item.to}
            value={item.to.slice(1) || "home"}
            onSelect={() => {
              navigate(item.to);
            }}
            fontSize="sm"
            ps="6"
          >
            <HStack gap="2" w="100%">
              <Text aria-hidden>{item.emoji}</Text>
              <Text>{navLinkLabel(item)}</Text>
            </HStack>
          </Menu.Item>
        ))}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

/** Routes where the document scrollbar is hidden (keeps centered panels from shifting). */
const HIDE_DOCUMENT_SCROLLBAR_PREFIXES = [
  "/quotes",
  "/songaday",
  "/closet",
  "/calendar",
  "/meal",
  "/people",
  "/friend",
  "/pondstead",
  "/estates/play",
] as const;
/** Exact paths only (e.g. WhatIf entry at `/whatif`, not lobby/play/hand). */
const HIDE_DOCUMENT_SCROLLBAR_EXACT = ["/whatif"] as const;

export default function AppLayout() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated, auth0User, sessionUser, homeStarredAppPaths, logout, switchUser } =
    useAppSession();
  const currentUserAvatarUrl = resolveCurrentUserAvatarUrl(sessionUser, auth0User);
  const location = useLocation();
  const navigate = useNavigate();
  const useCompactNav = useNavCompactLayout();

  // `auth0User` is cleared when the Auth0 client logs out; rely on it so nav stays in sync.
  const showProfileNav = isAuthenticated && !!auth0User;
  const isApproved = !!sessionUser?.user?.is_approved;
  const navAccess = useMemo<AppNavAccess>(
    () => ({
      isAuthenticated: showProfileNav,
      isApproved,
      isStaff: !!sessionUser?.user?.is_staff,
    }),
    [showProfileNav, isApproved, sessionUser?.user?.is_staff],
  );
  const exploreProfile = sessionUser
    ? { ...sessionUser.profile, home_starred_app_paths: homeStarredAppPaths }
    : undefined;
  const showExploreNav =
    showProfileNav && hasUnstarredApps(navAccess, exploreProfile);
  const navLoc = useMemo(
    () => ({ pathname: location.pathname, search: location.search }),
    [location.pathname, location.search],
  );

  const isClickerRoute =
    location.pathname === "/clicker" ||
    location.pathname.startsWith("/clicker/");
  const isClickerPlayRoute =
    location.pathname.startsWith("/clicker/play") ||
    location.pathname === "/clicker/2";
  const isQffRoute =
    location.pathname === "/qff" || location.pathname.startsWith("/qff/");
  const isHarborRoute =
    location.pathname === "/harbor" ||
    location.pathname.startsWith("/harbor/");
  const isPondsteadRoute =
    location.pathname === "/pondstead" || location.pathname.startsWith("/pondstead/");
  const isEstatesPlayRoute = location.pathname.startsWith("/estates/play/");
  const isWhatIfPlayOrHandRoute =
    location.pathname.startsWith("/whatif/play/") ||
    location.pathname.startsWith("/whatif/hand/");
  const isScorenadoGameRoute = /^\/scorenado\/game\/[^/]+$/.test(
    location.pathname,
  );
  const squallsInGame = useSyncExternalStore(
    subscribeSquallsInGame,
    getSquallsInGame,
    () => false,
  );
  const hideSquallsBreadcrumbs =
    location.pathname === "/squalls/play" && squallsInGame;
  /** Aligned with `QffLayout` so the app shell is not the default cream. */
  const qffAppShellBg = "#0c0c0c";
  const isOnboardingRoute = location.pathname.startsWith("/onboarding");
  const isHomeIndex = location.pathname === "/";
  const isExploreIndex = location.pathname === "/explore";
  const isAboutIndex = location.pathname === "/about";

  useEffect(() => {
    const { pathname } = location;
    const hide =
      HIDE_DOCUMENT_SCROLLBAR_EXACT.some((p) => pathname === p) ||
      HIDE_DOCUMENT_SCROLLBAR_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(`${p}/`),
      );
    const cls = "pa-hide-scrollbar";
    const { documentElement: root, body } = document;
    root.classList.toggle(cls, hide);
    body.classList.toggle(cls, hide);
    return () => {
      root.classList.remove(cls);
      body.classList.remove(cls);
    };
  }, [location.pathname]);

  const accountMenu = showProfileNav ? (
    <Menu.Root positioning={{ placement: "bottom-end", gutter: 8 }}>
      <Menu.Trigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Open account menu"
          bg="transparent"
          _hover={{ bg: "transparent" }}
          _active={{ bg: "transparent" }}
          _focus={{ boxShadow: "none" }}
          _focusVisible={{ boxShadow: "none", outline: "none" }}
          px="1"
          minW="auto"
          h="auto"
        >
          <Avatar.Root size="sm">
            <Avatar.Fallback
              name={
                sessionUser?.profile.display_name ||
                auth0User?.name ||
                auth0User?.email ||
                "User"
              }
            />
            <Avatar.Image
              src={currentUserAvatarUrl || undefined}
            />
          </Avatar.Root>
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content minW="48">
          <Menu.Item
            value="profile"
            onSelect={() => {
              navigate("/profile");
            }}
          >
            Profile
          </Menu.Item>
          {sessionUser?.user?.is_approved ? (
            <Menu.Item
              value="friends"
              onSelect={() => {
                navigate("/profile?tab=friends");
              }}
            >
              Friends List
            </Menu.Item>
          ) : null}
          <Menu.Item
            value="logout"
            onSelect={() => {
              void logout();
            }}
          >
            Log Out
          </Menu.Item>
          <Menu.Item
            value="switch-user"
            onSelect={() => {
              switchUser();
            }}
          >
            Switch User
          </Menu.Item>
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  ) : !isAuthenticated ? (
    <PondButton
      colorPalette="lilypad"
      size="sm"
      onClick={() =>
        loginWithRedirect({
          authorizationParams: auth0LoginAuthorizationParams(),
        })
      }
    >
      Log in
    </PondButton>
  ) : null;

  return (
    <HomeInboxProvider>
    <Box
      flex="1"
      display="flex"
      flexDirection="column"
      minH="100%"
      w="100%"
      maxW="100%"
      bg={isQffRoute ? qffAppShellBg : "bg"}
      color="fg"
    >
      {!isOnboardingRoute ? (
      <Flex
        as="header"
        px={{ base: "2", md: "2" }}
        py="2"
        align="center"
        bg="sky.emphasized"
        color="navy.fg"
        position="relative"
        w="100%"
      >
        {useCompactNav ? (
          <>
            <Box
              flex="0 1 auto"
              display="flex"
              justifyContent="flex-start"
              minW={0}
            >
              <HStack gap="1.5" align="center">
                <Menu.Root positioning={{ placement: "bottom-start", gutter: 8 }}>
                  <Menu.Trigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Open navigation menu"
                      color="navy.fg"
                      bg="transparent"
                      _hover={{ bg: "transparent" }}
                      _active={{ bg: "transparent" }}
                      _focus={{ boxShadow: "none" }}
                      _focusVisible={{ boxShadow: "none", outline: "none" }}
                      px="2"
                      minW="auto"
                      lineHeight="1"
                      fontSize="lg"
                    >
                      ☰
                    </Button>
                  </Menu.Trigger>
                  <Menu.Positioner>
                    <Menu.Content minW="52">
                      <Menu.Item
                        value="home"
                        onSelect={() => {
                          navigate("/");
                        }}
                        fontSize="sm"
                      >
                        <HStack gap="2" w="100%">
                          <Text aria-hidden>🏠</Text>
                          <Text>Home</Text>
                        </HStack>
                      </Menu.Item>
                      {showProfileNav ? (
                        <>
                          {NAV_CATEGORIES.map((category) => {
                            const items = getFilteredCategoryItems(category, navAccess);
                            if (items.length === 0) return null;
                            return (
                              <HamburgerCategoryCollapsible
                                key={category.id}
                                label={category.label}
                                items={items}
                                loc={navLoc}
                                navigate={(to) => {
                                  navigate(to);
                                }}
                              />
                            );
                          })}
                          {showExploreNav ? (
                            <Menu.Item
                              value="explore"
                              onSelect={() => {
                                navigate(EXPLORE_APP.to);
                              }}
                              fontSize="sm"
                            >
                              <HStack gap="2" w="100%">
                                <Text aria-hidden>{EXPLORE_APP.emoji}</Text>
                                <Text>{EXPLORE_APP.label}</Text>
                              </HStack>
                            </Menu.Item>
                          ) : null}
                          <Menu.Item
                            value="about"
                            onSelect={() => {
                              navigate(ABOUT.to);
                            }}
                            fontSize="sm"
                          >
                            <HStack gap="2" w="100%">
                              <Text aria-hidden>{ABOUT.emoji}</Text>
                              <Text>{ABOUT.label}</Text>
                            </HStack>
                          </Menu.Item>
                        </>
                      ) : (
                        <>
                          <Menu.Item
                            value="login"
                            onSelect={() => {
                              void loginWithRedirect({
                                authorizationParams: auth0LoginAuthorizationParams(),
                              });
                            }}
                            fontSize="sm"
                          >
                            <HStack gap="2" w="100%">
                              <Text aria-hidden>🔐</Text>
                              <Text>Log in</Text>
                            </HStack>
                          </Menu.Item>
                          <Menu.Item
                            value="sign-up"
                            onSelect={() => {
                              void loginWithRedirect({
                                authorizationParams: auth0SignupAuthorizationParams(),
                              });
                            }}
                            fontSize="sm"
                          >
                            <HStack gap="2" w="100%">
                              <Text aria-hidden>📝</Text>
                              <Text>Sign up</Text>
                            </HStack>
                          </Menu.Item>
                          {/* {auth0SlackLoginAuthorizationParams() ? (
                            <Menu.Item
                              value="login-slack"
                              onSelect={() => {
                                void loginWithRedirect({
                                  authorizationParams:
                                    auth0SlackLoginAuthorizationParams()!,
                                });
                              }}
                              fontSize="sm"
                            >
                              <HStack gap="2" w="100%">
                                <Text aria-hidden>💬</Text>
                                <Text>Log in with Slack</Text>
                              </HStack>
                            </Menu.Item>
                          ) : null}
                          {auth0SlackSignupAuthorizationParams() ? (
                            <Menu.Item
                              value="sign-up-slack"
                              onSelect={() => {
                                void loginWithRedirect({
                                  authorizationParams:
                                    auth0SlackSignupAuthorizationParams()!,
                                });
                              }}
                              fontSize="sm"
                            >
                              <HStack gap="2" w="100%">
                                <Text aria-hidden>💬</Text>
                                <Text>Sign up with Slack</Text>
                              </HStack>
                            </Menu.Item>
                          ) : null} */}
                          {guestHamburgerNavItems().map((item) => (
                            <Menu.Item
                              key={item.to}
                              value={item.to.slice(1) || "home"}
                              onSelect={() => {
                                navigate(item.to);
                              }}
                              fontSize="sm"
                            >
                              <HStack gap="2" w="100%">
                                <Text aria-hidden>{item.emoji}</Text>
                                <Text>{item.label}</Text>
                              </HStack>
                            </Menu.Item>
                          ))}
                        </>
                      )}
                    </Menu.Content>
                  </Menu.Positioner>
                </Menu.Root>
                <ChakraLink
                  asChild
                  colorPalette="gray"
                  variant="plain"
                  color="navy.fg"
                  {...navBarLinkProps}
                  fontFamily={NAV_WORDMARK_FONT}
                  fontWeight="normal"
                  letterSpacing="normal"
                  fontSize={NAV_WORDMARK_MOBILE_FONT_SIZE}
                  lineHeight={NAV_WORDMARK_LINE_HEIGHT}
                >
                  <Link to="/">
                    <HStack gap="1.5" align="center">
                      <Image
                        src={pondarborLogoSrc()}
                        alt="PondArbor"
                        h="1.1em"
                        w="auto"
                        maxH="1.1em"
                        objectFit="contain"
                        display="block"
                      />
                      <Text
                        as="span"
                        lineHeight={NAV_WORDMARK_LINE_HEIGHT}
                        whiteSpace="nowrap"
                      >
                        Pond Arbor
                      </Text>
                    </HStack>
                  </Link>
                </ChakraLink>
              </HStack>
            </Box>
            <Box flex="1" display="flex" justifyContent="flex-end" minW={0}>
              <HStack gap="0" align="center" flexShrink={0}>
                {showProfileNav ? (
                  <>
                    <BellNavButton />
                    {accountMenu}
                  </>
                ) : (
                  accountMenu
                )}
              </HStack>
            </Box>
          </>
        ) : (
          <>
            <HStack gap={NAV_HSTACK_GAP} align="center">
              <ChakraLink
                asChild
                colorPalette="gray"
                variant="plain"
                {...navBarLinkProps}
                color="navy.fg"
                _visited={{ ...navBarLinkProps._visited, color: "navy.fg" }}
                _hover={{ ...navBarLinkProps._hover, color: "white" }}
                _active={{ ...navBarLinkProps._active, color: "white" }}
              >
                <Link to="/">
                  <Box
                    display="inline-flex"
                    alignItems="center"
                    justifyContent="center"
                    lineHeight={NAV_WORDMARK_LINE_HEIGHT}
                    fontSize={NAV_WORDMARK_FONT_SIZE}
                  >
                    <Image
                      src={pondarborLogoSrc()}
                      alt="PondArbor"
                      h="1.1em"
                      w="auto"
                      maxH="1.1em"
                      objectFit="contain"
                      display="block"
                    />
                  </Box>
                </Link>
              </ChakraLink>

              <ChakraLink
                asChild
                colorPalette="gray"
                variant="plain"
                {...navBarLinkProps}
                color="navy.fg"
                _visited={{ ...navBarLinkProps._visited, color: "navy.fg" }}
                _hover={{ ...navBarLinkProps._hover, color: "white" }}
                _active={{ ...navBarLinkProps._active, color: "white" }}
                fontFamily={NAV_WORDMARK_FONT}
                fontWeight="normal"
                letterSpacing="normal"
                fontSize={NAV_WORDMARK_FONT_SIZE}
                lineHeight={NAV_WORDMARK_LINE_HEIGHT}
                mx={{ base: "1", md: "1" }}
              >
                <Link to="/">Pond Arbor</Link>
              </ChakraLink>

              <HStack
                gap={NAV_APP_LINK_HSTACK_GAP}
                align="center"
                pl={WORDMARK_TO_APP_NAV_PL}
              >
                {showProfileNav ? (
                  <>
                    {NAV_CATEGORIES.map((category) => {
                      const items = getFilteredCategoryItems(category, navAccess);
                      if (items.length === 0) return null;
                      return (
                        <NavCategoryMenu
                          key={category.id}
                          label={category.label}
                          items={items}
                          loc={navLoc}
                          navigate={(to) => {
                            navigate(to);
                          }}
                        />
                      );
                    })}
                    {showExploreNav ? (
                      <NavBarLink
                        to={EXPLORE_APP.to}
                        label={EXPLORE_APP.label}
                        active={isDesktopNavRouteActive(navLoc, EXPLORE_APP.to)}
                      />
                    ) : null}
                    <NavBarLink
                      to={ABOUT.to}
                      label={ABOUT.label}
                      active={isDesktopNavRouteActive(navLoc, ABOUT.to)}
                    />
                  </>
                ) : (
                  guestHamburgerNavItems().map((entry) => (
                    <NavBarLink
                      key={entry.to}
                      to={entry.to}
                      label={navLinkLabel(entry)}
                      active={isDesktopNavRouteActive(navLoc, entry.to)}
                    />
                  ))
                )}
              </HStack>
            </HStack>
            <Spacer />
            {showProfileNav ? (
              <HStack gap="0" align="center" flexShrink={0}>
                <BellNavButton />
                {accountMenu}
              </HStack>
            ) : (
              accountMenu
            )}
          </>
        )}
      </Flex>
      ) : null}
      <Box
        as="main"
        flex="1"
        minW={0}
        w="100%"
        maxW="100%"
        {...(isQffRoute
          ? { p: 0, bg: qffAppShellBg }
          : isHarborRoute ||
              isPondsteadRoute ||
              isEstatesPlayRoute ||
              isClickerPlayRoute ||
              isScorenadoGameRoute ||
              hideSquallsBreadcrumbs
            ? { p: 0, bg: "transparent" }
            : {
                pt: "2px",
                px: "2px",
                pb: 0,
                bg: "transparent",
              })}
        display="flex"
        flexDirection="column"
        minH="0"
      >
        <Box
          flex="1"
          minH="0"
          minW={0}
          w="100%"
          display="flex"
          flexDirection="column"
          {...(isClickerRoute ||
          isHarborRoute ||
          isPondsteadRoute ||
          isEstatesPlayRoute ||
          isScorenadoGameRoute ||
          hideSquallsBreadcrumbs
            ? { p: 0 }
            : {
                px: 0,
                // Home / about: full-bleed footer; avoid padding below the outlet column.
                pb:
                  isHomeIndex || isExploreIndex || isAboutIndex
                    ? 0
                    : { base: "2", md: "2" },
                pt: 0,
              })}
        >
          {!(
            isOnboardingRoute ||
            isQffRoute ||
            isClickerPlayRoute ||
            isHarborRoute ||
            isPondsteadRoute ||
            isEstatesPlayRoute ||
            isWhatIfPlayOrHandRoute ||
            hideSquallsBreadcrumbs
          ) ? (
            <Box {...APP_SHELL_CONTENT_MAX_PROPS} px={{ base: "2", md: "2" }}>
              <BreadcrumbBar />
            </Box>
          ) : null}
          <Box
            flex="1"
            minW={0}
            w="100%"
            display="flex"
            flexDirection="column"
            {...APP_SHELL_OUTLET_MIN_HEIGHT_PROPS}
          >
            <RequireOnboardingComplete>
              <Outlet />
            </RequireOnboardingComplete>
          </Box>
        </Box>
      </Box>
    </Box>
    </HomeInboxProvider>
  );
}
