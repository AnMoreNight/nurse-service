"""
Recurrence expansion utilities for recurring schedules.
Handles weekly, monthly (by day-of-week), and yearly patterns.
"""

from datetime import date, timedelta, datetime
from typing import List, Dict, Optional
from calendar import monthcalendar


def expand_recurring_schedule(
    base_date: date,
    start_time: datetime,
    end_time: datetime,
    rule: Dict,
    query_start: date,
    query_end: date,
    excluded_dates: Optional[List[str]] = None
) -> List[Dict]:
    """
    Expand a recurring schedule into individual occurrences within a date range.
    
    Args:
        base_date: The original schedule date
        start_time: The schedule start time
        end_time: The schedule end time
        rule: Recurring rule dictionary with frequency, interval, day_of_week, etc.
        query_start: Start of date range to expand into
        query_end: End of date range to expand into
        excluded_dates: List of dates (YYYY-MM-DD) to exclude from expansion
    
    Returns:
        List of occurrence dictionaries with date, start_time, end_time
    """
    if not rule:
        return []
    
    occurrences = []
    frequency = rule.get('frequency', 'weekly')
    interval = rule.get('interval', 1)
    rule_end_date = rule.get('end_date')
    excluded = set(excluded_dates or [])
    
    # Ensure query_start is not before base_date
    effective_start = max(query_start, base_date)
    
    # Apply rule end date if specified
    if rule_end_date:
        if isinstance(rule_end_date, str):
            rule_end_date = datetime.strptime(rule_end_date, "%Y-%m-%d").date()
        query_end = min(query_end, rule_end_date)
    
    if frequency == 'daily':
        occurrences = _expand_daily(base_date, effective_start, query_end, interval, excluded)
    elif frequency == 'weekly':
        days_of_week = rule.get('day_of_week', [])
        occurrences = _expand_weekly(base_date, effective_start, query_end, interval, days_of_week, excluded)
    elif frequency == 'monthly':
        week_of_month = rule.get('week_of_month')
        day_of_week_monthly = rule.get('day_of_week_monthly')
        day_of_month = rule.get('day_of_month')
        occurrences = _expand_monthly(base_date, effective_start, query_end, interval, 
                                       week_of_month, day_of_week_monthly, day_of_month, excluded)
    elif frequency == 'yearly':
        month_of_year = rule.get('month_of_year', base_date.month)
        occurrences = _expand_yearly(base_date, effective_start, query_end, interval, month_of_year, excluded)
    
    # Add time information to each occurrence
    time_delta = end_time - start_time
    result = []
    for occ_date in occurrences:
        result.append({
            'date': occ_date,
            'start_time': datetime.combine(occ_date, start_time.time()) if hasattr(start_time, 'time') else start_time,
            'end_time': datetime.combine(occ_date, end_time.time()) if hasattr(end_time, 'time') else end_time,
        })
    
    return result


def _expand_daily(base_date: date, start: date, end: date, interval: int, excluded: set) -> List[date]:
    """Expand daily recurrence."""
    occurrences = []
    current = base_date
    
    while current <= end:
        if current >= start and current.isoformat() not in excluded:
            occurrences.append(current)
        current += timedelta(days=interval)
    
    return occurrences


def _expand_weekly(base_date: date, start: date, end: date, interval: int, 
                   days_of_week: List[int], excluded: set) -> List[date]:
    """
    Expand weekly recurrence.
    days_of_week: 0=Monday, 1=Tuesday, ... 6=Sunday (Python convention)
                  OR 0=Sunday, 1=Monday, ... 6=Saturday (JavaScript convention)
    We use JavaScript convention to match frontend.
    """
    occurrences = []
    
    if not days_of_week:
        # Default to the day of week of the base date (JavaScript convention: 0=Sun)
        js_dow = (base_date.weekday() + 1) % 7
        days_of_week = [js_dow]
    
    # Find the start of the week containing base_date
    base_week_start = base_date - timedelta(days=(base_date.weekday() + 1) % 7)  # Sunday
    current_week_start = base_week_start
    
    while current_week_start <= end:
        for dow in days_of_week:
            # Convert JS day of week (0=Sun) to date
            occ_date = current_week_start + timedelta(days=dow)
            if start <= occ_date <= end and occ_date >= base_date and occ_date.isoformat() not in excluded:
                occurrences.append(occ_date)
        
        current_week_start += timedelta(weeks=interval)
    
    return sorted(set(occurrences))


