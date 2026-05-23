import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";

import {
  BRAND_COLOR_GROUPS,
  type BrandColorSwatch,
} from "../theme/tokens";
import { APP_TEXT_SIZES } from "../theme/typography";

function BrandColorSwatchCard({ name, hex, role }: BrandColorSwatch) {
  return (
    <Stack gap="1.5">
      <Box
        h="3.5rem"
        w="full"
        borderRadius="md"
        bg={hex}
        borderWidth="1px"
        borderColor="border"
        boxShadow="sm"
        aria-hidden
      />
      <Stack gap="0.5">
        <Text fontSize="sm" fontWeight="medium" lineHeight="1.3">
          {name}
        </Text>
        <Text
          fontSize="xs"
          fontFamily="mono"
          color="fg.muted"
          lineHeight="1.3"
          letterSpacing="0.02em"
        >
          {hex}
        </Text>
        {role ? (
          <Text fontSize="xs" color="fg.muted" lineHeight="1.3">
            {role}
          </Text>
        ) : null}
      </Stack>
    </Stack>
  );
}

export default function BrandColorsSection() {
  return (
    <Stack gap="4" align="stretch">
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium">
          Brand colors:
        </Text>
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="tall">
          Pond Arbor’s shared palette from the design system. Use these tokens
          rather than one-off hex values in app UI.
        </Text>
      </Stack>

      {BRAND_COLOR_GROUPS.map((group) => (
        <Stack key={group.title} gap="2" align="stretch">
          <Stack gap="0.5">
            <Text
              fontSize="xs"
              fontWeight="medium"
              letterSpacing="0.12em"
              textTransform="uppercase"
              color="fg.muted"
            >
              {group.title}
            </Text>
            {group.description ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                {group.description}
              </Text>
            ) : null}
          </Stack>
          <SimpleGrid
            columns={{ base: 2, sm: 3, md: 4, lg: 5 }}
            gap="3"
            w="full"
          >
            {group.swatches.map((swatch) => (
              <BrandColorSwatchCard key={`${group.title}-${swatch.name}`} {...swatch} />
            ))}
          </SimpleGrid>
        </Stack>
      ))}
    </Stack>
  );
}
