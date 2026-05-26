import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";

import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import { BIG_THREE_BODY, signSymbolForSign } from "../zodiac/astroLexicon";
import { formatBirthMonthDay } from "../zodiac/birthDateFormat";
import { signCardAccent } from "../zodiac/signCardAccent";

type Cell =
  | { kind: "birthday"; label: string; value: string }
  | { kind: "sign"; id: "sun" | "moon" | "rising"; label: string; sign: string };

export type FriendProfileBirthBigThreeStripProps = {
  birthDate?: string | null;
  sunSign?: string | null;
  moonSign?: string | null;
  risingSign?: string | null;
};

function StripCell({ cell }: { cell: Cell }) {
  if (cell.kind === "birthday") {
    return (
      <Box
        borderWidth="1px"
        borderColor="border"
        borderRadius="lg"
        bg="bg.panel"
        p={{ base: "2.5", md: "3" }}
        textAlign="center"
      >
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" fontWeight="medium" mb="1">
          {cell.label}
        </Text>
        <Text fontSize={APP_TEXT_SIZES.title} fontWeight="semibold" color="fg">
          {cell.value}
        </Text>
      </Box>
    );
  }

  const accent = signCardAccent(cell.sign);
  return (
    <Box
      borderLeftWidth="6px"
      borderLeftColor={accent.borderColor}
      borderWidth="1px"
      borderColor="border"
      borderRadius="lg"
      bg={accent.bg}
      p={{ base: "2.5", md: "3" }}
      textAlign="center"
    >
      <Text fontSize={APP_TEXT_SIZES.helper} color={accent.labelColor} fontWeight="medium" mb="1">
        {cell.label}
      </Text>
      <Text
        fontSize={APP_TEXT_SIZES.title}
        fontWeight="semibold"
        fontFamily="heading"
        textTransform="capitalize"
        color={accent.valueColor}
      >
        {signSymbolForSign(cell.sign) ? `${signSymbolForSign(cell.sign)} ` : ""}
        {cell.sign}
      </Text>
    </Box>
  );
}

export default function FriendProfileBirthBigThreeStrip({
  birthDate,
  sunSign,
  moonSign,
  risingSign,
}: FriendProfileBirthBigThreeStripProps) {
  const cells = useMemo(() => {
    const out: Cell[] = [];
    const birthday = formatBirthMonthDay(birthDate);
    if (birthday) {
      out.push({ kind: "birthday", label: "Birthday", value: birthday });
    }
    const signs: { id: "sun" | "moon" | "rising"; raw?: string | null; label: string }[] = [
      { id: "sun", raw: sunSign, label: BIG_THREE_BODY.sun.label },
      { id: "moon", raw: moonSign, label: BIG_THREE_BODY.moon.label },
      { id: "rising", raw: risingSign, label: BIG_THREE_BODY.rising.label },
    ];
    for (const s of signs) {
      const trimmed = s.raw?.trim();
      if (trimmed) {
        out.push({ kind: "sign", id: s.id, label: s.label, sign: trimmed });
      }
    }
    return out;
  }, [birthDate, sunSign, moonSign, risingSign]);

  if (cells.length === 0) {
    return null;
  }

  const birthdayCell = cells.find((c) => c.kind === "birthday");
  const signCells = cells.filter((c) => c.kind === "sign") as Extract<Cell, { kind: "sign" }>[];

  return (
    <Box {...PANEL_NESTED_BLOCK_PROPS} w="100%">
      <Box display={{ base: "none", md: "block" }}>
        <SimpleGrid columns={Math.min(4, cells.length)} gap="3" w="100%">
          {cells.map((cell) => (
            <StripCell key={cell.kind === "birthday" ? "birthday" : cell.id} cell={cell} />
          ))}
        </SimpleGrid>
      </Box>
      <Stack gap="3" display={{ base: "flex", md: "none" }} w="100%">
        {birthdayCell ? <StripCell cell={birthdayCell} /> : null}
        {signCells.length > 0 ? (
          <SimpleGrid columns={Math.min(3, signCells.length)} gap="3" w="100%">
            {signCells.map((cell) => (
              <StripCell key={cell.id} cell={cell} />
            ))}
          </SimpleGrid>
        ) : null}
      </Stack>
    </Box>
  );
}
