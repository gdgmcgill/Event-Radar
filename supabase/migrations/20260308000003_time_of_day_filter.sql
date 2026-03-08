-- Function to filter events by time of day
CREATE OR REPLACE FUNCTION public.get_event_ids_by_time_filter(
  time_of_day TEXT DEFAULT NULL,
  day_type TEXT DEFAULT NULL
)
RETURNS TABLE(event_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id AS event_id
  FROM public.events e
  WHERE
    (time_of_day IS NULL OR
      CASE time_of_day
        WHEN 'morning' THEN EXTRACT(HOUR FROM e.start_date) >= 6 AND EXTRACT(HOUR FROM e.start_date) < 12
        WHEN 'afternoon' THEN EXTRACT(HOUR FROM e.start_date) >= 12 AND EXTRACT(HOUR FROM e.start_date) < 17
        WHEN 'evening' THEN EXTRACT(HOUR FROM e.start_date) >= 17 AND EXTRACT(HOUR FROM e.start_date) < 22
        WHEN 'night' THEN EXTRACT(HOUR FROM e.start_date) >= 22 OR EXTRACT(HOUR FROM e.start_date) < 6
        ELSE TRUE
      END)
    AND
    (day_type IS NULL OR
      CASE day_type
        WHEN 'weekday' THEN EXTRACT(DOW FROM e.start_date) BETWEEN 1 AND 5
        WHEN 'weekend' THEN EXTRACT(DOW FROM e.start_date) IN (0, 6)
        ELSE TRUE
      END);
END;
$$ LANGUAGE plpgsql STABLE;
