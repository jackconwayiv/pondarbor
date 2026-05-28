import { Box, Button, Heading, HStack } from "@chakra-ui/react";

type Props = {
  onShop: () => void;
  onRest: () => void;
  onSail: () => void;
};

const ShipView = ({ onShop, onRest, onSail }: Props) => {
  return (
    <Box>
      <Heading mb={4}>🚢 Your Ship</Heading>

      <HStack wrap="wrap">
        <Button onClick={onShop}>Shop</Button>
        <Button onClick={onRest}>Rest</Button>
        <Button colorScheme="blue" onClick={onSail}>
          Sail
        </Button>
      </HStack>
    </Box>
  );
};

export default ShipView;
