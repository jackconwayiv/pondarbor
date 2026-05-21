import { Input, Stack, Text } from "@chakra-ui/react";

import PondNativeSelect from "../components/PondNativeSelect";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import { PersonDateFields } from "./PersonDateFields";
import { PersonImageField } from "./PersonImageField";
import { RelationFields } from "./RelationFields";

export type PersonFormFieldsProps = {
  formName: string;
  onFormNameChange: (v: string) => void;
  formCore: string;
  onFormCoreChange: (v: string) => void;
  formAlias: string;
  onFormAliasChange: (v: string) => void;
  prefixTokens: string[];
  onPrefixTokensChange: (tokens: string[]) => void;
  suffixTokens: string[];
  onSuffixTokensChange: (tokens: string[]) => void;
  formBirth: string;
  onFormBirthChange: (v: string) => void;
  formDeath: string;
  onFormDeathChange: (v: string) => void;
  formGender: string;
  onFormGenderChange: (v: string) => void;
  formImageKey: string;
  formImageUrl?: string;
  onFormImageKeyChange: (v: string) => void;
  getApiAccessToken: () => Promise<string>;
  disabled?: boolean;
  relationCoreLocked?: boolean;
};

export function PersonFormFields({
  formName,
  onFormNameChange,
  formCore,
  onFormCoreChange,
  formAlias,
  onFormAliasChange,
  prefixTokens,
  onPrefixTokensChange,
  suffixTokens,
  onSuffixTokensChange,
  formBirth,
  onFormBirthChange,
  formDeath,
  onFormDeathChange,
  formGender,
  onFormGenderChange,
  formImageKey,
  formImageUrl,
  onFormImageKeyChange,
  getApiAccessToken,
  disabled = false,
  relationCoreLocked = false,
}: PersonFormFieldsProps) {
  return (
    <Stack gap="2">
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Name
        </Text>
        <Input
          value={formName}
          onChange={(e) => onFormNameChange(e.target.value)}
          disabled={disabled}
          {...PANEL_FIELD_PROPS}
        />
      </Stack>

      <PersonImageField
        imageKey={formImageKey}
        imageUrl={formImageUrl}
        onImageKeyChange={onFormImageKeyChange}
        getApiAccessToken={getApiAccessToken}
        disabled={disabled}
      />

      <RelationFields
        formCore={formCore}
        onFormCoreChange={onFormCoreChange}
        formAlias={formAlias}
        onFormAliasChange={onFormAliasChange}
        prefixTokens={prefixTokens}
        onPrefixTokensChange={onPrefixTokensChange}
        suffixTokens={suffixTokens}
        onSuffixTokensChange={onSuffixTokensChange}
        disabled={disabled}
        relationCoreLocked={relationCoreLocked}
      />

      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Gender (optional)
        </Text>
        <PondNativeSelect
          rootProps={{ disabled }}
          fieldProps={{
            value: formGender,
            onChange: (e) => onFormGenderChange(e.target.value),
          }}
        >
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </PondNativeSelect>
      </Stack>
      <PersonDateFields
        label="Birthday (optional)"
        value={formBirth}
        onChange={onFormBirthChange}
        disabled={disabled}
      />
      <PersonDateFields
        label="Death date (optional)"
        value={formDeath}
        onChange={onFormDeathChange}
        disabled={disabled}
      />
    </Stack>
  );
}
