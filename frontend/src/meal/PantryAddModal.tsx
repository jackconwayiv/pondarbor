import { Tabs } from "@chakra-ui/react";
import { useState } from "react";
import { AppModal } from "../components/AppModal";
import {
  APP_SHELL_TAB_LIST_NESTED_PROPS,
  APP_SHELL_TAB_TRIGGER_PROPS,
} from "../theme/appShellTabs";
import { PantryBulkImportPanel } from "./PantryBulkImportPanel";
import { PantryIndividualAddForm } from "./PantryIndividualAddForm";

type PantryAddModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getApiAccessToken: () => Promise<string | null>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onDone: () => Promise<void>;
};

export function PantryAddModal({
  open,
  onOpenChange,
  getApiAccessToken,
  busy,
  setBusy,
  onDone,
}: PantryAddModalProps) {
  const [tab, setTab] = useState<"bulk" | "individual">("bulk");

  const handleDone = async () => {
    await onDone();
    onOpenChange(false);
  };

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Add to pantry"
      size="lg"
    >
      <Tabs.Root
        variant="plain"
        value={tab}
        onValueChange={(d) => setTab(d.value as "bulk" | "individual")}
      >
        <Tabs.List {...APP_SHELL_TAB_LIST_NESTED_PROPS} mb="3">
          <Tabs.Trigger value="bulk" {...APP_SHELL_TAB_TRIGGER_PROPS}>
            Bulk import
          </Tabs.Trigger>
          <Tabs.Trigger value="individual" {...APP_SHELL_TAB_TRIGGER_PROPS}>
            Add individual
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="bulk">
          <PantryBulkImportPanel
            getApiAccessToken={getApiAccessToken}
            busy={busy}
            setBusy={setBusy}
            onImported={handleDone}
          />
        </Tabs.Content>
        <Tabs.Content value="individual">
          <PantryIndividualAddForm
            getApiAccessToken={getApiAccessToken}
            busy={busy}
            setBusy={setBusy}
            onAdded={handleDone}
          />
        </Tabs.Content>
      </Tabs.Root>
    </AppModal>
  );
}
