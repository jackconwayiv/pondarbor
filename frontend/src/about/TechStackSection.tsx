import { Flex, Link, Stack, Text } from "@chakra-ui/react";
import type { IconBaseProps, IconType } from "react-icons";
import {
  SiAuth0,
  SiChakraui,
  SiCloudflare,
  SiDocker,
  SiDjango,
  SiJavascript,
  SiPostgresql,
  SiPython,
  SiReact,
  SiRedis,
  SiSentry,
  SiTypescript,
  SiVite,
} from "react-icons/si";

/** Simple Icons path; react-icons 5.x does not yet export SiCursor. */
function SiCursorIcon({ size = "1em", ...props }: IconBaseProps) {
  return (
    <svg
      stroke="currentColor"
      fill="currentColor"
      strokeWidth="0"
      viewBox="0 0 24 24"
      height={size}
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
    </svg>
  );
}

type StackItem = {
  id: string;
  name: string;
  href: string;
  Icon: IconType;
};

const STACK_ITEMS: StackItem[] = [
  { id: "react", name: "React", href: "https://react.dev", Icon: SiReact },
  {
    id: "typescript",
    name: "TypeScript",
    href: "https://www.typescriptlang.org",
    Icon: SiTypescript,
  },
  {
    id: "javascript",
    name: "JavaScript",
    href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript",
    Icon: SiJavascript,
  },
  { id: "vite", name: "Vite", href: "https://vite.dev", Icon: SiVite },
  {
    id: "chakra",
    name: "Chakra UI",
    href: "https://chakra-ui.com",
    Icon: SiChakraui,
  },
  {
    id: "django",
    name: "Django",
    href: "https://www.djangoproject.com",
    Icon: SiDjango,
  },
  {
    id: "python",
    name: "Python",
    href: "https://www.python.org",
    Icon: SiPython,
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    href: "https://www.postgresql.org",
    Icon: SiPostgresql,
  },
  { id: "redis", name: "Redis", href: "https://redis.io", Icon: SiRedis },
  {
    id: "auth0",
    name: "Auth0",
    href: "https://auth0.com",
    Icon: SiAuth0,
  },
  {
    id: "sentry",
    name: "Sentry",
    href: "https://sentry.io",
    Icon: SiSentry,
  },
  {
    id: "cloudflare-r2",
    name: "Cloudflare R2",
    href: "https://developers.cloudflare.com/r2/",
    Icon: SiCloudflare,
  },
  {
    id: "docker",
    name: "Docker",
    href: "https://www.docker.com",
    Icon: SiDocker,
  },
  {
    id: "cursor",
    name: "Cursor",
    href: "https://cursor.com",
    Icon: SiCursorIcon,
  },
];

export default function TechStackSection() {
  return (
    <Stack gap="3" align="stretch">
      <Text
        fontSize="xs"
        fontWeight="medium"
        letterSpacing="0.12em"
        textTransform="uppercase"
        color="fg.muted"
        textAlign="center"
      >
        Built with
      </Text>
      <Flex
        flexWrap="wrap"
        justify="center"
        align="center"
        gap={{ base: "5", md: "6" }}
      >
        {STACK_ITEMS.map(({ id, name, href, Icon }) => (
          <Link
            key={id}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={name}
            display="inline-flex"
            color="fg.muted"
            opacity={0.7}
            transition="color 0.15s ease, opacity 0.15s ease"
            _hover={{ color: "fg", opacity: 1 }}
            _focusVisible={{
              outline: "2px solid",
              outlineColor: "sky.solid",
              outlineOffset: "2px",
              borderRadius: "sm",
            }}
          >
            <Icon aria-hidden size={28} />
          </Link>
        ))}
      </Flex>
    </Stack>
  );
}
