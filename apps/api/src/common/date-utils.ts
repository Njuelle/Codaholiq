/** Returns the first day of the current UTC month at midnight. */
export function getMonthStart(): Date {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  return monthStart;
}
