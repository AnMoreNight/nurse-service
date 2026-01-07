"""
Constants for shift types and other enums.
Provides standardized values for shift types used across the application.
"""

from enum import Enum


class ShiftType(str, Enum):
    """
    Standard shift types.
    Use these values in both frontend and backend.
    """
    WORKDAY = "Workday"
    SCHEDULED_DAY_OFF = "ScheduledDayOff"
    NIGHT_DUTY_1 = "NightDuty1"
    NIGHT_DUTY_2 = "NightDuty2"
    NIGHT_DUTY_1_DAY_OFF = "NightDuty1DayOff"
    NIGHT_DUTY_2_DAY_OFF = "NightDuty2DayOff"


# Mapping from frontend shorthand to backend values
FRONTEND_TO_BACKEND_SHIFT_TYPE = {
    'work': ShiftType.WORKDAY.value,
    'holiday': ShiftType.SCHEDULED_DAY_OFF.value,
    'night1': ShiftType.NIGHT_DUTY_1.value,
    'night2': ShiftType.NIGHT_DUTY_2.value,
    'night1_holiday': ShiftType.NIGHT_DUTY_1_DAY_OFF.value,
    'night2_holiday': ShiftType.NIGHT_DUTY_2_DAY_OFF.value,
}

# Mapping from backend values to frontend shorthand
BACKEND_TO_FRONTEND_SHIFT_TYPE = {v: k for k, v in FRONTEND_TO_BACKEND_SHIFT_TYPE.items()}


def normalize_shift_type(shift_type: str) -> str:
    """
    Normalize a shift type from frontend format to backend format.
    If already in backend format, returns as-is.
    """
    if shift_type in FRONTEND_TO_BACKEND_SHIFT_TYPE:
        return FRONTEND_TO_BACKEND_SHIFT_TYPE[shift_type]
    return shift_type


def to_frontend_shift_type(shift_type: str) -> str:
    """
    Convert a backend shift type to frontend format.
    """
    if shift_type in BACKEND_TO_FRONTEND_SHIFT_TYPE:
        return BACKEND_TO_FRONTEND_SHIFT_TYPE[shift_type]
    return shift_type
