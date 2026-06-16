import { chakra, HStack } from "@chakra-ui/react";
import { useState } from "react";
import { normalizeRatingInput } from "./utils";

type StarRatingInputProps = {
  value: number;
  onChange: (value: number) => void;
};

const STAR_COUNT = 5;

export default function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value;

  return (
    <HStack
      gap={0}
      role="group"
      aria-label="Your rating"
      onMouseLeave={() => setHover(null)}
    >
      {Array.from({ length: STAR_COUNT }, (_, i) => {
        const starValue = i + 1;
        const filled = display >= starValue;
        return (
          <chakra.button
            key={starValue}
            type="button"
            aria-label={`Rate ${starValue} stars`}
            aria-pressed={value === starValue}
            fontSize="2xl"
            lineHeight="1"
            cursor="pointer"
            color={filled ? "orange.400" : "fg.muted"}
            bg="transparent"
            border="none"
            px={1}
            py={0.5}
            minW="2.25rem"
            minH="2.25rem"
            transition="color 0.15s ease"
            _hover={{ color: filled ? "orange.500" : "orange.300" }}
            onMouseEnter={() => setHover(starValue)}
            onFocus={() => setHover(starValue)}
            onBlur={() => setHover(null)}
            onClick={() => onChange(normalizeRatingInput(starValue))}
          >
            {filled ? "★" : "☆"}
          </chakra.button>
        );
      })}
    </HStack>
  );
}
