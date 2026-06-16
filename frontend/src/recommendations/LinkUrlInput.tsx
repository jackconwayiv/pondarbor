import { Input, Stack, Text } from "@chakra-ui/react";

type LinkUrlInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** Hide helper once title or image was resolved from the URL. */
  linkResolved?: boolean;
  autoFocus?: boolean;
};

export default function LinkUrlInput({
  value,
  onChange,
  linkResolved = false,
  autoFocus,
}: LinkUrlInputProps) {
  return (
    <Stack gap={0.5}>
      <Text fontWeight="medium">Link</Text>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://…"
        type="url"
        inputMode="url"
        autoFocus={autoFocus}
      />
      {!linkResolved ? (
        <Text fontSize="sm" color="fg.muted">
          Paste a website URL. We&apos;ll pre-fill the title and image when we can.
        </Text>
      ) : null}
    </Stack>
  );
}
