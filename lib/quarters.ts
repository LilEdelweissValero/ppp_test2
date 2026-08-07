export function currentQuarter(date: Date = new Date()): string {
  const month = date.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  const year = date.getFullYear();
  return `Q${quarter} ${year}`;
}

export function parseQuarter(q: string): { year: number; quarter: number } | null {
  const match = q.match(/^Q([1-4])\s+(\d{4})$/);
  if (!match) return null;
  return { quarter: parseInt(match[1]), year: parseInt(match[2]) };
}

export function compareQuarters(a: string, b: string): number {
  const pa = parseQuarter(a);
  const pb = parseQuarter(b);
  if (!pa || !pb) return 0;
  if (pa.year !== pb.year) return pa.year - pb.year;
  return pa.quarter - pb.quarter;
}

export function quarterRange(yearsBack = 2, yearsForward = 2): string[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const range: string[] = [];
  for (let y = currentYear - yearsBack; y <= currentYear + yearsForward; y++) {
    for (let q = 1; q <= 4; q++) {
      range.push(`Q${q} ${y}`);
    }
  }
  return range;
}

export function isQuarterValid(q: string): boolean {
  return parseQuarter(q) !== null;
}
