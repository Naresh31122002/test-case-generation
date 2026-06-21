"""
story_intelligence_model.py

Story Intelligence panel: aggregates data that already exists from other
pipelines (quality analysis, impact analyzer) into the response shape the
drawer's AI Insights section needs. No new LLM pipeline is introduced here —
this module only reads/aggregates rows already written by
app.LLM.impact_analyzer and the existing quality-analysis cache.
"""

from app.config import Config


RISK_RANK = {'high': 3, 'medium': 2, 'low': 1}


def aggregate_risk_level(risk_areas: list) -> str:
    """Roll up the existing risk_areas (from quality analysis) into a single
    Low/Medium/High level. No new LLM call — pure aggregation of severities
    the quality prompt already returns."""
    if not risk_areas:
        return 'Low'
    worst = max(
        (RISK_RANK.get(str(r.get('severity', '')).lower(), 1) for r in risk_areas),
        default=1,
    )
    return {3: 'High', 2: 'Medium', 1: 'Low'}[worst]


class StoryIntelligenceModel:
    @staticmethod
    def get_impact_summary(workspace_id: str, story_id: str) -> dict:
        """Impacted stories / modules / test cases for this story, derived purely
        from the existing test_case_impacts table written by the impact analyzer.
        No new analysis is run here — this is a read-only aggregation."""
        conn = Config.get_postgres_connection()
        try:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT DISTINCT
                    tci.new_story_id,
                    tci.original_test_case_id,
                    tci.impact_severity
                FROM test_case_impacts tci
                WHERE tci.workspace_id = %s
                  AND tci.original_story_id = %s
                  AND tci.impact_status = 'active'
                """,
                (workspace_id, story_id),
            )
            rows = cursor.fetchall()
            if not rows:
                return {'impacted_stories': [], 'impacted_modules': [], 'impacted_test_cases': []}

            impacted_story_ids = sorted({r[0] for r in rows})
            impacted_test_case_ids = sorted({r[1] for r in rows})

            # Resolve each impacted test case's existing "module" (the `group`
            # label already assigned by Test_case_generator.py at generation
            # time) by looking up the original test_cases.test_case_json.
            cursor.execute(
                """
                SELECT DISTINCT tc_elem->>'group' AS module
                FROM test_cases tc,
                     jsonb_array_elements(tc.test_case_json->'test_cases') AS tc_elem
                WHERE tc.workspace_id = %s
                  AND tc.story_id = %s
                  AND (tc_elem->>'id') = ANY(%s)
                """,
                (workspace_id, story_id, impacted_test_case_ids),
            )
            impacted_modules = sorted({r[0] for r in cursor.fetchall() if r[0]})

            return {
                'impacted_stories': impacted_story_ids,
                'impacted_modules': impacted_modules,
                'impacted_test_cases': impacted_test_case_ids,
            }
        finally:
            cursor.close()
            conn.close()
