import { Box, Heading, Stack, Text, Textarea } from "@chakra-ui/react";
import { useAuth0 } from "@auth0/auth0-react";
import { useCallback, useState } from "react";

import { submitContactMessage } from "./about/contactApi";
import { auth0DefaultLoginParams } from "./auth/auth0LoginParams";
import { useAppSession } from "./auth/AppSessionContext";
import PondButton from "./PondButton";
import { fullBleedStackProps } from "./responsive";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "./theme/typography";

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
      await submitContactMessage(token, { message: trimmed, website: honeypot });
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
      <Box flex="1" bg="sky.solid" px={{ base: "4", md: "6" }} py={{ base: "5", md: "6" }}>
        <Box
          maxW="4xl"
          w="100%"
          mx="auto"
          bg="gray.100"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          overflow="hidden"
        >
          <Stack gap={{ base: "4", md: "4" }} p={{ base: "4", md: "6" }}>
            <Box
              bg="white"
              borderWidth="1px"
              borderColor="border"
              borderRadius="xl"
              p={{ base: "4", md: "4" }}
            >
              <Heading as="h1" size={{ base: "lg", md: "xl" }} fontWeight="bold" mb="2">
                About
              </Heading>
              <Text fontSize={APP_TEXT_SIZES.body} lineHeight="tall" color="fg">
                This app was developed by Pond Arbor Workshop.
              </Text>
            </Box>

            <Box
              bg="white"
              borderWidth="1px"
              borderColor="border"
              borderRadius="xl"
              p={{ base: "4", md: "4" }}
            >
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
                    colorPalette="sky"
                    size="sm"
                    onClick={() =>
                      void loginWithRedirect({
                        authorizationParams: auth0DefaultLoginParams(),
                      })
                    }
                  >
                    Log in
                  </PondButton>
                </Stack>
              ) : !approved ? (
                <Text fontSize={APP_TEXT_SIZES.body} color="nautical.solid" fontWeight="medium">
                  Your account must be approved before you can contact us from here.
                </Text>
              ) : (
                <Stack gap="3" align="stretch" maxW="lg">
                  <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                    Send a note to the workshop.
                  </Text>
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
                      Message
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
                      color="lilypad.solid"
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
