/** Dashboard copy — monthly stats, conversion, and appointments tab guidance. */

export function getDashboardPeriodLabel(month: string, year: string): string {
  const now = new Date();
  const monthNum = month ? parseInt(month, 10) : now.getMonth() + 1;
  const yearNum = year ? parseInt(year, 10) : now.getFullYear();
  return new Date(yearNum, monthNum - 1).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
}

export const DASHBOARD_SECTION_TITLE = 'Sales Performance';

export function getDashboardSectionSubtitle(month: string, year: string): string {
  return `Your monthly totals for ${getDashboardPeriodLabel(month, year)} — not daily figures`;
}

export const DASHBOARD_APPOINTMENTS_LABEL_REP = 'Appointments';

export const DASHBOARD_APPOINTMENTS_LABEL_ADMIN = 'Sat Appointments';

export const DASHBOARD_APPOINTMENTS_HELP_REP =
  'Your jobs with a visit date in this month. This is a monthly total — not the same as the daily list on the Appointments tab.';

export const DASHBOARD_APPOINTMENTS_HELP_ADMIN =
  'Fully sat appointments this month (team-wide). Excludes incomplete or rescheduled visits.';

export const DASHBOARD_SALES_WON_LABEL = 'Sales Won';

export const DASHBOARD_SALES_WON_HELP =
  'Jobs you marked Won during this month. Updates when you record the outcome on Solar Progress.';

export const DASHBOARD_CONVERSION_LABEL = 'Conversion Rate';

export const DASHBOARD_CONVERSION_HELP_REP =
  'Sales won ÷ your appointments for this month, shown as a percentage.';

export const DASHBOARD_CONVERSION_HELP_ADMIN =
  'Sales won ÷ sat appointments for this month, shown as a percentage.';

export const DASHBOARD_STATS_INFO_TITLE = 'How these numbers work';

export const DASHBOARD_STATS_INFO_BODY =
  'All three cards above are monthly totals for the period shown in the calendar filter. They do not reset each day. Use the month picker to review a previous month.';

export const DASHBOARD_APPOINTMENTS_TIP_TITLE = 'Today\'s & tomorrow\'s visits';

export const DASHBOARD_APPOINTMENTS_TIP_BODY =
  'The Appointments tab shows today\'s jobs by default. To check tomorrow or later, open Appointments, expand Appointment Date Filter, and tap Next Day, This Week, or This Month.';

export const DASHBOARD_APPOINTMENTS_TIP_CTA = 'Go to Appointments';
