import { CloseButton, Dialog } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";

export type AppModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown in the header when `showHeader` is true. */
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** When false, no header row (title + close). Dismiss with backdrop click or Escape (default dialog behavior). */
  showHeader?: boolean;
  /** When false, no X button. Only applies if `showHeader` is true. */
  showCloseButton?: boolean;
  /** Max width token-ish: sm ~22rem, md ~28rem, lg ~36rem, xl ~42rem */
  size?: "sm" | "md" | "lg" | "xl";
  /** Optional Chakra `Dialog` part props for layout and chrome. */
  backdropProps?: ComponentProps<typeof Dialog.Backdrop>;
  positionerProps?: ComponentProps<typeof Dialog.Positioner>;
  contentProps?: ComponentProps<typeof Dialog.Content>;
  /** Forwarded to `Dialog.Root` (e.g. `preventScroll={false}` so the page can scroll). */
  rootProps?: Omit<ComponentProps<typeof Dialog.Root>, "children">;
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
  showHeader = true,
  showCloseButton = true,
  backdropProps,
  positionerProps,
  contentProps,
  rootProps,
  headerProps,
  descriptionProps,
  bodyProps,
}: AppModalProps) {
  return (
    <Dialog.Root
      {...rootProps}
      open={open}
      lazyMount
      unmountOnExit
      onOpenChange={(d: { open: boolean }) => onOpenChange(d.open)}
    >
      <Dialog.Backdrop zIndex={2100} {...backdropProps} />
      <Dialog.Positioner
        px={{ base: "3", md: "6" }}
        py={{ base: "8", md: "12" }}
        zIndex={2101}
        {...positionerProps}
      >
        <Dialog.Content
          data-app-modal=""
          maxW={maxW[size]}
          w="min(100vw - 1.5rem, 100%)"
          bg="bg.panel"
          borderWidth="1px"
          borderColor="border"
          borderRadius="xl"
          boxShadow="lg"
          display="flex"
          flexDirection="column"
          gap="2"
          p="2"
          {...contentProps}
        >
          {showHeader ? (
            <Dialog.Header gap="2" p="0" {...headerProps}>
              <Dialog.Title fontWeight="semibold" fontSize="lg" lineHeight="short">
                {title}
              </Dialog.Title>
              {showCloseButton ? (
                <Dialog.CloseTrigger asChild>
                  <CloseButton size="sm" />
                </Dialog.CloseTrigger>
              ) : null}
            </Dialog.Header>
          ) : null}
          {description ? (
            <Dialog.Description
              fontSize="sm"
              color="fg.muted"
              p="0"
              m="0"
              {...descriptionProps}
            >
              {description}
            </Dialog.Description>
          ) : null}
          <Dialog.Body p="0" {...bodyProps}>
            {children}
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
