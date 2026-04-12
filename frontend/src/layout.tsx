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
} from "@chakra-ui/react";
import { useEffect, useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";

import { useAppSession } from "./auth/AppSessionContext";
import {
  auth0LoginAuthorizationParams,
  auth0SignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import PondButton from "./PondButton";
import { pondarborLogoSrc } from "./publicAsset";
import { useIsMobile } from "./responsive";

/** Wordmark font; fixed look (no route-based styling). */
const NAV_WORDMARK_FONT = '"Brush Script MT", "Segoe Script", cursive';
const NAV_WORDMARK_FONT_SIZE = "calc(2em + 6px)";
const NAV_WORDMARK_LINE_HEIGHT = "1.1";

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
    outlineColor: "rgba(0, 0, 0, 0.45)",
    outlineOffset: "2px",
  },
} as const;

function isDesktopNavRouteActive(pathname: string, to: string): boolean {
  switch (to) {
    case "/quotes":
      return (
        pathname.startsWith("/quotes") ||
        pathname.startsWith("/friend/") ||
        pathname.includes("/public-quotes")
      );
    case "/songaday":
      return (
        pathname === "/songaday" ||
        (pathname.startsWith("/songaday/") && !pathname.startsWith("/songaday/archive"))
      );
    case "/songaday/archive":
      return pathname === "/songaday/archive";
    case "/closet":
      return pathname === "/closet" || pathname.startsWith("/closet/");
    case "/meal":
      return pathname === "/meal" || pathname.startsWith("/meal/");
    case "/clicker":
      return pathname === "/clicker" || pathname.startsWith("/clicker/");
    case "/whatif":
      return pathname === "/whatif" || pathname.startsWith("/whatif/");
    case "/about":
      return pathname === "/about";
    default:
      return false;
  }
}

/** Routes where the document scrollbar is hidden (keeps centered panels from shifting). */
const HIDE_DOCUMENT_SCROLLBAR_PREFIXES = ["/quotes", "/songaday", "/closet", "/meal"] as const;
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
  const desktopNavLinks = useMemo(
    () =>
      showProfileNav
        ? [
            { to: "/quotes", label: "Quotes" },
            { to: "/songaday", label: "Song a Day" },
            { to: "/songaday/archive", label: "Song archive" },
            { to: "/closet", label: "Closet" },
            { to: "/meal", label: "Meal Maestro" },
            { to: "/clicker", label: "PondClicker" },
            { to: "/whatif", label: "WhatIf" },
            { to: "/about", label: "About" },
          ]
        : [
            { to: "/whatif", label: "WhatIf" },
            { to: "/about", label: "About" },
          ],
    [showProfileNav],
  );

  const isClickerRoute =
    location.pathname === "/clicker" ||
    location.pathname.startsWith("/clicker/");
  const isHomeIndex = location.pathname === "/";

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
      colorPalette="sky"
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
      bg="sky.solid"
      color="fg"
    >
      <Flex
        as="header"
        px={{ base: "2", md: "2" }}
        py="2"
        align="center"
        bg="lilypad.solid"
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
                  <Menu.Content minW="48">
                    <Menu.Item
                      value="home"
                      onSelect={() => {
                        navigate("/");
                      }}
                    >
                      Home
                    </Menu.Item>
                    {showProfileNav ? (
                      <>
                        <Menu.Item
                          value="quotes"
                          onSelect={() => {
                            navigate("/quotes");
                          }}
                        >
                          Quotes
                        </Menu.Item>
                        <Menu.Item
                          value="songaday"
                          onSelect={() => {
                            navigate("/songaday");
                          }}
                        >
                          Song a Day
                        </Menu.Item>
                        <Menu.Item
                          value="songaday-archive"
                          onSelect={() => {
                            navigate("/songaday/archive");
                          }}
                        >
                          Song archive
                        </Menu.Item>
                        <Menu.Item
                          value="closet"
                          onSelect={() => {
                            navigate("/closet");
                          }}
                        >
                          Closet
                        </Menu.Item>
                        <Menu.Item
                          value="meal"
                          onSelect={() => {
                            navigate("/meal");
                          }}
                        >
                          Meal Maestro
                        </Menu.Item>
                        <Menu.Item
                          value="clicker"
                          onSelect={() => {
                            navigate("/clicker");
                          }}
                        >
                          Clicker
                        </Menu.Item>
                        <Menu.Item
                          value="whatif"
                          onSelect={() => {
                            navigate("/whatif");
                          }}
                        >
                          WhatIf
                        </Menu.Item>
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
                        >
                          Log In
                        </Menu.Item>
                        <Menu.Item
                          value="sign-up"
                          onSelect={() => {
                            void loginWithRedirect({
                              authorizationParams:
                                auth0SignupAuthorizationParams(),
                            });
                          }}
                        >
                          Sign Up
                        </Menu.Item>
                        <Menu.Item
                          value="whatif"
                          onSelect={() => {
                            navigate("/whatif");
                          }}
                        >
                          WhatIf
                        </Menu.Item>
                      </>
                    )}
                    <Menu.Item
                      value="about"
                      onSelect={() => {
                        navigate("/about");
                      }}
                    >
                      About
                    </Menu.Item>
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
            <HStack gap="4" align="center">
              <ChakraLink
                asChild
                colorPalette="gray"
                variant="plain"
                {...navBarLinkProps}
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
                fontFamily={NAV_WORDMARK_FONT}
                fontWeight="normal"
                letterSpacing="normal"
                fontSize={NAV_WORDMARK_FONT_SIZE}
                lineHeight={NAV_WORDMARK_LINE_HEIGHT}
                mx={{ base: "2", md: "2" }}
              >
                <Link to="/">PondArbor</Link>
              </ChakraLink>

              {desktopNavLinks.map((link) => {
                const active = isDesktopNavRouteActive(
                  location.pathname,
                  link.to,
                );
                return (
                  <ChakraLink
                    key={link.to}
                    asChild
                    colorPalette="gray"
                    variant="plain"
                    {...navBarLinkProps}
                    fontWeight="normal"
                    color={active ? "white" : "black"}
                    _visited={{
                      ...navBarLinkProps._visited,
                      color: active ? "white" : "black",
                    }}
                    _hover={{
                      ...navBarLinkProps._hover,
                      color: active ? "white" : "black",
                    }}
                    _active={{
                      ...navBarLinkProps._active,
                      color: active ? "white" : "black",
                    }}
                  >
                    <Link to={link.to}>
                      <Box
                        as="span"
                        position="relative"
                        display="inline-block"
                        lineHeight={NAV_WORDMARK_LINE_HEIGHT}
                      >
                        {/* Keep width stable: bold text is always in-flow, normal text is overlaid when inactive. */}
                        <Box
                          as="span"
                          fontWeight="bold"
                          opacity={active ? 1 : 0}
                        >
                          {link.label}
                        </Box>
                        <Box
                          as="span"
                          position="absolute"
                          top={0}
                          left={0}
                          fontWeight="normal"
                          opacity={active ? 0 : 1}
                        >
                          {link.label}
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
        {...(isClickerRoute
          ? { p: 0 }
          : {
              px: { base: "2", md: "2" },
              // Home embeds a full-width footer; main bottom padding would show sky below it.
              pb: isHomeIndex ? 0 : { base: "2", md: "2" },
              pt: 0,
            })}
        bg="transparent"
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
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
