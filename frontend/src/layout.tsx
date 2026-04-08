import {
  Avatar,
  Box,
  Button,
  Flex,
  HStack,
  Image,
  Link as ChakraLink,
  Menu,
  Spacer,
  Text,
} from "@chakra-ui/react";
import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router";

import {
  auth0LoginAuthorizationParams,
  auth0SignupAuthorizationParams,
} from "./auth/auth0LoginParams";
import { useAppSession } from "./auth/AppSessionContext";
import { pondarborLogoSrc } from "./publicAsset";
import { useIsMobile } from "./responsive";
import PondButton from "./PondButton";

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
    case "/closet":
      return pathname === "/closet" || pathname.startsWith("/closet/");
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

/** How close to the document bottom (px) before the footer is shown. */
const FOOTER_REVEAL_NEAR_BOTTOM_PX = 72;

/** Routes where the document scrollbar is hidden (keeps centered panels from shifting). */
const HIDE_DOCUMENT_SCROLLBAR_PREFIXES = ["/quotes", "/closet"] as const;
/** Exact paths only (e.g. WhatIf entry at `/whatif`, not lobby/play/hand). */
const HIDE_DOCUMENT_SCROLLBAR_EXACT = ["/whatif"] as const;

function useFooterVisibleNearPageBottom(pathname: string) {
  const [visible, setVisible] = useState(false);

  const update = useCallback(() => {
    const el = document.documentElement;
    const body = document.body;
    const scrollHeight = Math.max(el.scrollHeight, body.scrollHeight);
    const innerH = window.innerHeight;
    const y = window.scrollY;

    if (scrollHeight <= innerH + 2) {
      setVisible(true);
      return;
    }
    setVisible(y + innerH >= scrollHeight - FOOTER_REVEAL_NEAR_BOTTOM_PX);
  }, []);

  useEffect(() => {
    setVisible(false);
    requestAnimationFrame(() => update());
  }, [pathname, update]);

  useEffect(() => {
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const ro = new ResizeObserver(() => update());
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, [update]);

  return visible;
}

export default function AppLayout() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated, auth0User, sessionUser, logout, switchUser } = useAppSession();
  const location = useLocation();
  const footerVisible = useFooterVisibleNearPageBottom(location.pathname);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // `auth0User` is cleared when the Auth0 client logs out; rely on it so nav stays in sync.
  const showProfileNav = isAuthenticated && !!auth0User;
  const desktopNavLinks = useMemo(
    () =>
      showProfileNav
        ? [
            { to: "/quotes", label: "Quotes" },
            { to: "/closet", label: "Closet" },
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
    location.pathname === "/clicker" || location.pathname.startsWith("/clicker/");

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
                sessionUser?.profile.avatar_url || auth0User?.picture || undefined
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
        px={{ base: "4", md: "6" }}
        py="4"
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
                          value="closet"
                          onSelect={() => {
                            navigate("/closet");
                          }}
                        >
                          Closet
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
                              authorizationParams: auth0LoginAuthorizationParams(),
                            });
                          }}
                        >
                          Log In
                        </Menu.Item>
                        <Menu.Item
                          value="sign-up"
                          onSelect={() => {
                            void loginWithRedirect({
                              authorizationParams: auth0SignupAuthorizationParams(),
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
                <Link to="/">Pond Arbor</Link>
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
                mx={{ base: "4", md: "6" }}
              >
                <Link to="/">Pond Arbor</Link>
              </ChakraLink>

              {desktopNavLinks.map((link) => {
                const active = isDesktopNavRouteActive(location.pathname, link.to);
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
                        <Box as="span" fontWeight="bold" opacity={active ? 1 : 0}>
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
              px: { base: "4", md: "6" },
              pb: { base: "4", md: "6" },
              pt: 0,
            })}
        bg="transparent"
        display="flex"
        flexDirection="column"
        minH="0"
      >
        <Box flex="1" minH="0" minW={0} w="100%" display="flex" flexDirection="column">
          <Outlet />
        </Box>
      </Box>
      <Box
        as="footer"
        w="100%"
        flexShrink={0}
        bg="lilypad.solid"
        overflow="hidden"
        maxH={footerVisible ? "4rem" : "0"}
        opacity={footerVisible ? 1 : 0}
        transitionProperty="max-height, opacity"
        transitionDuration="0.22s"
        transitionTimingFunction="ease"
        aria-hidden={!footerVisible}
      >
        <Box py="2" px={{ base: "4", md: "6" }}>
          <Text textAlign="center" fontSize="xs" color="fg">
            © 2026{" "}
            <ChakraLink
              asChild
              color="black"
              textDecoration="none"
              _hover={{ color: "sky.solid", textDecoration: "none" }}
            >
              <Link to="/about">Pond Arbor Workshop</Link>
            </ChakraLink>
            . All rights reserved.
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
