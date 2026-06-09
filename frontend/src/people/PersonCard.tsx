import { Box, Card, HStack, Stack, Text } from "@chakra-ui/react";
import PresignedImage from "../lib/PresignedImage";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "react-router";

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";
import { formatLifeDates, formatRelationLine } from "./formatRelation";
import { personParentsLine } from "./personCardParents";
import { TREE_CARD_SIZE } from "./treeGridConstants";
import { treeOwnerProfilePath } from "./treeOwnerProfilePath";
import type { PeopleGraphBundle, PeoplePerson } from "./types";

export type PersonCardProps = {
  person: PeoplePerson;
  bundle: PeopleGraphBundle;
  /** Pond user who owns this tree; links the self person's name and avatar to their profile. */
  treeOwnerUserId?: number;
  variant?: "default" | "squareCompact";
  /** When true (squareCompact only), fill the parent box instead of TREE_CARD_SIZE. */
  fillContainer?: boolean;
  expanded?: boolean;
  readOnly?: boolean;
  onToggle?: () => void;
  onEdit?: () => void;
  onActivate?: () => void;
};

const profileLinkStyle: CSSProperties = {
  textDecoration: "none",
  color: "inherit",
  display: "block",
};

function TreeOwnerProfileLink({
  to,
  children,
}: {
  to: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} style={profileLinkStyle} onClick={(e) => e.stopPropagation()}>
      {children}
    </Link>
  );
}

export default function PersonCard({
  person,
  bundle,
  treeOwnerUserId,
  variant = "default",
  fillContainer = false,
  expanded = false,
  readOnly = false,
  onToggle,
  onEdit,
  onActivate,
}: PersonCardProps) {
  const { sessionUser, getApiAccessToken } = useAppSession();
  const imageSrc = (person.image_url || "").trim();
  const parentsLine = personParentsLine(person, bundle);
  const relationLine = formatRelationLine(person);
  const lifeDates = formatLifeDates(person);
  const initial = (person.name.trim().slice(0, 1) || "?").toUpperCase();
  const selfProfileTo =
    person.is_self && treeOwnerUserId != null
      ? treeOwnerProfilePath(treeOwnerUserId, sessionUser?.user.id)
      : null;

  const portrait = (
    <Box
      position="relative"
      flex="1"
      minH={0}
      bg="bg.subtle"
      display="flex"
      alignItems="center"
      justifyContent="center"
      overflow="hidden"
      cursor={selfProfileTo ? "pointer" : undefined}
      _hover={selfProfileTo ? { opacity: 0.92 } : undefined}
    >
      {imageSrc ? (
        <PresignedImage
          src={imageSrc}
          imageKey={person.image_key}
          getApiAccessToken={getApiAccessToken}
          alt=""
          w="100%"
          h="100%"
          objectFit="cover"
          objectPosition="center"
          draggable={false}
          userSelect="none"
          style={{ WebkitUserDrag: "none" } as CSSProperties}
        />
      ) : (
        <Text
          fontSize={variant === "squareCompact" ? "2xl" : "3xl"}
          fontWeight="bold"
          color="gray.400"
          userSelect="none"
          style={{ WebkitUserDrag: "none" } as CSSProperties}
        >
          {initial}
        </Text>
      )}
    </Box>
  );

  const nameLine = (
    <Text
      fontWeight="semibold"
      fontSize={variant === "squareCompact" ? "xs" : "sm"}
      lineClamp={
        variant === "squareCompact" ? 1 : expanded ? undefined : 2
      }
      color="fg"
      _hover={selfProfileTo ? { textDecoration: "underline" } : undefined}
    >
      {person.name}
    </Text>
  );

  if (variant === "squareCompact") {
    const clickable = Boolean(onActivate) && !selfProfileTo;
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
        w={fillContainer ? "100%" : TREE_CARD_SIZE}
        h={fillContainer ? "100%" : TREE_CARD_SIZE}
        aspectRatio={fillContainer ? undefined : 1}
        userSelect="none"
        cursor={clickable ? "pointer" : "default"}
        onClick={clickable ? onActivate : undefined}
        _hover={clickable ? { borderColor: "teal.solid", boxShadow: "sm" } : undefined}
      >
        {selfProfileTo ? (
          <TreeOwnerProfileLink to={selfProfileTo}>{portrait}</TreeOwnerProfileLink>
        ) : (
          portrait
        )}
        <Stack gap="0" px="2" py="1.5" borderTopWidth="1px" borderColor="border" flexShrink={0}>
          {selfProfileTo ? (
            <TreeOwnerProfileLink to={selfProfileTo}>{nameLine}</TreeOwnerProfileLink>
          ) : (
            nameLine
          )}
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
      {selfProfileTo ? (
        <TreeOwnerProfileLink to={selfProfileTo}>
          <Box
            position="relative"
            flex="1"
            minH={{ base: "100px", md: "120px" }}
            maxH={{ base: "min(42vw, 160px)", md: "180px" }}
            bg="bg.subtle"
            display="flex"
            alignItems="center"
            justifyContent="center"
            cursor="pointer"
            _hover={{ opacity: 0.92 }}
          >
            {imageSrc ? (
              <PresignedImage
                src={imageSrc}
                imageKey={person.image_key}
                getApiAccessToken={getApiAccessToken}
                alt=""
                w="100%"
                h="100%"
                objectFit="cover"
                objectPosition="center"
                draggable={false}
              />
            ) : (
              <Text fontSize="3xl" fontWeight="bold" color="gray.400" userSelect="none">
                {initial}
              </Text>
            )}
          </Box>
        </TreeOwnerProfileLink>
      ) : (
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
            <PresignedImage
              src={imageSrc}
              imageKey={person.image_key}
              getApiAccessToken={getApiAccessToken}
              alt=""
              w="100%"
              h="100%"
              objectFit="cover"
              objectPosition="center"
              draggable={false}
            />
          ) : (
            <Text fontSize="3xl" fontWeight="bold" color="gray.400" userSelect="none">
              {initial}
            </Text>
          )}
        </Box>
      )}
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
            {selfProfileTo ? (
              <TreeOwnerProfileLink to={selfProfileTo}>{nameLine}</TreeOwnerProfileLink>
            ) : (
              nameLine
            )}
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
