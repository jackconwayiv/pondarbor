import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  Flex,
  Heading,
  HStack,
  Image,
  Link,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { Link as RouterLink } from "react-router";

import { submitContactMessage } from "./about/contactApi";
import { useAppSession } from "./auth/AppSessionContext";
import { auth0LoginAuthorizationParams } from "./auth/auth0LoginParams";
import PondButton from "./PondButton";
import { pondarborProfileSrc } from "./publicAsset";
import { fullBleedStackProps, useIsMobile } from "./responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
  PANEL_FIELD_PROPS,
} from "./theme/typography";

const CONTACT_MESSAGE_MAX = 4000;
export default function AboutPage() {
  const { loginWithRedirect } = useAuth0();
  const { isAuthenticated, sessionUser, getApiAccessToken } = useAppSession();
  const approved = !!sessionUser?.user?.is_approved;
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const onSubmit = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Please enter a message.");
      return;
    }
    if (trimmed.length > CONTACT_MESSAGE_MAX) {
      setError(`Message must be at most ${CONTACT_MESSAGE_MAX} characters.`);
      return;
    }
    setBusy(true);
    setError(null);
    setFeedback(null);
    try {
      const token = await getApiAccessToken();
      await submitContactMessage(token, {
        message: trimmed,
        website: honeypot,
      });
      setMessage("");
      setFeedback("Thanks — your message was sent.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }, [getApiAccessToken, honeypot, message]);

  return (
    <Stack flex="1" minH="full" gap="0" {...fullBleedStackProps}>
      <Box
        flex="1"
        bg="bg"
        px={0}
        py={{ base: "2", md: "2" }}
      >
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "4", md: "4" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading
                as="h1"
                size={{ base: "lg", md: "xl" }}
                fontWeight="bold"
                mb="2"
                letterSpacing="tight"
              >
                PondArbor
              </Heading>
              <Flex
                flexDirection={isMobile ? "column" : "row"}
                alignItems={isMobile ? "stretch" : "flex-start"}
                gap={isMobile ? "4" : "0"}
              >
                <Image
                  src={pondarborProfileSrc()}
                  width="150px"
                  maxW="100%"
                  flexShrink={0}
                  borderRadius="md"
                />
                <Stack gap="3" flex="1" minW={0}>
                  <Text
                    fontSize={APP_TEXT_SIZES.body}
                    lineHeight="tall"
                    color="fg"
                  >
                    PondArbor is a hobby project developed by Pond Arbor
                    Workshop to collect various app ideas together in one place.
                    It is shared with friends and family as an opportunity to
                    interact through quotes, a community closet, PondClicker,
                    WhatIf, and other features.
                  </Text>
                  <HStack gap="2" flexWrap="wrap" align="center">
                    <Link
                      asChild
                      color="fg.muted"
                      fontSize={APP_TEXT_SIZES.helper}
                      fontWeight="medium"
                      textDecoration="underline"
                      textUnderlineOffset="0.12em"
                      _hover={{ color: "sky.solid", textDecoration: "underline" }}
                    >
                      <RouterLink to="/about/privacy">Privacy Policy</RouterLink>
                    </Link>
                    <Text
                      as="span"
                      userSelect="none"
                      color="fg.muted"
                      fontSize={APP_TEXT_SIZES.helper}
                    >
                      ·
                    </Text>
                    <Link
                      asChild
                      color="fg.muted"
                      fontSize={APP_TEXT_SIZES.helper}
                      fontWeight="medium"
                      textDecoration="underline"
                      textUnderlineOffset="0.12em"
                      _hover={{ color: "sky.solid", textDecoration: "underline" }}
                    >
                      <RouterLink to="/about/terms">Terms of Service</RouterLink>
                    </Link>
                  </HStack>
                </Stack>
              </Flex>
            </Box>

            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading as="h2" size="md" fontWeight="semibold" mb="3">
                Contact us
              </Heading>
              {!isAuthenticated ? (
                <Stack gap="3" align="flex-start">
                  <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                    Log in to send a message.
                  </Text>
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
                </Stack>
              ) : !approved ? (
                <Text
                  fontSize={APP_TEXT_SIZES.body}
                  color="nautical.solid"
                  fontWeight="medium"
                >
                  Your account must be approved before you can contact us from
                  here.
                </Text>
              ) : (
                <Stack gap="3" align="stretch" maxW="lg">
                  <Box display="none" aria-hidden="true">
                    <input
                      name="website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                    />
                  </Box>
                  <Stack gap="1.5">
                    <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
                      Message:
                    </Text>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      minH="140px"
                      placeholder="Your message…"
                      {...PANEL_FIELD_PROPS}
                    />
                  </Stack>
                  <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600">
                    {message.length} / {CONTACT_MESSAGE_MAX} characters
                  </Text>
                  <PondButton
                    type="button"
                    colorPalette="teal"
                    loading={busy}
                    disabled={busy || message.trim().length === 0}
                    alignSelf="flex-start"
                    onClick={() => void onSubmit()}
                  >
                    Send message
                  </PondButton>
                  {feedback ? (
                    <Text
                      role="status"
                      fontSize={APP_TEXT_SIZES.helper}
                      color="teal.solid"
                      fontWeight="medium"
                    >
                      {feedback}
                    </Text>
                  ) : null}
                  {error ? (
                    <Text
                      role="alert"
                      fontSize={APP_TEXT_SIZES.helper}
                      color="nautical.solid"
                      fontWeight="medium"
                    >
                      {error}
                    </Text>
                  ) : null}
                </Stack>
              )}
            </Box>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
