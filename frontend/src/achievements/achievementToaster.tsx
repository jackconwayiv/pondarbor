import {
  createToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  Toaster,
} from "@chakra-ui/react";

/** Success / error: `slotRecipes.toast` in `theme/system.ts` (forest / orange). */
export const achievementToaster = createToaster({
  placement: "top-end",
  pauseOnPageIdle: true,
  offsets: "1rem",
  duration: 7000,
});

export function AchievementToaster() {
  return (
    <Portal>
      <Toaster toaster={achievementToaster}>
        {(toast) => (
          <Toast.Root width={{ md: "sm" }} maxW="calc(100vw - 2rem)">
            {toast.type === "loading" ? (
              <Spinner size="sm" colorPalette="teal" />
            ) : (
              <Toast.Indicator />
            )}
            <Stack gap="1" flex="1" maxW="100%">
              {toast.title != null && toast.title !== "" ? <Toast.Title>{toast.title}</Toast.Title> : null}
              {toast.description != null && toast.description !== "" ? (
                <Toast.Description>{toast.description}</Toast.Description>
              ) : null}
            </Stack>
            {toast.closable ? <Toast.CloseTrigger /> : null}
          </Toast.Root>
        )}
      </Toaster>
    </Portal>
  );
}
