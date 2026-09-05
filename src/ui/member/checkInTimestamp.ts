interface TimestampRecord {
  timeOf?: string | Date;
  time?: number;
}

// Older records use numeric Unix timestamps and contain a mixture of seconds
// and milliseconds, irrespective of the BSON numeric type they originated as.
const SECONDS_MS_THRESHOLD = 10_000_000_000;

export const getCheckInTimestamp = (record: TimestampRecord): number | undefined => {
  if (record.timeOf !== undefined && record.timeOf !== null) {
    const timestamp = new Date(record.timeOf).getTime();
    return Number.isFinite(timestamp) ? timestamp : undefined;
  }

  if (typeof record.time !== "number" || !Number.isFinite(record.time) || record.time <= 0) {
    return undefined;
  }

  return record.time < SECONDS_MS_THRESHOLD ? record.time * 1000 : record.time;
};
