import { uploadClosetImageBlobForField } from "../closet/imageUpload";
import { ImageUploadField } from "../components/ImageUploadField";

export type PersonImageFieldProps = {
  imageKey: string;
  imageUrl?: string;
  onImageKeyChange: (key: string) => void;
  getApiAccessToken: () => Promise<string>;
  disabled?: boolean;
};

export function PersonImageField({
  imageKey,
  imageUrl,
  onImageKeyChange,
  getApiAccessToken,
  disabled = false,
}: PersonImageFieldProps) {
  return (
    <ImageUploadField
      label="Photo (optional)"
      imageKey={imageKey}
      imageUrl={imageUrl}
      onImageKeyChange={onImageKeyChange}
      getApiAccessToken={getApiAccessToken}
      uploadFromBlob={uploadClosetImageBlobForField}
      disabled={disabled}
      aspectRatio={1}
      previewMaxW="8rem"
      inventoryDescription="Photos from your Closet uploads."
      myImagesLabel="My images"
    />
  );
}
