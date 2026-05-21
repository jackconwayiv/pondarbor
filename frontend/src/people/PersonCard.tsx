import { Box, Card, HStack, Image, Stack, Text } from "@chakra-ui/react";

import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import { formatLifeDates, formatRelationLine } from "./formatRelation";
import { personParentsLine } from "./personCardParents";
import { TREE_CARD_SIZE } from "./treeGridConstants";
import type { PeopleGraphBundle, PeoplePerson } from "./types";

export type PersonCardProps = {
  person: PeoplePerson;
  bundle: PeopleGraphBundle;
  variant?: "default" | "squareCompact";
  expanded?: boolean;
  readOnly?: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  onActivate?: () => void;
};

export default function PersonCard({
  person,
  bundle,
  variant = "default",
  expanded = false,
  readOnly = false,
  onToggle,
  onEdit,
  onActivate,
}: PersonCardProps) {
  const imageSrc = (person.image_url || "").trim();
  const parentsLine = personParentsLine(person, bundle);
  const relationLine = formatRelationLine(person);
  const lifeDates = formatLifeDates(person);
  const initial = (person.name.trim().slice(0, 1) || "?").toUpperCase();

  if (variant === "squareCompact") {
    const clickable = Boolean(onActivate);
    return (
      <Card.Root
        data-person-card=""
        flexDirection="column"
        overflow="hidden"
        bg="white"
        borderWidth="1px"
        borderColor="border"
        borderRadius="xl"
        p="0"
        w={TREE_CARD_SIZE}
        h={TREE_CARD_SIZE}
        aspectRatio={1}
        cursor={clickable ? "pointer" : "default"}
        onClick={clickable ? onActivate : undefined}
        _hover={clickable ? { borderColor: "teal.solid", boxShadow: "sm" } : undefined}
      >
        <Box
          position="relative"
          flex="1"
          minH={0}
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
              maxW="100%"
              maxH="100%"
              w="auto"
              h="auto"
              objectFit="contain"
              objectPosition="center"
              draggable={false}
            />
          ) : (
            <Text fontSize="2xl" fontWeight="bold" color="gray.400" userSelect="none">
              {initial}
            </Text>
          )}
        </Box>
        <Stack gap="0" px="2" py="1.5" borderTopWidth="1px" borderColor="border" flexShrink={0}>
          <Text fontWeight="semibold" fontSize="xs" lineClamp={1} color="fg">
            {person.name}
          </Text>
          {relationLine ? (
            <Text fontSize="xs" color="fg.muted" lineClamp={1}>
              {relationLine}
            </Text>
          ) : null}
        </Stack>
      </Card.Root>
    );
  }

  return (
    <Card.Root
      data-person-card=""
      flexDirection="column"
      overflow="hidden"
      bg="white"
      borderWidth="1px"
      borderColor={expanded ? "sky.border" : "border"}
      borderRadius="xl"
      p="0"
      h="100%"
      w="100%"
      cursor="pointer"
      transition="border-color 0.15s ease, box-shadow 0.15s ease"
      boxShadow={expanded ? "sm" : undefined}
      onClick={onToggle}
      _hover={{ borderColor: expanded ? "sky.border" : "teal.solid", boxShadow: "sm" }}
    >
      <Box
        position="relative"
        flex="1"
        minH={{ base: "100px", md: "120px" }}
        maxH={{ base: "min(42vw, 160px)", md: "180px" }}
        bg="bg.subtle"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        {imageSrc ? (
          <Image
            src={imageSrc}
            alt=""
            w="100%"
            h="100%"
            objectFit="contain"
            objectPosition="center"
            draggable={false}
          />
        ) : (
          <Text fontSize="3xl" fontWeight="bold" color="gray.400" userSelect="none">
            {initial}
          </Text>
        )}
      </Box>
      <Stack
        gap="1"
        px="3"
        py="2"
        borderTopWidth="1px"
        borderColor="border"
        bg="white"
        flexShrink={0}
        align="stretch"
        textAlign="left"
        onClick={(e) => {
          if (expanded) e.stopPropagation();
        }}
      >
        <HStack gap="2" align="flex-start" justify="space-between">
          <Stack gap="0" flex="1" minW={0} align="flex-start">
            <Text fontWeight="semibold" fontSize="sm" lineClamp={expanded ? undefined : 2} color="fg">
              {person.name}
            </Text>
            {relationLine ? (
              <Text fontSize="xs" color="fg.muted" lineClamp={expanded ? undefined : 2}>
                {relationLine}
              </Text>
            ) : null}
          </Stack>
          <Text
            as="span"
            aria-hidden
            color="fg.muted"
            fontSize="lg"
            lineHeight="1"
            flexShrink={0}
            transform={expanded ? "rotate(90deg)" : undefined}
            transition="transform 0.15s ease"
          >
            ›
          </Text>
        </HStack>

        {expanded ? (
          <Stack gap="1" w="100%" pt="1">
            {lifeDates ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg">
                {lifeDates}
              </Text>
            ) : null}
            {parentsLine ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                {parentsLine.kind === "my-parents" ? "Parents" : "Their parents"}: {parentsLine.text}
              </Text>
            ) : !readOnly && !person.is_self ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" fontStyle="italic">
                Parents not set — use Edit to link their parents for the tree
              </Text>
            ) : null}
            {person.gender ? (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                {person.gender}
              </Text>
            ) : null}
            {!readOnly ? (
              <HStack justify="flex-start" pt="1">
                <PondButton
                  type="button"
                  size="sm"
                  colorPalette="lilypad"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.();
                  }}
                >
                  Edit
                </PondButton>
              </HStack>
            ) : (
              <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
                Read-only
              </Text>
            )}
          </Stack>
        ) : null}
      </Stack>
    </Card.Root>
  );
}
