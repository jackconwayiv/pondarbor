import { Box } from "@chakra-ui/react";
import { useEffect, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router";

/**
 * Full-bleed invisible layer behind `children`. Pointer events outside `children` either
 * navigate to `dismissTo` or run `onDismiss` (e.g. flush + exit inline editor).
 * Clicks on the editor `children` do not count as outside (stopPropagation on the foreground stack).
 */
export function MealEditorBackdropDismiss({
  dismissTo,
  onDismiss,
  disabled,
  shouldDismiss,
  children,
}: {
  dismissTo?: string;
  onDismiss?: () => void | Promise<void>;
  /** Extra filter after “outside editor” (e.g. ignore shell tab clicks). Default: always dismiss. */
  shouldDismiss?: (target: Element) => boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const shouldDismissRef = useRef(shouldDismiss);
  shouldDismissRef.current = shouldDismiss;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (disabled) return;
      const target = event.target as Element | null;
      if (!target) return;

      // Only block when our `AppModal` shell is mounted (open); avoid `[role=dialog]`
      // false positives from other UI that keeps a dialog node in the tree.
      if (document.querySelector("[data-app-modal]")) return;

      const editorNode = editorRef.current;
      if (!editorNode) return;
      if (editorNode.contains(target)) return;

      if (shouldDismissRef.current && !shouldDismissRef.current(target)) return;

      if (onDismiss) {
        void Promise.resolve(onDismiss());
      } else if (dismissTo) {
        navigate(dismissTo);
      }
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [dismissTo, onDismiss, disabled, navigate]);

  return (
    <Box position="relative" w="100%" alignSelf="flex-start">
      <Box
        ref={editorRef}
        position="relative"
        zIndex={1}
        w="100%"
        alignSelf="flex-start"
        minH="0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children}
      </Box>
    </Box>
  );
}
