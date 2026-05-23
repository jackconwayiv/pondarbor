import { Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export function EcologyBlurbText({ children }: { children: ReactNode }) {
  return (
    <Text fontSize="xs" color="black" lineHeight="1.45" fontStyle="italic">
      {children}
    </Text>
  );
}
