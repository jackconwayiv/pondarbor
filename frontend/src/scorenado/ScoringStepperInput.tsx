import { Center, HStack, Input } from "@chakra-ui/react";

import PondButton from "../PondButton";

type ScoringStepperInputProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  tabIndex?: number;
};

export function ScoringStepperInput({
  value,
  onChange,
  tabIndex,
}: ScoringStepperInputProps) {
  const step = (delta: number) => {
    const base = value ?? 0;
    onChange(base + delta);
  };

  const stepperBtnProps = {
    size: "xs" as const,
    minW: "8",
    minH: "8",
    variant: "outline" as const,
    colorPalette: "gray" as const,
    className: "scorenado-stepper-btn",
    bg: "white",
    color: "gray.800",
    borderColor: "gray.400",
    borderWidth: "1px",
    _hover: {
      bg: "gray.100",
      borderColor: "gray.500",
      color: "gray.900",
    },
  };

  return (
    <Center className="scorenado-stepper">
      <HStack gap="1">
        <PondButton {...stepperBtnProps} onClick={() => step(-1)}>
          −
        </PondButton>
        <Input
          value={value ?? ""}
          minW="12"
          maxW="14"
          size="sm"
          textAlign="center"
          tabIndex={tabIndex}
          bg="white"
          borderColor="gray.400"
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "") {
              onChange(null);
              return;
            }
            const num = parseInt(raw, 10);
            onChange(Number.isNaN(num) ? null : num);
          }}
        />
        <PondButton {...stepperBtnProps} onClick={() => step(1)}>
          +
        </PondButton>
      </HStack>
    </Center>
  );
}
