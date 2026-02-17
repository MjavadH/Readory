/**
 * Formats a date string or object into a human-readable update time string.
 */
export function formatUpdateTime(
    input: Date | string | number,
): string {
    const date = new Date(input);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    // Prevent negative time for future dates
    if (diffInSeconds < 0) return "just now";

    // Shared constants for time units
    const minute = 60;
    const hour = minute * 60;
    const day = hour * 24;
    const week = day * 7;
    const month = day * 30;
    const year = day * 365;

    if (diffInSeconds < minute) return "just now";

    if (diffInSeconds < hour) {
        const minutes = Math.floor(diffInSeconds / minute);
        return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
    }

    if (diffInSeconds < day) {
        const hours = Math.floor(diffInSeconds / hour);
        return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
    }

    if (diffInSeconds < week) {
        const days = Math.floor(diffInSeconds / day);
        return `${days} day${days !== 1 ? "s" : ""} ago`;
    }

    if (diffInSeconds < month) {
        const weeks = Math.floor(diffInSeconds / week);
        return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
    }

    if (diffInSeconds < year) {
        const months = Math.floor(diffInSeconds / month);
        return `${months} month${months !== 1 ? "s" : ""} ago`;
    }

    const years = Math.floor(diffInSeconds / year);
    return `${years} year${years !== 1 ? "s" : ""} ago`;
}