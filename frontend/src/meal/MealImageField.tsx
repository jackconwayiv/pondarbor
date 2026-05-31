import { Text } from "@chakra-ui/react";
import { ImageUploadField } from "../components/ImageUploadField";
import { APP_TEXT_SIZES } from "../theme/typography";
import { uploadMealImageBlobViaPresign } from "./mealImageUpload";

export type MealImageFieldProps = {
  imageKey: string;
  /** Shown when set (e.g. from API `image_url`); falls back to public URL from `imageKey`. */
  imageUrl?: string;
  onImageKeyChange: (key: string) => void;
  getApiAccessToken: () => Promise<string>;
  disabled?: boolean;
};

export function MealImageField({
  imageKey,
  imageUrl,
  onImageKeyChange,
  getApiAccessToken,
  disabled = false,
}: MealImageFieldProps) {
  return (
    <ImageUploadField
      label={
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          Recipe photo (optional)
        </Text>
      }
      imageKey={imageKey}
      imageUrl={imageUrl}
      onImageKeyChange={onImageKeyChange}
      getApiAccessToken={getApiAccessToken}
      uploadFromBlob={uploadMealImageBlobViaPresign}
      disabled={disabled}
      aspectRatio={4 / 3}
      previewMaxW="12rem"
      inventoryDescription="Photos from your Closet uploads and recipe uploads."
      myImagesLabel="Choose from My Images"
    />
  );
}
