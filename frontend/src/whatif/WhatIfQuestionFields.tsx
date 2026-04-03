import { HStack, Input, Stack, Text } from "@chakra-ui/react";

import { whatifInputProps } from "./whatifFieldProps";
import {
  WHATIF_QUESTION_PROMPT_PREFIX,
  isStandardWhatIfPromptPrefix,
  promptSuffixFromStored,
  storedPromptFromSuffix,
} from "./whatifQuestionFormUtils";

export type WhatIfQuestionDraftSlice = {
  prompt: string;
  answer_1: string;
  answer_2: string;
  answer_3: string;
  answer_4: string;
  answer_5: string;
  answer_6: string;
};

type WhatIfQuestionFieldsProps = {
  draft: WhatIfQuestionDraftSlice;
  onDraftChange: (patch: Partial<WhatIfQuestionDraftSlice>) => void;
};

export function WhatIfQuestionFields({ draft, onDraftChange }: WhatIfQuestionFieldsProps) {
  const standardPrompt = isStandardWhatIfPromptPrefix(draft.prompt);
  const promptSuffix = promptSuffixFromStored(draft.prompt);

  return (
    <Stack gap="3">
      <Stack gap="1">
        <Text fontSize="sm" fontWeight="medium" color="gray.700">
          Question
        </Text>
        {standardPrompt ? (
          <HStack align="center" gap="2" w="100%" minW={0}>
            <Text
              as="span"
              flexShrink={0}
              fontSize="sm"
              color="gray.600"
              fontWeight="medium"
              whiteSpace="nowrap"
            >
              {WHATIF_QUESTION_PROMPT_PREFIX.trimEnd()}
            </Text>
            <Input
              flex="1"
              minW={0}
              value={promptSuffix}
              onChange={(e) => onDraftChange({ prompt: storedPromptFromSuffix(e.target.value) })}
              placeholder="were a kind of fruit?"
              aria-label='Question text after "What if (subject token)"'
              {...whatifInputProps}
            />
          </HStack>
        ) : (
          <>
            <Text fontSize="xs" color="gray.600">
              This question does not use the usual &quot;What if {"{subject}"} …&quot; start. Edit the full prompt
              below.
            </Text>
            <Input
              value={draft.prompt}
              onChange={(e) => onDraftChange({ prompt: e.target.value })}
              placeholder='Full prompt (include "{subject}")'
              {...whatifInputProps}
            />
          </>
        )}
      </Stack>

      {([1, 2, 3, 4, 5, 6] as const).map((n) => {
        const key = `answer_${n}` as keyof WhatIfQuestionDraftSlice;
        return (
          <HStack key={key} align="center" gap="2" w="100%" minW={0}>
            <Text
              flexShrink={0}
              fontSize="sm"
              color="gray.600"
              fontWeight="medium"
              whiteSpace="pre"
            >
              {`${n} `}
            </Text>
            <Input
              flex="1"
              minW={0}
              value={draft[key] as string}
              onChange={(e) =>
                onDraftChange({ [key]: e.target.value } as Partial<WhatIfQuestionDraftSlice>)
              }
              placeholder={`Answer option ${n}`}
              aria-label={`Answer option ${n}`}
              {...whatifInputProps}
            />
          </HStack>
        );
      })}
    </Stack>
  );
}
