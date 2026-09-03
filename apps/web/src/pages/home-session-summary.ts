export type SessionSummaryArgs = {
  data: {
    date: string;
    published_at?: string | null;
    status?: "scheduled" | "completed" | "canceled";
  };
}[];

export const getSessionSummary = (sessions: SessionSummaryArgs) => {
  const published = sessions.filter(({ data }) => {
    if (!data.published_at) {
      return false;
    }

    return !Number.isNaN(new Date(data.date).getTime());
  });

  const planned = published.length;

  const upcoming = published
    .map(({ data }) => ({
      date: new Date(data.date),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const nextSession = upcoming[0];

  return {
    planned,
    nextSessionLabel: nextSession
      ? new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(nextSession.date)
      : "Not scheduled",
  };
};
