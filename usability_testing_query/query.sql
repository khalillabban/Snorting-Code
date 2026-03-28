# Task 1: Task Completion Analysis
WITH completions AS (
    SELECT (
            SELECT value.string_value
            FROM UNNEST(event_params)
            WHERE key = 'task_id'
        ) AS task_id,
        (
            SELECT value.string_value
            FROM UNNEST(event_params)
            WHERE key = 'session_id'
        ) AS session_id,
        (
            SELECT value.double_value
            FROM UNNEST(event_params)
            WHERE key = 'duration_ms'
        ) AS duration_ms
    FROM `soen-390-48ad2.analytics_529362025.events_*`
    WHERE event_name = 'task_completed'
        AND _TABLE_SUFFIX BETWEEN '20260101' AND '20261231'
)
SELECT task_id,
    COUNT(DISTINCT session_id) AS sessions_completed,
    ROUND(AVG(duration_ms) / 1000, 1) AS avg_duration_sec,
    ROUND(MIN(duration_ms) / 1000, 1) AS min_duration_sec,
    ROUND(MAX(duration_ms) / 1000, 1) AS max_duration_sec,
    ROUND(STDDEV(duration_ms) / 1000, 1) AS stddev_sec,
    ROUND(
        APPROX_QUANTILES(duration_ms, 100) [OFFSET(50)] / 1000,
        1
    ) AS median_duration_sec
FROM completions
WHERE task_id IS NOT NULL
    AND session_id IS NOT NULL
GROUP BY task_id
ORDER BY task_id;