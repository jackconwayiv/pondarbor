import { Box, HStack, Text } from "@chakra-ui/react";

import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";

type Props = {
  label: string;
  canGoOlder: boolean;
  canGoNewer: boolean;
  onGoOlder: () => void;
  onGoNewer: () => void;
};

export default function SongadayMonthNavRow({
  label,
  canGoOlder,
  canGoNewer,
  onGoOlder,
  onGoNewer,
}: Props) {
  return (
    <HStack justify="center" align="center" gap="2" w="full">
      <Box w="2.25rem" display="flex" justifyContent="flex-start">
        {canGoOlder ? (
          <PondButton
            type="button"
            size="sm"
            variant="ghost"
            colorPalette="navy"
            color="navy.solid"
            onClick={onGoOlder}
            _hover={{ color: "navy.solid" }}
            aria-label="Older month"
          >
            ←
          </PondButton>
        ) : null}
      </Box>
      <Text
        fontSize={APP_TEXT_SIZES.label}
        fontWeight="semibold"
        color="fg"
        minW="8rem"
        textAlign="center"
      >
        {label}
      </Text>
      <Box w="2.25rem" display="flex" justifyContent="flex-end">
        {canGoNewer ? (
          <PondButton
            type="button"
            size="sm"
            variant="ghost"
            colorPalette="navy"
            color="navy.solid"
            onClick={onGoNewer}
            _hover={{ color: "navy.solid" }}
            aria-label="Newer month"
          >
            →
          </PondButton>
        ) : null}
      </Box>
    </HStack>
  );
}
