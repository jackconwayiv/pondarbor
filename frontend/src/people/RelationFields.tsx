import { HStack, Input, Stack, Text, Wrap, WrapItem } from "@chakra-ui/react";

import PondButton from "../PondButton";
import PondNativeSelect from "../components/PondNativeSelect";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import { RELATION_PREFIX_TOKENS, relationCoreSelectOptions } from "./relationVocab";

export type RelationFieldsProps = {
  formCore: string;
  onFormCoreChange: (value: string) => void;
  formAlias: string;
  onFormAliasChange: (value: string) => void;
  prefixTokens: string[];
  onPrefixTokensChange: (tokens: string[]) => void;
  suffixTokens: string[];
  onSuffixTokensChange: (tokens: string[]) => void;
  disabled?: boolean;
  /** When true, relation core stays fixed (e.g. the owner's self row). Same layout as other people. */
  relationCoreLocked?: boolean;
};

function toggleToken(list: string[], token: string): string[] {
  return list.includes(token) ? list.filter((t) => t !== token) : [...list, token];
}

export function RelationFields({
  formCore,
  onFormCoreChange,
  formAlias,
  onFormAliasChange,
  prefixTokens,
  onPrefixTokensChange,
  suffixTokens,
  onSuffixTokensChange,
  disabled = false,
  relationCoreLocked = false,
}: RelationFieldsProps) {
  const showBestSuffix = formCore === "friend";
  const hasInLaw = suffixTokens.includes("in_law");
  const hasBest = suffixTokens.includes("best");

  return (
    <Stack gap="2">
      <HStack gap="2" align="flex-end" flexWrap="wrap">
        <Stack gap="1" flex="1" minW="10rem">
          <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
            Relation to me
          </Text>
          <PondNativeSelect
            rootProps={{ disabled: disabled || relationCoreLocked }}
            fieldProps={{
              value: formCore,
              onChange: (e) => onFormCoreChange(e.target.value),
            }}
          >
            {relationCoreSelectOptions(formCore).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </PondNativeSelect>
        </Stack>
        <Stack gap="1" flex="1" minW="10rem">
          <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
            Relation alias
          </Text>
          <Input
            value={formAlias}
            onChange={(e) => onFormAliasChange(e.target.value)}
            disabled={disabled}
            placeholder="Optional"
            {...PANEL_FIELD_PROPS}
          />
        </Stack>
      </HStack>

      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Relation prefixes
        </Text>
        <Wrap gap="1">
          {RELATION_PREFIX_TOKENS.map((t) => {
            const active = prefixTokens.includes(t.value);
            return (
              <WrapItem key={t.value}>
                <PondButton
                  type="button"
                  size="xs"
                  variant={active ? "solid" : "outline"}
                  colorPalette={active ? "sky" : "gray"}
                  disabled={disabled}
                  onClick={() => onPrefixTokensChange(toggleToken(prefixTokens, t.value))}
                >
                  {t.label}
                </PondButton>
              </WrapItem>
            );
          })}
        </Wrap>
      </Stack>

      <Stack gap="1">
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          Relation suffixes
        </Text>
        <HStack gap="2" flexWrap="wrap">
          <PondButton
            type="button"
            size="xs"
            variant={hasInLaw ? "solid" : "outline"}
            colorPalette={hasInLaw ? "sky" : "gray"}
            disabled={disabled}
            onClick={() => onSuffixTokensChange(toggleToken(suffixTokens, "in_law"))}
          >
            In-law
          </PondButton>
          {showBestSuffix ? (
            <PondButton
              type="button"
              size="xs"
              variant={hasBest ? "solid" : "outline"}
              colorPalette={hasBest ? "sky" : "gray"}
              disabled={disabled}
              onClick={() => onSuffixTokensChange(toggleToken(suffixTokens, "best"))}
            >
              Best
            </PondButton>
          ) : null}
        </HStack>
      </Stack>
    </Stack>
  );
}
