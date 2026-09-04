type ParticipantDirectoryEntry = {
  data: {
    name: string;
    discord_user_id: string;
  };
};

const normalizeName = (value: string) => value.trim().toLowerCase();

export const findParticipantByName = (
  participants: ParticipantDirectoryEntry[],
  name: string,
) => {
  const normalizedName = normalizeName(name);
  if (!normalizedName) {
    return null;
  }

  return (
    participants.find(
      ({ data }) => normalizeName(data.name) === normalizedName,
    ) ?? null
  );
};
