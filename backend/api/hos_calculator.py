# C:\Users\user\Desktop\spotter\spotter_app\backend\api\hos_calculator.py

import math


class HOSCalculator:
    """
    Calculates driver Hours of Service (HOS) based on FMCSA regulations.
    """

    def __init__(self, current_cycle_hours):
        # All hours are in floating-point format
        self.current_driving_hours = 0.0
        self.current_on_duty_hours = 0.0
        self.current_off_duty_hours = 0.0
        self.current_cycle_hours = float(current_cycle_hours)
        self.daily_log = []
        self.is_rest_break_taken = False
        self.on_duty_since_last_break = 0.0

        # FMCSA Limits (Property-carrying)
        self.MAX_DRIVING_HOURS = 11.0
        self.MAX_ON_DUTY_HOURS = 14.0
        self.MAX_CYCLE_HOURS = 70.0
        self.REST_BREAK_REQUIRED_AFTER = 8.0
        self.REST_BREAK_MIN_DURATION = 0.5  # 30 minutes

    def add_driving_time(self, hours):
        """Adds driving time and updates all relevant counters."""
        driving_hours_left = self.MAX_DRIVING_HOURS - self.current_driving_hours
        on_duty_hours_left = self.MAX_ON_DUTY_HOURS - self.current_on_duty_hours
        cycle_hours_left = self.MAX_CYCLE_HOURS - self.current_cycle_hours

        hours_to_drive = min(
            hours, driving_hours_left, on_duty_hours_left, cycle_hours_left
        )

        if hours_to_drive > 0:
            self.current_driving_hours += hours_to_drive
            self.current_on_duty_hours += hours_to_drive
            self.current_cycle_hours += hours_to_drive
            self.on_duty_since_last_break += hours_to_drive
            self.daily_log.append(
                {"type": "Driving", "hours": round(hours_to_drive, 2)}
            )

        return hours - hours_to_drive

    def take_rest_break(self):
        """Adds a 30-minute rest break to the log."""
        if not self.is_rest_break_taken:
            self.daily_log.append(
                {"type": "Off Duty", "hours": self.REST_BREAK_MIN_DURATION}
            )
            self.is_rest_break_taken = True
            self.current_off_duty_hours += self.REST_BREAK_MIN_DURATION
            self.on_duty_since_last_break = 0.0
            return True
        return False

    def end_day_with_rest(self):
        """Fills the remaining time in a day with rest to reach 24 hours."""
        total_daily_hours = (
            self.current_driving_hours
            + self.current_on_duty_hours
            + self.current_off_duty_hours
        )
        remaining_hours = 24.0 - total_daily_hours

        if remaining_hours > 0:
            self.daily_log.append(
                {"type": "Sleeper Berth", "hours": round(remaining_hours, 2)}
            )
            return True
        return False

    def reset_for_new_day(self):
        """Resets daily counters for the next 24-hour period."""
        self.current_driving_hours = 0.0
        self.current_on_duty_hours = 0.0
        self.current_off_duty_hours = 0.0
        self.is_rest_break_taken = False
        self.on_duty_since_last_break = 0.0

    def get_log(self):
        """Returns the current daily log."""
        return self.daily_log

