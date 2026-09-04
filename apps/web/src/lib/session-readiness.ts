export type ReadinessActionKind =
  | "focus-title"
  | "view-seminar"
  | "add-resource"
  | "add-assignment"
  | "edit-resource-url"
  | "review-resources"
  | "review-assignments";

export type ReadinessActionSpec = {
  kind: ReadinessActionKind;
  label: string;
  resourceName?: string;
};

const readResourceName = (issue: string) => {
  const fancyQuoteMatch = issue.match(/Resource “(.+)” needs a URL\./);
  if (fancyQuoteMatch?.[1]) {
    return fancyQuoteMatch[1];
  }

  const plainQuoteMatch = issue.match(/Resource "(.+)" needs a URL\./);
  return plainQuoteMatch?.[1];
};

export const getReadinessActionSpec = (
  issue: string,
  hasResources: boolean,
): ReadinessActionSpec => {
  if (issue.includes("session title")) {
    return {
      kind: "focus-title",
      label: "Add title",
    };
  }

  if (issue.includes("Discord channel")) {
    return {
      kind: "view-seminar",
      label: "View seminar",
    };
  }

  if (issue.includes("assignment is required")) {
    return hasResources
      ? {
          kind: "add-assignment",
          label: "Add assignment",
        }
      : {
          kind: "add-resource",
          label: "Add resource",
        };
  }

  if (issue.startsWith("Resource")) {
    const resourceName = readResourceName(issue);
    if (resourceName) {
      return {
        kind: "edit-resource-url",
        label: "Add URL",
        resourceName,
      };
    }

    return {
      kind: "review-resources",
      label: "Review resources",
    };
  }

  return {
    kind: "review-assignments",
    label: "Review assignments",
  };
};
