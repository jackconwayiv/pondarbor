import { Button, HStack, Link as ChakraLink, Spacer, Text } from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router";

import {
  isPathStarred,
  isStarableAppPath,
  resolveAppPathFromLocation,
  toggleHomeStarredPath,
} from "./appNavConfig";
import { useAppSession } from "./auth/AppSessionContext";
import { getBreadcrumbItems } from "./breadcrumbTrail";
import { GOALS_THEME } from "./goals/theme";

/**
 * Renders a single-line breadcrumb under the app header.
 * `AppLayout` wraps this in a `5xl` centered column; clicker/QFF skip the bar.
 */
export default function BreadcrumbBar() {
  const { pathname, search } = useLocation();
  const { isAuthenticated, sessionUser, homeStarredAppPaths, patchHomeStarredAppPaths } =
    useAppSession();
  const items = getBreadcrumbItems(pathname, search);
  if (items == null) {
    return null;
  }

  const appPath = resolveAppPathFromLocation(pathname, search);
  const showStar =
    isAuthenticated &&
    appPath != null &&
    isStarableAppPath(appPath);
  const starredProfile = sessionUser
    ? { ...sessionUser.profile, home_starred_app_paths: homeStarredAppPaths }
    : null;
  const starred =
    appPath != null && isPathStarred(appPath, starredProfile ?? undefined);

  async function handleStarToggle() {
    if (appPath == null || !starredProfile) return;
    const next = toggleHomeStarredPath(appPath, starredProfile);
    await patchHomeStarredAppPaths(next);
  }

  return (
    <HStack
      as="nav"
      role="navigation"
      aria-label="Breadcrumb"
      w="100%"
      minW={0}
      align="center"
      py="1"
      textStyle="sm"
      color="fg.muted"
    >
      <HStack
        flex="1"
        minW={0}
        flexWrap="wrap"
        rowGap="0.5"
        columnGap="1.5"
        align="center"
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <HStack
              as="span"
              key={`${String(item.to)}-${item.label}-${index}`}
              gap="1.5"
              align="center"
              minW={0}
            >
              {index > 0 ? (
                <Text as="span" color="fg.muted" userSelect="none" aria-hidden>
                  &gt;
                </Text>
              ) : null}
              {item.to != null && !isLast ? (
                <ChakraLink
                  asChild
                  colorPalette="blue"
                  variant="plain"
                  color="fg"
                  _hover={{ color: "blue.fg" }}
                  textDecoration="none"
                  fontWeight="medium"
                  lineClamp={1}
                >
                  <RouterLink to={item.to}>{item.label}</RouterLink>
                </ChakraLink>
              ) : (
                <Text
                  as="span"
                  lineClamp={1}
                  color={isLast ? "fg" : "fg.muted"}
                  fontWeight={isLast ? "semibold" : "normal"}
                >
                  {item.label}
                </Text>
              )}
            </HStack>
          );
        })}
      </HStack>
      {showStar ? (
        <>
          <Spacer flex="0 0 auto" />
          <Button
            type="button"
            variant="ghost"
            minW="0"
            h="auto"
            m="0"
            p="0"
            lineHeight="1"
            fontSize="xl"
            color={starred ? GOALS_THEME.gold : "black"}
            _hover={{
              bg: "transparent",
              color: starred ? GOALS_THEME.gold : "black",
            }}
            aria-label={starred ? "Unstar" : "Star"}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void handleStarToggle();
            }}
          >
            {starred ? "★" : "☆"}
          </Button>
        </>
      ) : null}
    </HStack>
  );
}
