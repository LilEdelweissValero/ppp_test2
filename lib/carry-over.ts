// Carry-over ("Parking Lot"): items that can't finish this year are parked for a
// later PPP year. A non-null `carriedOverTo` (e.g. "2027") means the item is
// excluded from current-year calculations, like an abandoned item.

export function nextYear(now: Date = new Date()): string {
  return String(now.getFullYear() + 1);
}

export function carryOverData(
  carriedOver: boolean,
  carriedOverTo?: string | null,
  carriedOverRemarks?: string | null
) {
  if (!carriedOver) {
    return { carriedOverTo: null, carriedOverAt: null, carriedOverRemarks: null };
  }
  return {
    carriedOverTo: carriedOverTo || nextYear(),
    carriedOverAt: new Date().toISOString(),
    carriedOverRemarks: carriedOverRemarks ?? null,
  };
}
