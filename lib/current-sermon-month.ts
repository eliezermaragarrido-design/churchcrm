export function currentChurchMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", year: "numeric", month: "2-digit" }).formatToParts(now);
  return `${parts.find(part => part.type === "year")!.value}-${parts.find(part => part.type === "month")!.value}`;
}

export function sundaysInMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Invalid calendar month");
  const [year, number] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, number - 1, 1, 12));
  const firstSunday = 1 + (7 - first.getUTCDay()) % 7;
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const dates: string[] = [];
  for (let day = firstSunday; day <= days; day += 7) dates.push(`${month}-${String(day).padStart(2, "0")}`);
  return dates;
}
