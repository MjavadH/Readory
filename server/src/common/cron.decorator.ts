export const CronExpression = {
  EVERY_DAY_AT_3AM: '0 3 * * *',
} as const;

export function Cron(_expression: string): MethodDecorator {
  return () => undefined;
}
