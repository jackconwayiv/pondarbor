import { Collapsible, HStack, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";

import PondButton from "../../PondButton";
import PondNativeSelect from "../../components/PondNativeSelect";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../../theme/typography";
import { PersonDateFields } from "../PersonDateFields";
import { PersonImageField } from "../PersonImageField";
import { RelationFields } from "../RelationFields";
import { labelForRelationCore } from "../relationVocab";
import {
  applyPersonFormField,
  emptyPersonForm,
  type PersonFormState,
} from "../personFormState";

function WizardPersonExtraFields({
  form,
  setField,
  disabled,
  busy,
  relationCoreLocked,
  showRelationInDetails,
}: {
  form: PersonFormState;
  setField: <K extends keyof PersonFormState>(key: K, value: PersonFormState[K]) => void;
  disabled: boolean;
  busy: boolean;
  relationCoreLocked: boolean;
  /** Prefix/suffix/alias when relation core is fixed above the fold. */
  showRelationInDetails: boolean;
}) {
  return (
    <Stack gap="2">
      {showRelationInDetails ? (
        <RelationFields
          formCore={form.core}
          onFormCoreChange={(v) => setField("core", v)}
          formAlias={form.alias}
          onFormAliasChange={(v) => setField("alias", v)}
          prefixTokens={form.prefix}
          onPrefixTokensChange={(v) => setField("prefix", v)}
          suffixTokens={form.suffix}
          onSuffixTokensChange={(v) => setField("suffix", v)}
          disabled={disabled || busy}
          relationCoreLocked={relationCoreLocked}
        />
      ) : null}
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Gender (optional)
        </Text>
        <PondNativeSelect
          rootProps={{ disabled: disabled || busy }}
          fieldProps={{
            value: form.gender,
            onChange: (e) => setField("gender", e.target.value),
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
        value={form.birth}
        onChange={(v) => setField("birth", v)}
        disabled={disabled || busy}
      />
      <PersonDateFields
        label="Death date (optional)"
        value={form.death}
        onChange={(v) => setField("death", v)}
        disabled={disabled || busy}
      />
    </Stack>
  );
}

export function WizardPersonEntry({
  form,
  onFormChange,
  onSave,
  saveLabel = "Save",
  busy,
  getApiAccessToken,
  relationCoreLocked = false,
  defaultCore,
  showRelationFields = true,
  disabled = false,
  onClose,
  relationLabel,
  relationHint,
  relationInDetails = false,
}: {
  form: PersonFormState;
  onFormChange: (next: PersonFormState) => void;
  onSave: () => void | Promise<void>;
  saveLabel?: string;
  busy?: boolean;
  getApiAccessToken: () => Promise<string>;
  relationCoreLocked?: boolean;
  defaultCore?: string;
  showRelationFields?: boolean;
  disabled?: boolean;
  /** Dismiss this entry without saving (wizard optional forms). */
  onClose?: () => void;
  /** Overrides locked relation line (e.g. sister-in-law, not spouse). */
  relationLabel?: string;
  /** Helper when relation is editable under Add details. */
  relationHint?: string;
  /** Show relation-to-me controls inside Add details (editable unless relationCoreLocked). */
  relationInDetails?: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const setField = <K extends keyof PersonFormState>(key: K, value: PersonFormState[K]) => {
    onFormChange(applyPersonFormField(form, key, value));
  };

  const effectiveForm =
    defaultCore && relationCoreLocked ? { ...form, core: defaultCore } : form;

  const relationInMain = showRelationFields && !relationCoreLocked;

  return (
    <Stack gap="2" p="3" borderWidth="1px" borderColor="border" borderRadius="lg" bg="bg">
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Name
        </Text>
        <Input
          value={effectiveForm.name}
          onChange={(e) => setField("name", e.target.value)}
          disabled={disabled || busy}
          {...PANEL_FIELD_PROPS}
        />
      </Stack>

      <PersonImageField
        imageKey={effectiveForm.imageKey}
        imageUrl={effectiveForm.imageUrl}
        onImageKeyChange={(v) => setField("imageKey", v)}
        getApiAccessToken={getApiAccessToken}
        disabled={disabled || busy}
      />

      {relationCoreLocked && (relationLabel || defaultCore) ? (
        <Text fontSize={APP_TEXT_SIZES.body} color="fg.muted">
          Relation to me: {relationLabel ?? labelForRelationCore(defaultCore!)}
        </Text>
      ) : null}

      {relationHint && !relationCoreLocked ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" lineHeight="snug">
          {relationHint}
        </Text>
      ) : null}

      {relationInMain ? (
        <RelationFields
          formCore={effectiveForm.core}
          onFormCoreChange={(v) => setField("core", v)}
          formAlias={effectiveForm.alias}
          onFormAliasChange={(v) => setField("alias", v)}
          prefixTokens={effectiveForm.prefix}
          onPrefixTokensChange={(v) => setField("prefix", v)}
          suffixTokens={effectiveForm.suffix}
          onSuffixTokensChange={(v) => setField("suffix", v)}
          disabled={disabled || busy}
        />
      ) : null}

      <Collapsible.Root open={detailsOpen} onOpenChange={(d) => setDetailsOpen(d.open)}>
        <Collapsible.Trigger asChild>
          <PondButton type="button" size="sm" variant="ghost" colorPalette="sky">
            {detailsOpen ? "Hide details" : "Add details"}
          </PondButton>
        </Collapsible.Trigger>
        <Collapsible.Content>
          <Stack gap="2" pt="2">
            <WizardPersonExtraFields
              form={effectiveForm}
              setField={setField}
              disabled={disabled}
              busy={busy ?? false}
              relationCoreLocked={relationCoreLocked}
              showRelationInDetails={relationInDetails || relationCoreLocked}
            />
          </Stack>
        </Collapsible.Content>
      </Collapsible.Root>

      <HStack justify="flex-end" gap="2" flexWrap="wrap">
        {onClose ? (
          <PondButton
            type="button"
            variant="outline"
            colorPalette="sky"
            size="sm"
            disabled={busy}
            onClick={onClose}
          >
            Close
          </PondButton>
        ) : null}
        <PondButton
          type="button"
          colorPalette="lilypad"
          size="sm"
          loading={busy}
          disabled={disabled || !effectiveForm.name.trim()}
          onClick={() => void onSave()}
        >
          {saveLabel}
        </PondButton>
      </HStack>
    </Stack>
  );
}

export function newEntryForm(overrides: Partial<PersonFormState> = {}): PersonFormState {
  return emptyPersonForm(overrides);
}
