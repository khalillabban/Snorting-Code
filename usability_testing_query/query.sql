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
-- Query 3: Task Completion Matrix 
SELECT session_id,
    MAX(IF(task_id = 'task_1', 1, NULL)) AS task_1,
    MAX(IF(task_id = 'task_2', 1, NULL)) AS task_2,
    MAX(IF(task_id = 'task_3', 1, NULL)) AS task_3,
    MAX(IF(task_id = 'task_4', 1, NULL)) AS task_4,
    MAX(IF(task_id = 'task_5', 1, NULL)) AS task_5,
    MAX(IF(task_id = 'task_6', 1, NULL)) AS task_6,
    MAX(IF(task_id = 'task_7', 1, NULL)) AS task_7,
    MAX(IF(task_id = 'task_8_next_class', 1, NULL)) AS task_8,
    MAX(IF(task_id = 'task_9', 1, NULL)) AS task_9,
    MAX(IF(task_id = 'task_10', 1, NULL)) AS task_10
FROM (
        SELECT (
                SELECT value.string_value
                FROM UNNEST(event_params)
                WHERE key = 'session_id'
            ) AS session_id,
            (
                SELECT value.string_value
                FROM UNNEST(event_params)
                WHERE key = 'task_id'
            ) AS task_id
        FROM `soen-390-48ad2.analytics_529362025.events_*`
        WHERE _TABLE_SUFFIX BETWEEN '20260101' AND '20261231'
            AND event_name = 'task_completed'
    )
WHERE session_id IS NOT NULL
GROUP BY session_id
ORDER BY session_id;
-- Task 2: Task Completion Rates and Durations (Deduplicated)
WITH task_rows AS (
    SELECT event_timestamp,
        MAX(
            IF(
                p.key = 'session_id',
                p.value.string_value,
                NULL
            )
        ) AS session_id,
        MAX(
            IF(
                p.key = 'task_id',
                p.value.string_value,
                NULL
            )
        ) AS task_id,
        COALESCE(
            MAX(
                IF(p.key = 'duration_ms', p.value.int_value, NULL)
            ),
            CAST(
                MAX(
                    IF(
                        p.key = 'duration_ms',
                        p.value.double_value,
                        NULL
                    )
                ) AS INT64
            )
        ) AS duration_ms
    FROM `soen-390-48ad2.analytics_529362025.event*`,
        UNNEST(event_params) AS p
    WHERE event_name = 'task_completed'
    GROUP BY event_timestamp
),
deduped AS (
    SELECT session_id,
        task_id,
        MIN(duration_ms) AS duration_ms
    FROM task_rows
    WHERE session_id IS NOT NULL
        AND task_id IS NOT NULL
        AND duration_ms > 500
    GROUP BY session_id,
        task_id
),
total_sessions AS (
    SELECT COUNT(DISTINCT session_id) AS n
    FROM deduped
)
SELECT task_id,
    COUNT(DISTINCT session_id) AS sessions_completed,
    (
        SELECT n
        FROM total_sessions
    ) AS total_sessions,
    ROUND(
        COUNT(DISTINCT session_id) * 100.0 / (
            SELECT n
            FROM total_sessions
        ),
        1
    ) AS completion_rate_pct,
    ROUND(AVG(duration_ms) / 1000.0, 1) AS avg_sec,
    ROUND(MIN(duration_ms) / 1000.0, 1) AS min_sec,
    ROUND(MAX(duration_ms) / 1000.0, 1) AS max_sec,
    ROUND(
        APPROX_QUANTILES(duration_ms, 100) [OFFSET(50)] / 1000.0,
        1
    ) AS median_sec
FROM deduped
GROUP BY task_id
ORDER BY task_id;
--Task 3: Navigation attempts and error
WITH events_flat AS (
    SELECT event_name,
        MAX(
            IF(p.key = 'session_id', p.value.string_value, NULL)
        ) AS session_id
    FROM `soen-390-48ad2.analytics_529362025.event*`,
        UNNEST(event_params) AS p
    WHERE event_name IN (
            'nav_bar_opened',
            'route_generated',
            'route_generation_abandoned',
            'indoor_nav_attempted',
            'indoor_route_generated',
            'indoor_route_failed',
            'indoor_outdoor_route_requested',
            'indoor_outdoor_task_completed',
            'indoor_poi_category_toggled'
        )
    GROUP BY event_name,
        event_timestamp
)
SELECT session_id,
    COUNTIF(event_name = 'nav_bar_opened') AS nav_bar_opens,
    COUNTIF(event_name = 'route_generated') AS outdoor_routes_generated,
    COUNTIF(event_name = 'route_generation_abandoned') AS route_abandoned,
    COUNTIF(event_name = 'indoor_nav_attempted') AS indoor_attempts,
    COUNTIF(event_name = 'indoor_route_generated') AS indoor_routes_success,
    COUNTIF(event_name = 'indoor_route_failed') AS indoor_routes_failed,
    COUNTIF(event_name = 'indoor_outdoor_route_requested') AS cross_building_requested,
    COUNTIF(event_name = 'indoor_outdoor_task_completed') AS cross_building_completed,
    COUNTIF(event_name = 'indoor_poi_category_toggled') AS poi_toggles
FROM events_flat
WHERE session_id IS NOT NULL
GROUP BY session_id
ORDER BY session_id;