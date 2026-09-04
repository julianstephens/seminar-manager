import { Button, Flex, Icon, List, Stack, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { LuTrash2 } from "react-icons/lu";

type ParticipantItem = {
  id: number;
  name: string;
};

type ParticipantListSectionProps = {
  participants: ParticipantItem[];
  isRemoving: boolean;
  onRequestRemove: (participant: ParticipantItem) => void;
  addControl: ReactNode;
};

export const ParticipantListSection = ({
  participants,
  isRemoving,
  onRequestRemove,
  addControl,
}: ParticipantListSectionProps) => {
  return (
    <Stack gap={4}>
      <Text
        fontSize="xs"
        letterSpacing="0.18em"
        textTransform="uppercase"
        color="gray.400"
        fontWeight="700"
      >
        Participants ({participants.length})
      </Text>

      <Flex align="center" gap={3} wrap="wrap">
        {participants.length > 0 ? (
          <List.Root display="flex" flexDirection="row" ps={4} gap={8}>
            {participants.map((participant) => (
              <List.Item key={participant.id}>
                <Flex align="center" gap={2}>
                  <Text color="white" fontWeight="600">
                    {participant.name.split(" ")[0]}
                  </Text>
                  <Button
                    aria-label={`Remove ${participant.name} from seminar`}
                    variant="ghost"
                    size="xs"
                    color="red.300"
                    _hover={{ bg: "red.950" }}
                    loading={isRemoving}
                    disabled={isRemoving}
                    onClick={() => onRequestRemove(participant)}
                  >
                    <Icon as={LuTrash2} boxSize={3.5} />
                  </Button>
                </Flex>
              </List.Item>
            ))}
          </List.Root>
        ) : null}

        {addControl}
      </Flex>
    </Stack>
  );
};
