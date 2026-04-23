import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";

export default function AboutPrivacyPage() {
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
              >
                Privacy Policy
              </Heading>
              <Text fontSize={APP_TEXT_SIZES.helper} color="gray.600">
                Effective date: 8 April 2026
              </Text>
            </Box>

            <Box {...PANEL_ENTRY_CARD_PROPS}>
              <Stack gap="3">
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  This Privacy Policy describes how Pond Arbor Workshop
                  (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) collects,
                  uses, and shares personal information when you use PondArbor.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Information we collect
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  We may collect account profile information (such as email,
                  display name, and avatar), app usage data, and content you
                  submit in features like quotes, community closet, and contact
                  messages.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Account approval and moderation
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  PondArbor is a moderated community. New accounts may require
                  approval before full access is granted. We may review
                  submitted content and account activity to enforce community
                  standards, prevent abuse, and maintain platform safety. As
                  part of moderation, we may approve, reject, suspend, or remove
                  accounts and content.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  How we use information
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  We use information to provide and improve the service,
                  authenticate users, moderate content, support app
                  functionality, and communicate with users about service
                  issues.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Sharing and disclosure
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  We may share data with service providers that support hosting,
                  authentication, and analytics. We may also disclose data if
                  required by law or to protect rights and safety.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Third-party services
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  We use third-party services to operate PondArbor, including
                  identity and login providers and cloud infrastructure. These
                  providers may process personal data on our behalf according to
                  their own privacy terms and security practices.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Data retention
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  We retain personal data while your account is active and for a
                  reasonable period afterward as needed for legal, safety,
                  fraud-prevention, and recordkeeping obligations. When data is
                  no longer required, we delete or anonymize it.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Your rights and choices
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  Depending on your location, you may have rights to access,
                  correct, delete, or export your personal data. Contact us to
                  make a request.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Age requirements
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  PondArbor is intended only for users who are 18 years of age
                  or older. We do not knowingly collect personal information
                  from children under 18.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Policy updates
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  We may update this Privacy Policy from time to time. When we
                  do, we will revise the effective date and post the updated
                  policy on this page.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Contact
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  If you have questions about this policy, contact:
                  pondarbor@gmail.com
                </Text>
              </Stack>
            </Box>

            <Box>
              <PondButton asChild size="sm" colorPalette="teal">
                <RouterLink to="/about">Back to About</RouterLink>
              </PondButton>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
