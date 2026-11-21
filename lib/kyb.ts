export function mapKybStatus(bridgeStatus: string | null | undefined): string {
  switch (bridgeStatus) {
    case "active":
      return "approved";
    case "rejected":
    case "offboarded":
      return "rejected";
    case "under_review":
    case "awaiting_questionnaire":
    case "awaiting_ubo":
    case "paused":
      return "under_review";
    case "deposits_restricted":
      return "restricted";
    case "incomplete":
      return "incomplete";
    case "not_started":
    case undefined:
    case null:
    case "":
      return "pending";
    default:
      return "pending";
  }
}

export function canTransact(kybStatus: string): boolean {
  return kybStatus === "approved";
}
