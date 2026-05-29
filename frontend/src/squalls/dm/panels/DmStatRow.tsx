import { Box, Text } from "@chakra-ui/react";

export function DmStatRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="xs" color="gray.900" textTransform="uppercase" letterSpacing="wide">
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="semibold" color="gray.900">
        {value}
      </Text>
    </Box>
  );
}

export function DmSectionHeading({ children }: { children: string }) {
  return (
    <Text fontSize="md" fontWeight="bold" color="gray.900" mt={2}>
      {children}
    </Text>
  );
}

export function DmPanelIntro({ children }: { children: string }) {
  return (
    <Text fontSize="sm" color="gray.900">
      {children}
    </Text>
  );
}
