import { getStatus } from "@/lib/statuses";
import type { StatusId } from "@/lib/statuses";

/** 顧客一覧・詳細共通のステータスバッジ */
export function StatusBadge({ status }: { status: StatusId }) {
  const def = getStatus(status);
  if (!def) {
    return (
      <span className="inline-flex items-center text-xs text-gray-400 px-2 py-0.5 rounded-full bg-gray-100 border border-gray-200">
        {status}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${def.badgeClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${def.dotClass}`} />
      {def.label}
    </span>
  );
}
