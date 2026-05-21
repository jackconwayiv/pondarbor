import { Collapsible, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { useState } from "react";

import PondNativeSelect from "../components/PondNativeSelect";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES, PANEL_NESTED_BLOCK_PROPS } from "../theme/typography";
import { parentRelationHintText } from "./parentRelationHint";
import { partnerLinkCandidates } from "./partnerLinkCandidates";
import { isParentRelationCore } from "./parentSync";
import type { PeoplePerson } from "./types";

export type PersonFamilyLinksVariant = "my-parents" | "their-parents" | "parent-relation-hint";

export type PersonFamilyLinksFieldsProps = {
  candidates: PeoplePerson[];
  /** Person being added/edited (undefined while adding before first save). */
  subjectPersonId?: string;
  subjectName?: string;
  existingPartnerIds?: string[];
  formMother: string;
  onFormMotherChange: (v: string) => void;
  formFather: string;
  onFormFatherChange: (v: string) => void;
  formStepMother: string;
  onFormStepMotherChange: (v: string) => void;
  formStepFather: string;
  onFormStepFatherChange: (v: string) => void;
  formPartnerOther?: string;
  onFormPartnerOtherChange?: (v: string) => void;
  formGuardian?: string;
  onFormGuardianChange?: (v: string) => void;
  disabled?: boolean;
  variant: PersonFamilyLinksVariant;
  relationCore?: string;
  relationPrefixTokens?: string[];
  relationSuffixTokens?: string[];
  showPartnerAndGuardian?: boolean;
};

