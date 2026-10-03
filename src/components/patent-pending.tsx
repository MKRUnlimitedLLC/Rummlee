export const PATENT_PENDING =
  "Handoff method patent pending. A U.S. provisional application is on file. It is not an issued patent.";

export function PatentPending({ className = "text-xs text-subtle" }: { className?: string }) {
  return <p className={className}>{PATENT_PENDING}</p>;
}
