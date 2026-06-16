import { Input, Stack, Text } from "@chakra-ui/react";
import type { MediaFormConfig } from "./mediaFormConfig";

type MediaRecommendationFieldsProps = {
  config: MediaFormConfig;
  title: string;
  creator: string;
  mediaSource: string;
  link: string;
  onTitleChange: (value: string) => void;
  onCreatorChange: (value: string) => void;
  onMediaSourceChange: (value: string) => void;
  onLinkChange: (value: string) => void;
  autoFocus?: boolean;
};

export default function MediaRecommendationFields({
  config,
  title,
  creator,
  mediaSource,
  link,
  onTitleChange,
  onCreatorChange,
  onMediaSourceChange,
  onLinkChange,
  autoFocus,
}: MediaRecommendationFieldsProps) {
  let focusUsed = false;
  const takeFocus = () => {
    if (focusUsed || autoFocus === false) return false;
    focusUsed = true;
    return true;
  };

  const titleField = config.showTitle ? (
    <Stack gap={0.5}>
      <Text fontWeight="medium">{config.titleLabel}</Text>
      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder={config.titlePlaceholder}
        autoFocus={takeFocus()}
      />
    </Stack>
  ) : null;

  const creatorField = config.showCreator ? (
    <Stack gap={0.5}>
      <Text fontWeight="medium">{config.creatorLabel}</Text>
      <Input
        value={creator}
        onChange={(e) => onCreatorChange(e.target.value)}
        placeholder={config.creatorPlaceholder}
        autoFocus={takeFocus()}
      />
    </Stack>
  ) : null;

  const mediaSourceField = config.showMediaSource ? (
    <Stack gap={0.5}>
      <Text fontWeight="medium">{config.mediaSourceLabel}</Text>
      <Input
        value={mediaSource}
        onChange={(e) => onMediaSourceChange(e.target.value)}
        placeholder={config.mediaSourcePlaceholder}
        autoFocus={takeFocus()}
      />
    </Stack>
  ) : null;

  const linkField = config.showLink ? (
    <Stack gap={0.5}>
      <Text fontWeight="medium">{config.linkLabel}</Text>
      <Input
        value={link}
        onChange={(e) => onLinkChange(e.target.value)}
        placeholder={config.linkPlaceholder ?? "https://…"}
      />
    </Stack>
  ) : null;

  if (config.fieldOrder === "artist-first") {
    return (
      <Stack gap={2}>
        {creatorField}
        {mediaSourceField}
        {titleField}
        {linkField}
      </Stack>
    );
  }

  return (
    <Stack gap={2}>
      {titleField}
      {creatorField}
      {mediaSourceField}
      {linkField}
    </Stack>
  );
}
