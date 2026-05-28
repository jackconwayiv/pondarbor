import { Box, Text, VStack } from "@chakra-ui/react";

type Props = {
  label: string;
  count: number;
  compact?: boolean;
};

export default function CombatPile({ label, count, compact = false }: Props) {
  return (
    <VStack gap={0.5} align="center" flexShrink={0}>
      <Box
        position="relative"
        w={compact ? "2.5rem" : "3.5rem"}
        aspectRatio="2.5/3.5"
        borderRadius="md"
        borderWidth="2px"
        borderColor="gray.700"
        borderStyle="dashed"
        bg="blackAlpha.200"
      >
        {count > 0 && (
          <Box
            position="absolute"
            top="2px"
            left="2px"
            right="2px"
            bottom="2px"
            borderRadius="sm"
            bg="white"
            opacity={0.35}
          />
        )}
        <Text
          position="absolute"
          inset={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          fontSize={compact ? "sm" : "lg"}
          fontWeight="bold"
        >
          {count}
        </Text>
      </Box>
      <Text
        fontSize={compact ? "2xs" : "xs"}
        fontWeight="semibold"
        textTransform="uppercase"
      >
        {label}
      </Text>
    </VStack>
  );
}
