import { HStack, Link as ChakraLink, Text } from "@chakra-ui/react";
import { Link as RouterLink, useLocation } from "react-router";

import { getBreadcrumbItems } from "./breadcrumbTrail";

/**
 * Renders a single-line breadcrumb under the app header.
 * `AppLayout` wraps this in a `5xl` centered column; clicker/QFF skip the bar.
 */
export default function BreadcrumbBar() {
  const { pathname, search } = useLocation();
  const items = getBreadcrumbItems(pathname, search);
  if (items == null) {
    return null;
  }

  return (
    <HStack
      as="nav"
      role="navigation"
      aria-label="Breadcrumb"
      w="100%"
      minW={0}
      flexWrap="wrap"
      rowGap="0.5"
      columnGap="1.5"
      align="center"
      py="1"
      textStyle="sm"
      color="fg.muted"
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
  );
}