def _expand_monthly(base_date: date, start: date, end: date, interval: int,
                    week_of_month: Optional[List[int]], day_of_week_monthly: Optional[int],
                    day_of_month: Optional[int], excluded: set) -> List[date]:
    """
    Expand monthly recurrence.
    - If week_of_month (array) and day_of_week_monthly provided: e.g., 1st and 3rd Tuesday
    - If day_of_month provided: e.g., 15th of each month
    - Otherwise: same day of month as base_date

    week_of_month can be:
    - A list of week numbers [1, 3] for "1st and 3rd week"
    - A single value wrapped in list [2] for "2nd week only"
    - None for day-of-month mode
    """
    occurrences = []
    current_year = base_date.year
    current_month = base_date.month

    # Normalize week_of_month to list if it's a single value (backward compatibility)
    weeks_list = week_of_month if isinstance(week_of_month, list) else ([week_of_month] if week_of_month is not None else None)

    while True:
        month_has_valid_date = False

        try:
            if weeks_list is not None and day_of_week_monthly is not None:
                # Find nth day-of-week in month for each week number (e.g., 1st and 3rd Tuesday)
                for week_num in weeks_list:
                    try:
                        occ_date = _get_nth_weekday(current_year, current_month, week_num, day_of_week_monthly)

                        if occ_date > end:
                            continue

                        if occ_date >= start and occ_date >= base_date and occ_date.isoformat() not in excluded:
                            occurrences.append(occ_date)
                            month_has_valid_date = True
                    except ValueError:
                        pass  # This week number doesn't exist in this month (e.g., 5th Tuesday)
            elif day_of_month is not None:
                occ_date = date(current_year, current_month, min(day_of_month, _days_in_month(current_year, current_month)))

                if occ_date > end:
                    break

                if occ_date >= start and occ_date >= base_date and occ_date.isoformat() not in excluded:
                    occurrences.append(occ_date)
                    month_has_valid_date = True
            else:
                occ_date = date(current_year, current_month, min(base_date.day, _days_in_month(current_year, current_month)))

                if occ_date > end:
                    break

                if occ_date >= start and occ_date >= base_date and occ_date.isoformat() not in excluded:
                    occurrences.append(occ_date)
                    month_has_valid_date = True

            # Check if we've passed the end date for non-weekday modes
            if weeks_list is None or day_of_week_monthly is None:
                if not month_has_valid_date:
                    # Check if the month itself is past the end
                    last_day = date(current_year, current_month, _days_in_month(current_year, current_month))
                    if last_day > end:
                        break

        except ValueError:
            pass  # Invalid date, skip

        # Move to next month
        current_month += interval
        while current_month > 12:
            current_month -= 12
            current_year += 1

        # Safety check - stop if we've gone too far past the end date
        if date(current_year, current_month, 1) > end + timedelta(days=31):
            break

    return sorted(set(occurrences))


def _expand_yearly(base_date: date, start: date, end: date, interval: int,
                   month_of_year: int, excluded: set) -> List[date]:
    """Expand yearly recurrence."""
    occurrences = []
    current_year = base_date.year
    
    while True:
        try:
            occ_date = date(current_year, month_of_year, min(base_date.day, _days_in_month(current_year, month_of_year)))
            
            if occ_date > end:
                break
            
            if occ_date >= start and occ_date >= base_date and occ_date.isoformat() not in excluded:
                occurrences.append(occ_date)
        except ValueError:
            pass  # Invalid date, skip
        
        current_year += interval
    
    return occurrences


def _get_nth_weekday(year: int, month: int, n: int, weekday: int) -> date:
    """
    Get the nth occurrence of a weekday in a month.
    n: 1=first, 2=second, 3=third, 4=fourth, 5=last
    weekday: 0=Sunday, 1=Monday, ... 6=Saturday (JavaScript convention)
    """
    # Convert JS weekday to Python weekday (0=Monday)
    py_weekday = (weekday - 1) % 7
    
    cal = monthcalendar(year, month)
    
    if n == 5 or n == -1:  # Last occurrence
        for week in reversed(cal):
            if week[py_weekday] != 0:
                return date(year, month, week[py_weekday])
    else:
        count = 0
        for week in cal:
            if week[py_weekday] != 0:
                count += 1
                if count == n:
                    return date(year, month, week[py_weekday])
    
    raise ValueError(f"Cannot find {n}th occurrence of weekday {weekday} in {year}-{month}")


def _days_in_month(year: int, month: int) -> int:
    """Get the number of days in a month."""
    if month == 12:
        return (date(year + 1, 1, 1) - date(year, 12, 1)).days
    return (date(year, month + 1, 1) - date(year, month, 1)).days
