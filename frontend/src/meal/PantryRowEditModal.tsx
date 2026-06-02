import { AppModal } from "../components/AppModal";
import { PantryRowEditForm, type PantryRowSaveBody } from "./PantryRowEditForm";
import type { PantryInventoryRow } from "./types";

type PantryRowEditModalProps = {
  row: PantryInventoryRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  onSave: (body: PantryRowSaveBody) => Promise<void>;
};

export function PantryRowEditModal({
  row,
  open,
  onOpenChange,
  busy,
  onSave,
}: PantryRowEditModalProps) {
  if (!row) return null;

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title={row.ingredient.name}
      size="lg"
    >
      <PantryRowEditForm
        row={row}
        busy={busy}
        onSave={async (body) => {
          await onSave(body);
          onOpenChange(false);
        }}
      />
    </AppModal>
  );
}
