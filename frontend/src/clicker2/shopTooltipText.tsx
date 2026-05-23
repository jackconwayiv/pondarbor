import { HStack, Text } from "@chakra-ui/react";
import type { ComponentProps, ReactNode } from "react";

/** Name left, optional price right — first row of shop tooltips. */
export function ShopTooltipHeader({
  children,
  price,
}: {
  children: ReactNode;
  price?: ReactNode;
}) {
  return (
    <HStack gap="2" align="baseline" justify="space-between" w="full">
      <ShopNameText flex="1" minW="0">
        {children}
      </ShopNameText>
      {price != null ? (
        <ShopPriceText flexShrink={0} textAlign="right">
          {price}
        </ShopPriceText>
      ) : null}
    </HStack>
  );
}

export function ShopNameText({
  children,
  ...props
}: {
  children: ReactNode;
} & ComponentProps<typeof Text>) {
  return (
    <Text
      fontSize="sm"
      lineHeight="1.3"
      fontWeight="normal"
      fontFamily="heading"
      {...props}
    >
      {children}
    </Text>
  );
}

export function ShopEffectText({
  children,
  ...props
}: {
  children: ReactNode;
} & ComponentProps<typeof Text>) {
  return (
    <Text
      fontSize="xs"
      lineHeight="1.35"
      fontWeight="bold"
      color="lilypad.solid"
      {...props}
    >
      {children}
    </Text>
  );
}

export function ShopFlavorText({ children }: { children: ReactNode }) {
  return (
    <Text
      fontSize="xs"
      lineHeight="1.45"
      fontStyle="italic"
      color="sky.solid"
    >
      {children}
    </Text>
  );
}

export function ShopPriceText({
  children,
  ...props
}: {
  children: ReactNode;
} & ComponentProps<typeof Text>) {
  return (
    <Text
      fontSize="xs"
      lineHeight="1.35"
      fontWeight="bold"
      fontVariantNumeric="tabular-nums"
      color="nautical.solid"
      {...props}
    >
      {children}
    </Text>
  );
}
