import { Box, Button, Flex, Link, Stack, Text } from "@chakra-ui/react";
import { LuExternalLink, LuFileText } from "react-icons/lu";

type ResourceItem = {
  id: string;
  name: string;
  url: string;
  visibility: "shared" | "individual";
};

type ResourceListProps = {
  isLoading: boolean;
  resources: ResourceItem[];
  onEdit: (resource: ResourceItem) => void;
  onRemove: (resource: Pick<ResourceItem, "id" | "name">) => void;
};

export const ResourceList = ({
  isLoading,
  resources,
  onEdit,
  onRemove,
}: ResourceListProps) => {
  return (
    <Stack gap={2}>
      {isLoading ? (
        <Text color="gray.400">Loading resources...</Text>
      ) : resources.length === 0 ? (
        <Text color="gray.400">No resources yet.</Text>
      ) : (
        resources.map((resource) => (
          <Flex
            key={resource.id}
            align="center"
            justify="space-between"
            borderRadius="md"
            border="1px solid"
            className="glass-panel"
            borderColor="transparent"
            bg="transparent"
            px={3}
            py={2}
            gap={3}
          >
            <Flex align="center" gap={2} minW="0" flex="1">
              <LuFileText />
              <Box minW="0">
                <Text color="white" fontWeight="600" truncate>
                  {resource.name}
                </Text>
                <Link href={resource.url} target="_blank" rel="noreferrer">
                  <Text
                    display="block"
                    color="gray.400"
                    maxW="80%"
                    fontSize="xs"
                    truncate
                    _hover={{ color: "var(--accent-soft)" }}
                    _focusVisible={{
                      outline: "2px solid",
                      outlineColor: "var(--accent-soft)",
                      outlineOffset: "2px",
                      borderRadius: "sm",
                    }}
                  >
                    {resource.url}
                  </Text>
                </Link>
              </Box>
            </Flex>
            <Flex gap={3} align="center" color="gray.400" fontSize="sm">
              <Text>{resource.visibility}</Text>
              <Link href={resource.url} target="_blank" rel="noreferrer">
                <Button
                  size="xs"
                  variant="ghost"
                  color="var(--accent-soft)"
                  _hover={{ bg: "rgba(216, 179, 140, 0.1)" }}
                >
                  <LuExternalLink />
                  Open
                </Button>
              </Link>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onEdit(resource)}
              >
                Edit
              </Button>
              <Button
                size="xs"
                variant="ghost"
                color="red.300"
                onClick={() =>
                  onRemove({ id: resource.id, name: resource.name })
                }
              >
                Remove
              </Button>
            </Flex>
          </Flex>
        ))
      )}
    </Stack>
  );
};
