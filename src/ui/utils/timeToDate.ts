import moment from './moment';

// User's timezone
const defaultTZ = 'America/New_York';

// Format ms since epoch to string to display
export const timeToDate = (time: number | string | Date) => {
  return time && moment.tz(time, defaultTZ).format('DD MMM YYYY');
};

// Same as timeToDate, but includes time of day (12-hour clock) -- use this
// instead of timeToDate for values that represent a specific moment/event
// (audit log entries, check-ins, transactions, etc.) rather than a calendar
// date (expirations, due dates), where time-of-day isn't meaningful.
export const timeToDateAndTime = (time: number | string | Date) => {
  return time && moment.tz(time, defaultTZ).format('DD MMM YYYY, h:mm A');
};

// Format ms since epoch to string to that is supported by HTML5 date picker
export const toDatePicker = (time: number | string | Date) => {
  return time && moment.tz(time, defaultTZ).format('YYYY-MM-DD');
};

// Format selected date in UTC to be relative to user's timezone
export const dateToTime = (date: string): number | undefined => {
  return date ? moment.tz(date, 'YYYY-MM-DD', defaultTZ).valueOf() : undefined;
};

export const dateToMidnight = (date: string | number | Date): string | undefined => {
  if (!date) {
    return undefined;
  }
  const asDate = new Date(date);
  // Normalize to midnight of the next day
  asDate.setUTCHours(24, 0, 0, 0);
  return asDate.toUTCString();
};
