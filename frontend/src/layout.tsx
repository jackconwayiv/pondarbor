import { useAuth0 } from "@auth0/auth0-react";
import {
  Avatar,
  Box,
  Button,
  Link as ChakraLink,
  Flex,
  HStack,
  Image,
  Menu,
  Spacer,
  Text,
} from "@chakra-ui/react";
import { useEffect, useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";

import { useAppSession } from "./auth/AppSessionContext";
import {
  auth0LoginAuthorizationParams,
  auth0SignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import {
  APP_DESKTOP_NAV,
  guestHamburgerNavItems,
  navLinkLabel,
} from "./appNavConfig";
import PondButton from "./PondButton";
import { pondarborLogoSrc } from "./publicAsset";
import BreadcrumbBar from "./BreadcrumbBar";
import { useIsMobile } from "./responsive";
import { APP_SHELL_CONTENT_MAX_PROPS } from "./theme/typography";

/** Wordmark font; fixed look (no route-based styling). */
const NAV_WORDMARK_FONT = '"Brush Script MT", "Segoe Script", cursive';
const NAV_WORDMARK_FONT_SIZE = "calc(1.6em + 2px)";
const NAV_WORDMARK_LINE_HEIGHT = "1.1";
/** Slightly smaller app links in the top bar. */
const NAV_APP_LINK_FONT_SIZE = "0.8125rem";
const NAV_APP_LINK_LINE_HEIGHT = "1.2";
const NAV_HSTACK_GAP = "1.5";

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

const HEADER_NAV_LINK = {
  active: "white",
  inactive: "rgba(245, 241, 232, 0.75)",
} as const;

function isGamesNavTreeActive(pathname: string): boolean {
  return (
    pathname === "/games" ||
    pathname === "/clicker" ||
    pathname.startsWith("/clicker/") ||
    pathname === "/whatif" ||
    pathname.startsWith("/whatif/")
  );
}

function isDesktopNavRouteActive(pathname: string, to: string): boolean {
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
    case "/clicker":
      return pathname === "/clicker" || pathname.startsWith("/clicker/");
    case "/whatif":
      return pathname === "/whatif" || pathname.startsWith("/whatif/");
    case "/games":
      return isGamesNavTreeActive(pathname);
    case "/about":
      return pathname === "/about";
    default:
      return false;
  }
}

/** Routes where the document scrollbar is hidden (keeps centered panels from shifting). */
const HIDE_DOCUMENT_SCROLLBAR_PREFIXES = [
  "/quotes",
  "/songaday",
  "/closet",
  "/calendar",
  "/meal",
] as const;
/** Exact paths only (e.g. WhatIf entry at `/whatif`, not lobby/play/hand). */
const HIDE_DOCUMENT_SCROLLBAR_EXACT = ["/whatif"] as const;

export default function AppLayout() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated, auth0User, sessionUser, logout, switchUser } =
    useAppSession();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // `auth0User` is cleared when the Auth0 client logs out; rely on it so nav stays in sync.
  const showProfileNav = isAuthenticated && !!auth0User;
  const desktopNavEntries = useMemo(
    () => (showProfileNav ? APP_DESKTOP_NAV : guestHamburgerNavItems()),
    [showProfileNav],
  );

  const isClickerRoute =
    location.pathname === "/clicker" ||
    location.pathname.startsWith("/clicker/");
  const isQffRoute =
    location.pathname === "/qff" || location.pathname.startsWith("/qff/");
  /** Aligned with `QffLayout` so the app shell is not the default cream. */
  const qffAppShellBg = "#0c0c0c";
  const isHomeIndex = location.pathname === "/";
  const isGamesHubIndex = location.pathname === "/games";

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
              src={
                sessionUser?.profile.avatar_url ||
                auth0User?.picture ||
                undefined
              }
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
                navigate("/friends");
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
      <Flex
        as="header"
        px={{ base: "2", md: "2" }}
        py="2"
        align="center"
        bg="navy.solid"
        color="navy.fg"
        position="relative"
        w="100%"
      >
        {isMobile ? (
          <>
            <Box flex="1" display="flex" justifyContent="flex-start" minW={0}>
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
                        {APP_DESKTOP_NAV.map((item) => (
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
                    ) : (
                      <>
                        <Menu.Item
                          value="login"
                          onSelect={() => {
                            void loginWithRedirect({
                              authorizationParams:
                                auth0LoginAuthorizationParams(),
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
                              authorizationParams:
                                auth0SignupAuthorizationParams(),
                            });
                          }}
                          fontSize="sm"
                        >
                          <HStack gap="2" w="100%">
                            <Text aria-hidden>📝</Text>
                            <Text>Sign up</Text>
                          </HStack>
                        </Menu.Item>
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
            </Box>
            <Box
              position="absolute"
              left="50%"
              transform="translateX(-50%)"
              zIndex={1}
              maxW="calc(100% - 7rem)"
              textAlign="center"
            >
              <ChakraLink
                asChild
                colorPalette="gray"
                variant="plain"
                color="navy.fg"
                {...navBarLinkProps}
                fontFamily={NAV_WORDMARK_FONT}
                fontWeight="normal"
                letterSpacing="normal"
                fontSize={NAV_WORDMARK_FONT_SIZE}
                lineHeight={NAV_WORDMARK_LINE_HEIGHT}
              >
                <Link to="/">PondArbor</Link>
              </ChakraLink>
            </Box>
            <Box flex="1" display="flex" justifyContent="flex-end" minW={0}>
              {accountMenu}
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
                <Link to="/">PondArbor</Link>
              </ChakraLink>

              {desktopNavEntries.map((entry) => {
                const active = isDesktopNavRouteActive(
                  location.pathname,
                  entry.to,
                );
                const label = navLinkLabel(entry);
                return (
                  <ChakraLink
                    key={entry.to}
                    asChild
                    colorPalette="gray"
                    variant="plain"
                    {...navBarLinkProps}
                    fontSize={NAV_APP_LINK_FONT_SIZE}
                    fontWeight="normal"
                    color={active ? HEADER_NAV_LINK.active : HEADER_NAV_LINK.inactive}
                    _visited={{
                      ...navBarLinkProps._visited,
                      color: active
                        ? HEADER_NAV_LINK.active
                        : HEADER_NAV_LINK.inactive,
                    }}
                    _hover={{
                      ...navBarLinkProps._hover,
                      color: active
                        ? HEADER_NAV_LINK.active
                        : "white",
                    }}
                    _active={{
                      ...navBarLinkProps._active,
                      color: active
                        ? HEADER_NAV_LINK.active
                        : HEADER_NAV_LINK.inactive,
                    }}
                  >
                    <Link to={entry.to}>
                      <Box
                        as="span"
                        position="relative"
                        display="inline-block"
                        lineHeight={NAV_APP_LINK_LINE_HEIGHT}
                        fontSize={NAV_APP_LINK_FONT_SIZE}
                      >
                        <Box
                          as="span"
                          fontWeight="bold"
                          opacity={active ? 1 : 0}
                        >
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
              })}
            </HStack>
            <Spacer />
            {accountMenu}
          </>
        )}
      </Flex>
      <Box
        as="main"
        flex="1"
        minW={0}
        w="100%"
        maxW="100%"
        {...(isQffRoute
          ? { p: 0, bg: qffAppShellBg }
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
          {...(isClickerRoute
            ? { p: 0 }
            : {
                px: 0,
                // Home / games: full-bleed footer; avoid padding below the outlet column.
                pb:
                  isHomeIndex || isGamesHubIndex
                    ? 0
                    : { base: "2", md: "2" },
                pt: 0,
              })}
        >
          {!(isQffRoute || isClickerRoute) ? (
            <Box {...APP_SHELL_CONTENT_MAX_PROPS} px={{ base: "2", md: "2" }}>
              <BreadcrumbBar />
            </Box>
          ) : null}
          <Box
            flex="1"
            minH="0"
            minW={0}
            w="100%"
            display="flex"
            flexDirection="column"
          >
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
