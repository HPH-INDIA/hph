// Test-preview calendar snapshot, read from hph-inhouse.office_holidays on 2026-10-09.
// The current reporting API exposes holiday counts, but not the calendar dates.
// Refresh this snapshot when the office calendar changes; replace with API dates
// when integrating the preview into the main application.
export const officeHolidayDates = new Set([
  '2026-01-01', '2026-01-14', '2026-01-26', '2026-05-01', '2026-06-02',
  '2026-09-14', '2026-10-02', '2026-10-21', '2026-11-09', '2026-12-25',
]);
