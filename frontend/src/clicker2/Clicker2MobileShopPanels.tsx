import { Box, Flex } from "@chakra-ui/react";
import { useState, type ReactNode } from "react";

import "./Clicker2MobileShopPanels.css";

import { EVOLUTIONS_LABEL } from "./clicker2Copy";

const SHOP_TAB_IDS = ["denizens", "evolutions"] as const;
export type Clicker2MobileShopTabId = (typeof SHOP_TAB_IDS)[number];

const SHOP_TAB_LABELS: Record<Clicker2MobileShopTabId, string> = {
  denizens: "Denizens",
  evolutions: EVOLUTIONS_LABEL,
};

export default function Clicker2MobileShopPanels({
  denizensPanel,
  evolutionsPanel,
  initialTab = "denizens",
}: {
  denizensPanel: ReactNode;
  evolutionsPanel: ReactNode;
  initialTab?: Clicker2MobileShopTabId;
}) {
  const [activeTab, setActiveTab] = useState<Clicker2MobileShopTabId>(initialTab);

  return (
    <Box className="click2MobileShopPanels">
      <Flex
        className="click2MobileShopPanelsTabBar"
        gap="1.5"
        px="1"
        py="0"
        bg="transparent"
        role="tablist"
        aria-label="Shop sections"
      >
        {SHOP_TAB_IDS.map((id) => {
          const selected = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={
                selected
                  ? "click2MobileShopPanelsTab click2MobileShopPanelsTab--active"
                  : "click2MobileShopPanelsTab"
              }
              onClick={() => setActiveTab(id)}
            >
              {SHOP_TAB_LABELS[id]}
            </button>
          );
        })}
      </Flex>

      <Box
        className="click2MobileShopPanelsBody"
        role="tabpanel"
        aria-label={SHOP_TAB_LABELS[activeTab]}
      >
        {activeTab === "denizens" ? denizensPanel : evolutionsPanel}
      </Box>
    </Box>
  );
}
