/**
 * Formats a date string or object into a human-readable update time string.
 */
export function formatUpdateTime(
    input: Date | string | number,
    t: (key: string, values?: any) => string
): string {
    const date = new Date(input);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    // Prevent negative time for future dates
    if (diffInSeconds < 0) return t("JustNow");

    // Shared constants for time units
    const minute = 60;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    const year = day * 365;

    if (diffInSeconds < minute) return t("JustNow");

    if (diffInSeconds < hour) {
        const minutes = Math.floor(diffInSeconds / minute);
        return t('MinutesAgo', { count: minutes });
    }

    if (diffInSeconds < day) {
        const hours = Math.floor(diffInSeconds / hour);
        return t('HoursAgo', { count: hours });
    }

    if (diffInSeconds < week) {
        const days = Math.floor(diffInSeconds / day);
        return t('DaysAgo', { count: days });
    }

    if (diffInSeconds < month) {
        const weeks = Math.floor(diffInSeconds / week);
        return t('WeeksAgo', { count: weeks });
    }

    if (diffInSeconds < year) {
        const months = Math.floor(diffInSeconds / month);
        return t('MonthsAgo', { count: months });
    }

    const years = Math.floor(diffInSeconds / year);
    return t('YearsAgo', { count: years });
}