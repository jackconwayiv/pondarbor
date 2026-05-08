import { Box, Heading, Stack, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";
import PondButton from "../PondButton";
import { fullBleedStackProps } from "../responsive";
import {
  APP_SHELL_TRAY_PROPS,
  APP_TEXT_SIZES,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";

export default function AboutTermsPage() {
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
                Terms of Service
              </Heading>
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
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
                  These Terms of Service govern your access to and use of
                  PondArbor, operated by Pond Arbor Workshop (&quot;we&quot;,
                  &quot;us&quot;, or &quot;our&quot;).
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Eligibility and accounts
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  You are responsible for maintaining the security of your
                  account and for all activity under your account. You must
                  provide accurate information and comply with all applicable
                  laws.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Acceptable use
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  You agree not to misuse the service, interfere with its
                  operation, attempt unauthorized access, or submit unlawful,
                  abusive, or harmful content.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  User content
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  You retain ownership of content you submit. You grant us a
                  license to host, process, and display that content solely to
                  operate and improve the service. You represent that you have
                  the necessary rights to submit any content you provide.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Suspension and termination
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  We may suspend or terminate accounts that violate these terms,
                  create security risk, or harm users or the service.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Age requirement
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  PondArbor is intended only for users who are 18 years of age
                  or older. By using the service, you represent that you are at
                  least 18.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Disclaimers and limitation of liability
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  The service is provided on an &quot;as is&quot; and &quot;as
                  available&quot; basis. To the maximum extent permitted by law,
                  we disclaim warranties and limit liability for indirect or
                  consequential damages, to the extent permitted by applicable
                  law.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Governing law
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  These Terms are governed by the laws of the State of Arizona,
                  United States, without regard to conflict of laws principles.
                  Any disputes arising from these Terms will be resolved in the
                  state or federal courts located in Maricopa County, AZ, and
                  you consent to their jurisdiction.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Changes to these terms
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  We may update these Terms from time to time. When we do, we
                  will revise the effective date and post the updated terms on
                  this page. Continued use of the service after updates become
                  effective constitutes acceptance of the revised Terms.
                </Text>

                <Heading as="h2" size="md" fontWeight="semibold">
                  Contact
                </Heading>
                <Text
                  fontSize={APP_TEXT_SIZES.helper}
                  color="fg"
                  lineHeight="tall"
                >
                  Questions about these terms: pondarbor@gmail.com
                </Text>
              </Stack>
            </Box>

            <Box>
              <PondButton asChild size="sm" colorPalette="lilypad">
                <RouterLink to="/about">Back to About</RouterLink>
              </PondButton>
            </Box>
          </Stack>
        </Box>
      </Box>
    </Stack>
  );
}