function PartnerGuardianFields({
  subjectName,
  partnerCandidates,
  guardianCandidates,
  formPartnerOther,
  onFormPartnerOtherChange,
  formGuardian,
  onFormGuardianChange,
  disabled,
}: {
  subjectName: string;
  partnerCandidates: PeoplePerson[];
  guardianCandidates: PeoplePerson[];
  formPartnerOther: string;
  onFormPartnerOtherChange: (v: string) => void;
  formGuardian: string;
  onFormGuardianChange: (v: string) => void;
  disabled: boolean;
}) {
  const who = subjectName.trim() || "this person";
  return (
    <Stack gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
      <Stack gap="0.5">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
          Partner / spouse (tree link)
        </Text>
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          Connect {who} to someone else in your tree (e.g. your sister and her husband). This draws a
          partner line between them — it is not your relationship to either person; use Relation to me
          for that.
        </Text>
      </Stack>
      {partnerCandidates.length === 0 ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          Add another person first, or they are already linked as a partner.
        </Text>
      ) : (
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
            Partner with
          </Text>
          <PondNativeSelect
            rootProps={{ disabled }}
            fieldProps={{
              value: formPartnerOther,
              onChange: (e) => onFormPartnerOtherChange(e.target.value),
            }}
          >
            <option value="">None</option>
            {partnerCandidates.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </PondNativeSelect>
        </Stack>
      )}
      {guardianCandidates.length > 0 ? (
        <Stack gap="1">
          <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
            Guardian of {who}
          </Text>
          <PondNativeSelect
            rootProps={{ disabled }}
            fieldProps={{
              value: formGuardian,
              onChange: (e) => onFormGuardianChange(e.target.value),
            }}
          >
            <option value="">None</option>
            {guardianCandidates.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </PondNativeSelect>
        </Stack>
      ) : null}
    </Stack>
  );
}

export function PersonFamilyLinksFields({
  candidates,
  subjectPersonId,
  subjectName = "",
  existingPartnerIds = [],
  formMother,
  onFormMotherChange,
  formFather,
  onFormFatherChange,
  formStepMother,
  onFormStepMotherChange,
  formStepFather,
  onFormStepFatherChange,
  formPartnerOther = "",
  onFormPartnerOtherChange,
  formGuardian = "",
  onFormGuardianChange,
  disabled = false,
  variant,
  relationCore = "",
  relationPrefixTokens = [],
  relationSuffixTokens = [],
  showPartnerAndGuardian = true,
}: PersonFamilyLinksFieldsProps) {
  const hasCandidates = candidates.length > 0;
  const partnerCandidates = partnerLinkCandidates(
    candidates,
    subjectPersonId,
    existingPartnerIds,
  );
  const guardianCandidates = candidates.filter((p) => p.id !== subjectPersonId);
  const showConnections =
    showPartnerAndGuardian && onFormPartnerOtherChange && onFormGuardianChange;

  const connectionsBlock = showConnections ? (
    <PartnerGuardianFields
      subjectName={subjectName}
      partnerCandidates={partnerCandidates}
      guardianCandidates={guardianCandidates}
      formPartnerOther={formPartnerOther}
      onFormPartnerOtherChange={onFormPartnerOtherChange}
      formGuardian={formGuardian}
      onFormGuardianChange={onFormGuardianChange}
      disabled={disabled}
    />
  ) : null;

  if (variant === "parent-relation-hint") {
    return (
      <Stack gap="2">
        <Stack gap="1" {...PANEL_NESTED_BLOCK_PROPS}>
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            {parentRelationHintText(relationCore, relationPrefixTokens, relationSuffixTokens)}
          </Text>
        </Stack>
        {connectionsBlock}
      </Stack>
    );
  }

  const isMyParents = variant === "my-parents";
  const title = isMyParents ? "My parents" : "Their parents";
  const help = isMyParents
    ? "Biological parents (solid lines) on the tree."
    : "This person’s biological parents (for example your grandparents).";
  const stepTitle = isMyParents ? "My step-parents" : "Their step-parents";
  const stepHelp = isMyParents
    ? "Step-parents draw dashed lines down to you."
    : "Step-parents draw dashed lines down to this person.";

  const parentSelects = (
    <>
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Mother
        </Text>
        <PondNativeSelect
          rootProps={{ disabled }}
          fieldProps={{
            value: formMother,
            onChange: (e) => onFormMotherChange(e.target.value),
          }}
        >
          <option value="">None</option>
          {candidates.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </PondNativeSelect>
      </Stack>
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Father
        </Text>
        <PondNativeSelect
          rootProps={{ disabled }}
          fieldProps={{
            value: formFather,
            onChange: (e) => onFormFatherChange(e.target.value),
          }}
        >
          <option value="">None</option>
          {candidates.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </PondNativeSelect>
      </Stack>
    </>
  );

  const stepSelects = (
    <>
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Step-mother
        </Text>
        <PondNativeSelect
          rootProps={{ disabled }}
          fieldProps={{
            value: formStepMother,
            onChange: (e) => onFormStepMotherChange(e.target.value),
          }}
        >
          <option value="">None</option>
          {candidates.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </PondNativeSelect>
      </Stack>
      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Step-father
        </Text>
        <PondNativeSelect
          rootProps={{ disabled }}
          fieldProps={{
            value: formStepFather,
            onChange: (e) => onFormStepFatherChange(e.target.value),
          }}
        >
          <option value="">None</option>
          {candidates.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </PondNativeSelect>
      </Stack>
    </>
  );

  return (
    <Stack gap="2">
      <Stack gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
        <Stack gap="0.5">
          <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
            {title}
          </Text>
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            {help}
          </Text>
        </Stack>
        {!hasCandidates ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            Add at least one other person before you can pick parents.
          </Text>
        ) : (
          parentSelects
        )}
      </Stack>
      {hasCandidates ? (
        <Stack gap="2" {...PANEL_NESTED_BLOCK_PROPS}>
          <Stack gap="0.5">
            <Text fontSize={APP_TEXT_SIZES.label} fontWeight="semibold" color="fg">
              {stepTitle}
            </Text>
            <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
              {stepHelp}
            </Text>
          </Stack>
          {stepSelects}
        </Stack>
      ) : null}
      {connectionsBlock}
    </Stack>
  );
}

export function familyLinksFormHasValues(state: {
  mother?: string;
  father?: string;
  stepMother?: string;
  stepFather?: string;
  partnerOther?: string;
  guardian?: string;
}): boolean {
  return Boolean(
    state.mother?.trim() ||
      state.father?.trim() ||
      state.stepMother?.trim() ||
      state.stepFather?.trim() ||
      state.partnerOther?.trim() ||
      state.guardian?.trim(),
  );
}

export type PersonFamilyLinksSectionProps = PersonFamilyLinksFieldsProps & {
  /** Start expanded when the form already has link picks or existing tree links. */
  defaultOpen?: boolean;
  children?: ReactNode;
};

/** Collapsible wrapper for add/edit person modals (not the setup wizard). */
export function PersonFamilyLinksSection({
  defaultOpen = false,
  children,
  ...fieldsProps
}: PersonFamilyLinksSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible.Root open={open} onOpenChange={(details) => setOpen(details.open)}>
      <Collapsible.Trigger asChild>
        <PondButton
          type="button"
          variant={open ? "solid" : "outline"}
          colorPalette="sky"
          w="100%"
        >
          {open ? "Hide this person's relationships" : "This person's relationships"}
        </PondButton>
      </Collapsible.Trigger>
      <Collapsible.Content>
        <Stack gap="3" mt="3">
          <PersonFamilyLinksFields {...fieldsProps} />
          {children}
        </Stack>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

/** Pick family-links UI variant for add/edit dialogs. */
export function familyLinksVariantForForm(
  isSelf: boolean,
  relationCore: string,
  isCreate: boolean,
): PersonFamilyLinksVariant {
  if (isCreate && isParentRelationCore(relationCore)) {
    return "parent-relation-hint";
  }
  if (isSelf) return "my-parents";
  return "their-parents";
}
