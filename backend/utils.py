from datetime import datetime, timezone, timedelta

# Define Colombia Timezone (UTC-5)
COLOMBIA_TZ = timezone(timedelta(hours=-5))

def get_now_colombia() -> datetime:
    """Returns current time in Colombia timezone"""
    return datetime.now(COLOMBIA_TZ)

def to_colombia_time(dt: datetime) -> datetime:
    """Converts a datetime to Colombia timezone"""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=COLOMBIA_TZ)
    return dt.astimezone(COLOMBIA_TZ)
