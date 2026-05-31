import { Box } from "@chakra-ui/react";
import { uploadProgressPercent } from "../lib/uploadProgressUi";
import type { UploadProgress } from "../lib/presignedPut";

type UploadProgressBarProps = {
  progress: UploadProgress | null;
};

export function UploadProgressBar({ progress }: UploadProgressBarProps) {
  const pct = uploadProgressPercent(progress);
  const indeterminate = progress?.phase === "preparing" || pct == null;

  return (
    <Box
      w="100%"
      h="6px"
      borderRadius="full"
      bg="bg.muted"
      overflow="hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : pct ?? undefined}
      aria-label={indeterminate ? "Upload in progress" : `Upload ${pct}%`}
    >
      <Box
        h="100%"
        borderRadius="full"
        bg="lilypad.solid"
        w={indeterminate ? "40%" : `${pct}%`}
        transition={indeterminate ? "none" : "width 0.15s ease-out"}
        animation={indeterminate ? "uploadIndeterminate 1.2s ease-in-out infinite" : undefined}
        css={
          indeterminate
            ? {
                "@keyframes uploadIndeterminate": {
                  "0%": { transform: "translateX(-100%)" },
                  "100%": { transform: "translateX(350%)" },
                },
              }
            : undefined
        }
      />
    </Box>
  );
}
