import { Box, HStack, Image, Stack, Text } from "@chakra-ui/react";
import { useMemo } from "react";

import PondButton from "../PondButton";
import {
  APP_TEXT_SIZES,
  HIDE_SCROLLBAR_CSS,
  MAPPED_LIST_STACK_GAP,
  PANEL_ENTRY_CARD_PROPS,
} from "../theme/typography";
import { formatLifeDates, formatRelationLine } from "./formatRelation";
import type { PeopleGraphBundle, PeoplePerson } from "./types";

/** Tighter than mapped list cards — edit panel fits more rows per screen. */
const EDIT_ROW_CARD_PADDING = {
  py: { base: "1.5", md: "1.5" },
  px: { base: "2", md: "2" },
} as const;

const EDIT_ROW_AVATAR_PX = "48px";

export type FamilyTreeEditListViewProps = {
  bundle: PeopleGraphBundle;
  onEditPerson: (person: PeoplePerson) => void;
  onAddPerson: () => void;
};

function sortPeopleForEditList(people: PeoplePerson[]): PeoplePerson[] {
  return [...people].sort((a, b) => {
    if (a.is_self) return -1;
    if (b.is_self) return 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}

function PersonEditRowCard({
  person,
  onEdit,
}: {
  person: PeoplePerson;
  onEdit: () => void;
}) {
  const imageSrc = (person.image_url || "").trim();
  const relationLine = formatRelationLine(person);
  const lifeDates = formatLifeDates(person);
  const initial = (person.name.trim().slice(0, 1) || "?").toUpperCase();
  const metaParts = [
    relationLine || null,
    lifeDates !== "—" ? lifeDates : null,
  ].filter(Boolean);
  const metaLine = metaParts.length > 0 ? metaParts.join(" · ") : null;

  return (
    <Box
      as="button"
      w="100%"
      textAlign="left"
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border"
      borderRadius="lg"
      cursor="pointer"
      transition="border-color 0.15s ease, box-shadow 0.15s ease"
      {...EDIT_ROW_CARD_PADDING}
      _hover={{ borderColor: "teal.solid", boxShadow: "sm" }}
      onClick={onEdit}
    >
      <HStack align="center" gap="2">
        <Box
          w={EDIT_ROW_AVATAR_PX}
          h={EDIT_ROW_AVATAR_PX}
          flexShrink={0}
          borderRadius="md"
          bg="bg.subtle"
          display="flex"
          alignItems="center"
          justifyContent="center"
          overflow="hidden"
        >
          {imageSrc ? (
            <Image
              src={imageSrc}
              alt=""
              w="100%"
              h="100%"
              objectFit="cover"
              objectPosition="center"
              draggable={false}
            />
          ) : (
            <Text fontSize="lg" fontWeight="bold" color="gray.400" userSelect="none">
              {initial}
            </Text>
          )}
        </Box>
        <Stack gap="0" flex="1" minW={0}>
          <HStack gap="2" align="center" justify="space-between">
            <Text fontWeight="semibold" fontSize={APP_TEXT_SIZES.body} lineClamp={1} color="fg">
              {person.name}
              {person.is_self ? (
                <Text as="span" fontWeight="medium" color="fg.muted">
                  {" "}
                  (you)
                </Text>
              ) : null}
            </Text>
            <Text
              as="span"
              aria-hidden
              color="fg.muted"
              fontSize="md"
              lineHeight="1"
              flexShrink={0}
            >
              ›
            </Text>
          </HStack>
          {metaLine ? (
            <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted" lineClamp={1}>
              {metaLine}
            </Text>
          ) : null}
        </Stack>
      </HStack>
    </Box>
  );
}

export default function FamilyTreeEditListView({
  bundle,
  onEditPerson,
  onAddPerson,
}: FamilyTreeEditListViewProps) {
  const people = useMemo(
    () => sortPeopleForEditList(bundle.people),
    [bundle.people],
  );

  return (
    <Box {...PANEL_ENTRY_CARD_PROPS}>
      <Stack gap={MAPPED_LIST_STACK_GAP}>
        <PondButton type="button" colorPalette="lilypad" size="sm" alignSelf="flex-start" onClick={onAddPerson}>
          Add person
        </PondButton>
        <Stack
          gap={MAPPED_LIST_STACK_GAP}
          maxH={{ base: "min(70vh, 40rem)", md: "min(72vh, 44rem)" }}
          overflowY="auto"
          css={HIDE_SCROLLBAR_CSS}
        >
        {people.map((person) => (
          <PersonEditRowCard
            key={person.id}
            person={person}
            onEdit={() => onEditPerson(person)}
          />
        ))}
        </Stack>
      </Stack>
    </Box>
  );
}
