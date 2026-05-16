import {
  NativeSelectField,
  NativeSelectRoot,
  type NativeSelectFieldProps,
  type NativeSelectRootProps,
} from "@chakra-ui/react";
import type { ReactNode } from "react";

import { PANEL_SELECT_PROPS } from "../theme/typography";

export type PondNativeSelectProps = {
  rootProps?: NativeSelectRootProps;
  fieldProps?: NativeSelectFieldProps;
  children: ReactNode;
};

export default function PondNativeSelect({ rootProps, fieldProps, children }: PondNativeSelectProps) {
  return (
    <NativeSelectRoot {...rootProps}>
      <NativeSelectField {...PANEL_SELECT_PROPS} {...fieldProps}>
        {children}
      </NativeSelectField>
    </NativeSelectRoot>
  );
}
