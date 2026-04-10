import { CloseButton, Dialog } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";

export type AppModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Max width token-ish: sm ~22rem, md ~28rem, lg ~36rem, xl ~42rem */
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional Chakra `Dialog` part props for layout and chrome. */
  backdropProps?: ComponentProps<typeof Dialog.Backdrop>;
  positionerProps?: ComponentProps<typeof Dialog.Positioner>;
  contentProps?: ComponentProps<typeof Dialog.Content>;
  headerProps?: ComponentProps<typeof Dialog.Header>;
  descriptionProps?: ComponentProps<typeof Dialog.Description>;
  bodyProps?: ComponentProps<typeof Dialog.Body>;
};

const maxW: Record<NonNullable<AppModalProps["size"]>, string> = {
  sm: "22rem",
  md: "28rem",
  lg: "36rem",
  xl: "42rem",
};

/**
 * Reusable modal shell (Chakra Dialog) for app surfaces. Use for flows like pickers
 * where content handles persistence; no footer required.
 */
export function AppModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
  backdropProps,
  positionerProps,
  contentProps,
  headerProps,
  descriptionProps,
  bodyProps,
}: AppModalProps) {
  return (
    <Dialog.Root
      open={open}
      lazyMount
      unmountOnExit
      onOpenChange={(d: { open: boolean }) => onOpenChange(d.open)}
    >
      <Dialog.Backdrop {...backdropProps} />
      <Dialog.Positioner px={{ base: "3", md: "6" }} py={{ base: "8", md: "12" }} {...positionerProps}>
        <Dialog.Content
          data-app-modal=""
          maxW={maxW[size]}
          w="min(100vw - 1.5rem, 100%)"
          bg="white"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          boxShadow="lg"
          {...contentProps}
        >
          <Dialog.Header gap="2" {...headerProps}>
            <Dialog.Title fontWeight="semibold" fontSize="lg" lineHeight="short">
              {title}
            </Dialog.Title>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          {description ? (
            <Dialog.Description fontSize="sm" color="fg.muted" {...descriptionProps}>
              {description}
            </Dialog.Description>
          ) : null}
          <Dialog.Body pt="2" pb="4" {...bodyProps}>
            {children}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
