import { Text } from "@chakra-ui/react";

import { headlineDisplayLines } from "./headlines";

import "./Clicker2PondHeadline.css";

export function Clicker2PondHeadline({ text }: { text: string }) {
  const lines = headlineDisplayLines(text);
  const isHaiku = lines.length > 1;

  return (
    <Text
      className={
        isHaiku ? "pond2PondHeadline pond2PondHeadline--haiku" : "pond2PondHeadline"
      }
      fontSize={isHaiku ? "sm" : "md"}
      fontWeight="bold"
      fontStyle="italic"
      color="gray.600"
      textAlign="center"
      lineHeight={isHaiku ? "1.3" : "1.35"}
      px="2"
      role="status"
    >
      {lines.map((line, index) => (
        <span key={index}>
          {index > 0 ? <br /> : null}
          {line}
        </span>
      ))}
    </Text>
  );
}
