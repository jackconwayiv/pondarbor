import { Box, Link as ChakraLink, Text } from "@chakra-ui/react";
import { Link as RouterLink } from "react-router";

import { viewPortWidthBarProps } from "../responsive";

export default function SiteFooter() {
  return (
    <Box
      as="footer"
      flexShrink={0}
      bg="sky.emphasized"
      mt="auto"
      color="navy.fg"
      {...viewPortWidthBarProps}
    >
      <Box py="2" px={{ base: "2", md: "2" }}>
        <Box
          display="flex"
          flexDirection={{ base: "column", md: "row" }}
          alignItems={{ base: "flex-end", md: "center" }}
          justifyContent="flex-end"
          flexWrap="wrap"
          columnGap={{ md: "3" }}
          rowGap="1"
        >
          <Text textAlign="right" fontSize="xs" color="inherit">
            © 2026{" "}
            <ChakraLink
              asChild
              color="inherit"
              textDecoration="none"
              _hover={{ color: "sky.solid", textDecoration: "none" }}
            >
              <RouterLink to="/about">Pond Arbor Workshop</RouterLink>
            </ChakraLink>
            . All rights reserved.
          </Text>
          <Text textAlign="right" fontSize="xs" color="inherit">
            <ChakraLink
              asChild
              color="inherit"
              textDecoration="none"
              _hover={{ color: "sky.solid", textDecoration: "none" }}
            >
              <RouterLink to="/about/terms">Terms of Service</RouterLink>
            </ChakraLink>{" "}
            |{" "}
            <ChakraLink
              asChild
              color="inherit"
              textDecoration="none"
              _hover={{ color: "sky.solid", textDecoration: "none" }}
            >
              <RouterLink to="/about/privacy">Privacy Policy</RouterLink>
            </ChakraLink>
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
