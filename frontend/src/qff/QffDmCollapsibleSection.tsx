import { Box, Collapsible, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

/**
 * Bordered collapsible used by DM item editor and DM world / room panel.
 * Controlled `open` state supports rotating chevron (sections start closed via useState(false)).
 */
export default function QffDmCollapsibleSection({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Box borderWidth="1px" borderRadius="md" borderColor="#404040" p={3} bg="#1a1a1a">
      <Collapsible.Root open={open} onOpenChange={(d) => onOpenChange(d.open)}>
        <Collapsible.Trigger asChild>
          <button
            type="button"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              width: "100%",
              textAlign: "left",
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "inherit",
              cursor: "pointer",
              background: "transparent",
              border: "none",
              padding: 0,
              margin: 0,
            }}
          >
            <Text
              as="span"
              transform={open ? "rotate(90deg)" : "rotate(0deg)"}
              transition="transform 0.15s ease"
              lineHeight="1"
              flexShrink={0}
            >
              ›
            </Text>
            <Text as="span" flex="1" color="#c8e6a8">
              {title}
            </Text>
          </button>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <Stack gap={3} pt={2}>
            {children}
          </Stack>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
}
