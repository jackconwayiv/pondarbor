import { useAuth0 } from "@auth0/auth0-react";
import {
  Box,
  Collapsible,
  Flex,
  Heading,
  HStack,
  Image,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useCallback, useState } from "react";

import BrandColorsSection from "./about/BrandColorsSection";
import TechStackSection from "./about/TechStackSection";
import { submitContactMessage } from "./about/contactApi";
import { useAppSession } from "./auth/AppSessionContext";
import { auth0LoginAuthorizationParams } from "./auth/auth0LoginParams";
import SiteFooter from "./components/SiteFooter";
import PondButton from "./PondButton";
import { pondarborLogoSrc} from "./publicAsset";
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
  const [brandingOpen, setBrandingOpen] = useState(false);
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
      <Box flex="1" bg="bg" px={0} py={{ base: "2", md: "2" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Stack
            gap={{ base: "2", md: "2" }}
            px={{ base: "2", md: "2" }}
            pt={{ base: "2", md: "2" }}
            pb="2"
          >
            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Heading as="h1" size={{ base: "lg", md: "xl" }} mb="2">
                <HStack
                  as="span"
                  display="inline-flex"
                  gap="2"
                  alignItems="center"
                >
                  <Text as="span" aria-hidden="true">
                    🐢
                  </Text>
                  <Text as="span">About Pond Arbor</Text>
                </HStack>
              </Heading>
            <Flex
  flexDirection={isMobile ? "column" : "row"}
  alignItems={isMobile ? "stretch" : "flex-start"}
  gap={isMobile ? "2" : "0"}
>
    <Stack minW={0} gap="2">
      <Text fontSize={APP_TEXT_SIZES.body} color="fg">
        <b>Pond Arbor</b> is a hobby project developed by <b>Pond Arbor Workshop</b> to collect
        various app ideas together in one place. I'm sharing it with friends and
        family as an opportunity to interact through these earth-shattering apps.
      </Text>
    </Stack>
</Flex>
            </Box>

            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Box w="100%" maxW="lg" mx="auto">
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
                <Stack gap="2" align="stretch">
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
                      Contact Us:
                    </Text>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      minH="140px"
                      placeholder="Your message…"
                      {...PANEL_FIELD_PROPS}
                    />
                  </Stack>
                  <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                    {message.length} / {CONTACT_MESSAGE_MAX} characters
                  </Text>
                  <PondButton
                    type="button"
                    colorPalette="lilypad"
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
            </Box>

            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Collapsible.Root
                open={brandingOpen}
                onOpenChange={(details) => setBrandingOpen(details.open)}
              >
                <Collapsible.Trigger asChild>
                  <button
                    type="button"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      width: "100%",
                      textAlign: "left",
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: "inherit",
                      cursor: "pointer",
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      margin: 0,
                    }}
                  >
                    <Text
                      as="span"
                      transform={brandingOpen ? "rotate(90deg)" : "rotate(0deg)"}
                      transition="transform 0.15s ease"
                      lineHeight="1"
                      flexShrink={0}
                    >
                      ›
                    </Text>
                    <Text as="span" flex="1">
                      Pond Arbor Branding
                    </Text>
                  </button>
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <Stack gap="4" pt="2" align="stretch">
                    <Flex align="center" w="full" gap="3">
                      <Box flex="1" minW={0}>
                        <Heading
                          as="h2"
                          fontFamily="heading"
                          fontSize={{ base: "xl", md: "2xl" }}
                          fontWeight="normal"
                          lineHeight="1.2"
                        >
                          Headings: Caprasimo
                        </Heading>
                      </Box>
                      <Image
                        src={pondarborLogoSrc()}
                        alt="Pond Arbor"
                        h={{ base: "6.75rem", md: "8.25rem" }}
                        w="auto"
                        flexShrink={0}
                        objectFit="contain"
                      />
                      <Box flex="1" minW={0} textAlign="right">
                        <Text fontFamily="body" fontSize={APP_TEXT_SIZES.body}>
                          Body Text: Spinnaker
                        </Text>
                      </Box>
                    </Flex>
                    <BrandColorsSection />
                  </Stack>
                </Collapsible.Content>
              </Collapsible.Root>
            </Box>

            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <TechStackSection />
            </Box>
          </Stack>
        </Box>
      </Box>
      <SiteFooter />
    </Stack>
  );
}
