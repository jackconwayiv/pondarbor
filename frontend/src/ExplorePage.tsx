import { Box, Stack } from "@chakra-ui/react";
import { useCallback } from "react";
import { Navigate, useNavigate } from "react-router";

import { HomeAppNavList } from "./App";
import { hasUnstarredApps, starAllAccessibleAppPaths } from "./appNavConfig";
import { useAppSession } from "./auth/AppSessionContext";
import SiteFooter from "./components/SiteFooter";
import { fullBleedStackProps } from "./responsive";
import { APP_SHELL_TRAY_PROPS } from "./theme/typography";

export default function ExplorePage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, homeStarredAppPaths, patchHomeStarredAppPaths } =
    useAppSession();
  const isApproved = !!sessionUser?.user.is_approved;
  const isStaff = !!sessionUser?.user.is_staff;
  const access = {
    isAuthenticated: true,
    isApproved,
    isStaff,
  };
  const profile = sessionUser
    ? { ...sessionUser.profile, home_starred_app_paths: homeStarredAppPaths }
    : undefined;

  const handleStarAll = useCallback(async () => {
    await patchHomeStarredAppPaths(
      starAllAccessibleAppPaths({ isAuthenticated: true, isApproved, isStaff }),
    );
    navigate("/");
  }, [isApproved, isStaff, patchHomeStarredAppPaths, navigate]);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  if (!hasUnstarredApps(access, profile)) {
    return <Navigate to="/" replace />;
  }

  return (
    <Stack flex="1" minH="full" gap="0" align="stretch" w="100%" {...fullBleedStackProps}>
      <Box flex="1" bg="bg" w="100%" px={0} py={{ base: "1", md: "1" }}>
        <Box {...APP_SHELL_TRAY_PROPS}>
          <Box px={{ base: "2", md: "2" }} pt={{ base: "2", md: "2" }} pb={{ base: "3", md: "3" }}>
            <HomeAppNavList
              isAuthenticated={isAuthenticated}
              isApproved={isApproved}
              isStaff={isStaff}
              mode="explore"
              onStarAll={handleStarAll}
            />
          </Box>
        </Box>
      </Box>
      <SiteFooter />
    </Stack>
  );
}
