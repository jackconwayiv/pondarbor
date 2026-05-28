import { SimpleGrid } from "@chakra-ui/react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Three-column grid for ship / island home actions. */
export default function HomeActionGrid({ children }: Props) {
  return (
    <SimpleGrid columns={3} gap={2} w="100%" alignSelf="stretch">
      {children}
    </SimpleGrid>
  );
}
