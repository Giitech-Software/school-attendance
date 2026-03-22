export function generateWeeksFromTerm(
  termId: string,
  startDate: string,
  endDate: string
) {
  const weeks: any[] = [];

  let current = new Date(startDate);
  const termEnd = new Date(endDate);
  let weekNumber = 1;

  // normalize times
  current.setHours(0, 0, 0, 0);
  termEnd.setHours(0, 0, 0, 0);

  while (current <= termEnd) {
    // ⛔ Skip Saturday (6) and Sunday (0)
    if (current.getDay() === 6) {
      current.setDate(current.getDate() + 2);
      continue;
    }
    if (current.getDay() === 0) {
      current.setDate(current.getDate() + 1);
      continue;
    }

    // ensure week starts on Monday
    while (current.getDay() !== 1) {
      current.setDate(current.getDate() - 1);
    }

    const weekStart = new Date(current);

    // compute week end = Friday
    const weekEnd = new Date(weekStart);
    while (weekEnd.getDay() !== 5) {
      weekEnd.setDate(weekEnd.getDate() + 1);
    }

    // clamp inside term
    if (weekStart < new Date(startDate)) {
      weekStart.setTime(new Date(startDate).getTime());
    }
    if (weekEnd > termEnd) {
      weekEnd.setTime(termEnd.getTime());
    }

    weeks.push({
      termId,
      weekNumber,
      startDate: weekStart.toISOString().slice(0, 10),
      endDate: weekEnd.toISOString().slice(0, 10),
      createdAt: new Date(),
    });

    // move to next Monday
    current = new Date(weekEnd);
    current.setDate(current.getDate() + 3);

    weekNumber++;
  }

  return weeks;
}
