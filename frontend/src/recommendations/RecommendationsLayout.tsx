import { Outlet } from "react-router";
import { Box } from "@chakra-ui/react";
import { APP_PANEL_PAGE_MIN_HEIGHT_PROPS } from "../responsive";
import { RecommendationsAddProvider } from "./recommendationsAddContext";

export default function RecommendationsLayout() {
  return (
    <RecommendationsAddProvider>
      <Box {...APP_PANEL_PAGE_MIN_HEIGHT_PROPS} px={{ base: 4, md: 6 }} py={4}>
        <Outlet />
      </Box>
    </RecommendationsAddProvider>
  );
}
