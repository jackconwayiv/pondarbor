import { Box } from "@chakra-ui/react";
import { useLayoutEffect, useRef, type ReactNode } from "react";

type Props = {
  personId: string;
  registerAnchor: (personId: string, el: HTMLElement | null) => void;
  children: ReactNode;
};

/** Stable anchor host — avoids inline ref callbacks that re-fire every parent render. */
export function PersonAnchorSlot({ personId, registerAnchor, children }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    registerAnchor(personId, ref.current);
    return () => registerAnchor(personId, null);
  }, [personId, registerAnchor]);

  return (
    <Box ref={ref} w="100%">
      {children}
    </Box>
  );
}
