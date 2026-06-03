import { Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

import { AppModal } from "../components/AppModal";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import { templateMinPlayers } from "./scorenadoTemplateSetup";
import type { ScoreboardTemplate } from "./types";

type ScorenadoTemplateDetailModalProps = {
  template: ScoreboardTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteBusy?: boolean;
  onEdit: (template: ScoreboardTemplate) => void;
  onDelete: (template: ScoreboardTemplate) => void | Promise<void>;
};

export function ScorenadoTemplateDetailModal({
  template,
  open,
  onOpenChange,
  deleteBusy = false,
  onEdit,
  onDelete,
}: ScorenadoTemplateDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const confirmDeleteButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) setConfirmDelete(false);
  }, [open, template?.id]);

  if (!template) return null;

  const flags: string[] = [];
  if (template.scored_by_rounds) {
    flags.push("Scored by rounds");
  }
  if (template.low_score_wins) flags.push("Low score wins");
  if (template.is_published) {
    flags.push("Shared");
  } else {
    flags.push("Private");
  }
  flags.push(`Min ${templateMinPlayers(template)} players`);
  if (template.scored_by_rounds) {
    flags.push(`Default ${template.default_round_count} rounds`);
  }

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={template.name}
      size="md"
      bodyProps={{
        onPointerDownCapture: (event) => {
          if (!confirmDelete) return;
          const target = event.target as Node | null;
          if (!target) return;
          if (confirmDeleteButtonRef.current?.contains(target)) return;
          setConfirmDelete(false);
        },
      }}
    >
      <Stack gap="4" className="scorenado-retro">
        <Stack gap="1">
          <Text className="scorenado-pixel-body" fontSize={APP_TEXT_SIZES.body}>
            {template.can_edit ? "Your template" : "Community template"}{" "}
            · {template.categories.length}{" "}
            {template.categories.length === 1 ? "row" : "rows"}
          </Text>
          {flags.length > 0 ? (
            <Text className="scorenado-pixel-body" fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              {flags.join(" · ")}
            </Text>
          ) : null}
        </Stack>

        {template.categories.length > 0 ? (
          <Stack gap="1">
            <Text className="scorenado-pixel-title" fontSize="0.55rem">
              Categories
            </Text>
            <Stack gap="0.5" as="ul" listStyleType="none" m="0" p="0">
              {template.categories.map((cat) => (
                <Text
                  key={cat.id}
                  as="li"
                  className="scorenado-pixel-body"
                  fontSize={APP_TEXT_SIZES.body}
                >
                  {cat.name}
                  {!cat.is_scored ? " (not scored)" : ""}
                </Text>
              ))}
            </Stack>
          </Stack>
        ) : null}

        {template.can_edit ? (
          <Stack direction={{ base: "column", sm: "row" }} gap="2">
            <PondButton
              colorPalette="lilypad"
              onClick={() => {
                onOpenChange(false);
                onEdit(template);
              }}
            >
              Edit template
            </PondButton>
            <PondButton
              ref={confirmDeleteButtonRef}
              variant="outline"
              colorPalette="nautical"
              flexShrink={0}
              loading={deleteBusy}
              disabled={deleteBusy}
              onClick={(e) => {
                e.stopPropagation();
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }
                void Promise.resolve(onDelete(template)).catch(() =>
                  setConfirmDelete(false),
                );
              }}
            >
              {confirmDelete ? "Confirm delete" : "Delete template"}
            </PondButton>
          </Stack>
        ) : (
          <Text className="scorenado-pixel-body" fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Only the owner can edit or delete this template. Start a game from the Play
            tab.
          </Text>
        )}
      </Stack>
    </AppModal>
  );
}
