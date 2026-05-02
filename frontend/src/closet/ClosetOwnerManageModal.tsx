import { AppModal } from "../components/AppModal";
import { useIsMobile } from "../responsive";
import {
  ClosetOwnerManagePanel,
  type CustodyFriendOption,
} from "./ClosetOwnerManagePanel";
import type { ClosetItem } from "./types";

export type { CustodyFriendOption };

type Notice = { kind: "success" | "error"; message: string };

export function ClosetOwnerManageModal({
  open,
  onOpenChange,
  item,
  custodyFriends,
  getToken,
  meId,
  onRefreshed,
  onNotice,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ClosetItem;
  custodyFriends: CustodyFriendOption[];
  getToken: () => Promise<string>;
  meId: number;
  onRefreshed: () => Promise<void>;
  onNotice?: (n: Notice) => void;
}) {
  const isMobile = useIsMobile();

  return (
    <AppModal
      open={open}
      onOpenChange={onOpenChange}
      title="Manage item"
      size="lg"
      positionerProps={
        isMobile
          ? { px: "0", py: "0", alignItems: "stretch", justifyContent: "center" }
          : undefined
      }
      contentProps={
        isMobile
          ? {
              maxW: "100vw",
              w: "100vw",
              minH: "100dvh",
              borderRadius: "0",
              borderWidth: "0",
            }
          : undefined
      }
    >
      <ClosetOwnerManagePanel
        open={open}
        onClose={() => onOpenChange(false)}
        item={item}
        custodyFriends={custodyFriends}
        getToken={getToken}
        meId={meId}
        onRefreshed={onRefreshed}
        onNotice={onNotice}
      />
    </AppModal>
  );
}
