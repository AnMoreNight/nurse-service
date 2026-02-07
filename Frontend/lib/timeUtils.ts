/**
 * Normalize a time string to handle edge cases like "24:00"
 * Returns normalized time and whether it crosses into the next day
 */
export function normalizeTime(timeStr: string): { time: string; nextDay: boolean } {
    const [hours, minutes] = timeStr.split(':').map(Number);

    if (isNaN(hours) || isNaN(minutes)) {
        return { time: '00:00', nextDay: false };
    }

    if (hours < 0 || minutes < 0) {
        // Wrap negative values into valid 24h range
        const totalMins = ((hours * 60 + (minutes || 0)) % 1440 + 1440) % 1440;
        const h = Math.floor(totalMins / 60);
        const m = totalMins % 60;
        return {
            time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
            nextDay: false
        };
    }

    if (hours >= 24) {
        // Handle 24:00 or greater - convert to next day
        const normalizedHours = hours % 24;
        return {
            time: `${String(normalizedHours).padStart(2, '0')}:${String(minutes || 0).padStart(2, '0')}`,
            nextDay: true
        };
    }

    return {
        time: timeStr,
        nextDay: false
    };
}

/**
 * Create a proper datetime string, handling the 24:00 edge case
 */
export function createDateTime(date: string, time: string): string {
    const { time: normalizedTime, nextDay } = normalizeTime(time);

    if (nextDay) {
        // Add one day to the date
        const dateObj = new Date(date);
        dateObj.setDate(dateObj.getDate() + 1);
        const nextDate = dateObj.toISOString().split('T')[0];
        return `${nextDate}T${normalizedTime}:00`;
    }

    return `${date}T${normalizedTime}:00`;
}

/**
 * Validate and sanitize time input to prevent 24:00 from being used
 */
export function sanitizeTimeInput(timeStr: string): string {
    const { time } = normalizeTime(timeStr);
    return time;
}
