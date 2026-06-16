import { Input, Stack, Text } from "@chakra-ui/react";

type LocationPasteInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Hide intro helper once lookup has filled address or coordinates. */
  locationResolved?: boolean;
  autoFocus?: boolean;
};

export default function LocationPasteInput({
  value,
  onChange,
  locationResolved = false,
  autoFocus,
}: LocationPasteInputProps) {
  return (
    <Stack gap={0.5}>
      <Text fontWeight="medium">Link or location</Text>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="URL, coordinates, maps link, or place name & address"
        autoFocus={autoFocus}
      />
      {!locationResolved ? (
        <Text fontSize="sm" color="fg.muted">
          Paste a link, coordinates, or an address. We&apos;ll pre-fill what we can below.
        </Text>
      ) : null}
    </Stack>
  );
}
