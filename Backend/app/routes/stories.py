# Standard library imports
from datetime import datetime
import json
import uuid
import math
import os
import functools

# Third-party imports
from flask import Blueprint, jsonify, request, send_file, Response
from flask_jwt_extended import jwt_required, get_jwt_identity
import psycopg2.extras
import lancedb
from dateutil import parser

# Local application imports
from app.config import Config
from app.models.db_service import get_db_service
from app.LLM.impact_analyzer import analyze_test_case_impacts
from app.utils.excel_util import generate_excel
from app.LLM.Test_case_generator import Chat_RAG
# Multi-tenancy: workspace resolution + scoping helpers (replaces the old inline
# dev_jwt_required / get_current_user_id). `workspace_required` sets g.user_id and
# g.workspace_id, honoring DEV_BYPASS_AUTH.
from app.utils.limiter import limiter
from app.utils.workspace import (
    workspace_required,
    get_current_user_id,
    get_current_workspace_id,
    require_workspace_role,
)
from app.models.story_collaboration_model import StoryAssigneesModel, StoryActivityModel, StoryCommentsModel
from app.models.test_case_collaboration_model import (
    TestCaseAssigneesModel,
    TestCaseActivityModel,
    TestCaseCommentsModel,
)
stories_bp = Blueprint('stories', __name__)


def _workspace_has_own_key(workspace_id: str) -> bool:
    """Returns True if the workspace has its own AI API key stored.
    When True, callers should skip credit deduction."""
    if not workspace_id:
        return False
    try:
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT 1 FROM workspace_integrations "
                    "WHERE workspace_id = %s AND integration_type = 'ai_api_key' "
                    "AND secret_enc IS NOT NULL AND secret_enc != ''",
                    (workspace_id,)
                )
                return cur.fetchone() is not None
    except Exception:
        return False


_JSON_VALID_ESCAPE_NEXT = set('"\\/bfnrtu')


def _fix_invalid_json_escapes(s: str) -> str:
    """
    Double any backslash that is not the start of a valid JSON escape sequence
    (\\" \\\\ \\/ \\b \\f \\n \\r \\t \\uXXXX). LLMs frequently emit a lone
    backslash inside a string — e.g. a Windows path like C:\\data or a regex —
    which json.loads rejects with "Invalid \\escape". Valid escapes are left
    untouched so \\n / \\t / \\uXXXX still decode correctly.
    """
    out = []
    i, n = 0, len(s)
    while i < n:
        ch = s[i]
        if ch == '\\':
            nxt = s[i + 1] if i + 1 < n else ''
            if nxt in _JSON_VALID_ESCAPE_NEXT:
                out.append(ch)
                out.append(nxt)
                i += 2
                continue
            out.append('\\\\')
            i += 1
            continue
        out.append(ch)
        i += 1
    return ''.join(out)


def _robust_json_loads(raw: str):
    """
    Parse JSON returned by an LLM, tolerating the two failure modes seen most
    often in production logs for the quality-analysis prompts:

      - "Invalid \\escape": a lone backslash inside a string (Windows path / regex).
      - "Expecting ',' delimiter": trailing commas before } or ].

    Try a straight json.loads first (fast path, no mutation). On failure, isolate
    the outermost {...}, fix invalid escapes, strip trailing commas, then retry.
    Re-raise the original error if it still cannot be parsed so the caller can
    surface a real failure rather than silently degrade.
    """
    import re as _re
    try:
        return json.loads(raw)
    except json.JSONDecodeError as first_err:
        text = raw
        start, end = text.find('{'), text.rfind('}') + 1
        if start != -1 and end > start:
            text = text[start:end]
        text = _fix_invalid_json_escapes(text)
        text = _re.sub(r',\s*([}\]])', r'\1', text)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            raise first_err


# Backwards-compatible alias: existing routes are decorated with @dev_jwt_required.
# It now resolves the workspace too, so every route is tenant-scoped.
dev_jwt_required = workspace_required
# ─────────────────────────────────────────────────────────────────────────────

def _check_permission(permission: str):
    """
    Check workspace permission for the current user.
    Returns (True, None) if allowed, (False, response) if denied.

    Permissions: can_create_stories, can_generate_tests, can_edit_tests,
                 can_delete_stories, can_manage_members
    viewer role = read-only (can still record test runs)
    """
    from flask import g
    role = getattr(g, 'workspace_role', None)
    if not role:
        return False, (jsonify({'error': 'Not authorized'}), 403)

    # Role-based permission matrix
    ROLE_PERMISSIONS = {
        'owner':  {'can_create_stories', 'can_generate_tests', 'can_edit_tests', 'can_delete_stories', 'can_manage_members'},
        'admin':  {'can_create_stories', 'can_generate_tests', 'can_edit_tests', 'can_delete_stories', 'can_manage_members'},
        'editor': {'can_create_stories', 'can_generate_tests', 'can_edit_tests'},
        'viewer': set(),
    }

    allowed = permission in ROLE_PERMISSIONS.get(role, set())
    if not allowed:
        return False, (jsonify({'error': f'Your role ({role}) does not have permission: {permission}'}), 403)
    return True, None


def serialize_datetime(obj):
    """Helper function to serialize datetime objects"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)

@stories_bp.route('/', methods=['GET'])
@dev_jwt_required
@limiter.limit("30 per minute")
def get_stories():
    """Get all stories with pagination and sorting"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        sort_order = request.args.get('sort_order', 'desc')
        project_id = request.args.get('project_id')

        # Sprint 1 Phase 3: optional server-side filters. All are additive - when a
        # filter is absent the query behaves exactly as before. Repeatable params
        # (?status=in_review&status=completed) are read with getlist.
        f_status = [s for s in request.args.getlist('status') if s in ('in_review', 'in_progress', 'completed')]
        f_impact = request.args.get('impact')  # 'detected' | 'none'
        f_assignee = request.args.get('assignee')  # user_id | 'me' | 'unassigned'
        f_priority = [p for p in request.args.getlist('priority') if p in ('High', 'Medium', 'Low')]
        f_search = (request.args.get('q') or '').strip()[:200]  # full-text search on story_description

        # Validate sort_order
        if sort_order not in ['asc', 'desc']:
            return jsonify({'error': 'Invalid sort_order. Must be "asc" or "desc"'}), 400

        # Get stories from PostgreSQL scoped to this user
        query = """
            SELECT
                story_id as id,
                story_description as description,
                project_id,
                test_case_json,
                test_case_generated,
                created_on as test_case_created_time,
                source,
                COALESCE(impacted_test_cases_count, 0) as impacted_test_cases_count,
                COALESCE(jsonb_array_length(test_case_json->'test_cases'), 0) as test_case_count,
                inputs->>'content' as document_content,
                inputs->>'file_content' as file_content,
                COALESCE(story_status, 'in_review') as story_status
            FROM test_cases
            WHERE test_case_generated = TRUE
            AND workspace_id = %s
        """
        params = [workspace_id]

        # Build the shared, additive filter clause (used by both the page query and
        # the count query so totals stay consistent with the filtered results).
        filter_sql = ""
        filter_params = []
        if project_id:
            filter_sql += " AND project_id = %s"
            filter_params.append(project_id)
        if f_status:
            filter_sql += " AND COALESCE(story_status, 'in_review') = ANY(%s)"
            filter_params.append(f_status)
        if f_impact == 'detected':
            filter_sql += " AND COALESCE(impacted_test_cases_count, 0) > 0"
        elif f_impact == 'none':
            filter_sql += " AND COALESCE(impacted_test_cases_count, 0) = 0"
        if f_priority:
            # Story matches if it contains at least one test case of the priority.
            filter_sql += """ AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(COALESCE(test_case_json->'test_cases', '[]'::jsonb)) tc
                WHERE tc->>'priority' = ANY(%s)
            )"""
            filter_params.append(f_priority)
        if f_assignee:
            if f_assignee == 'unassigned':
                filter_sql += """ AND NOT EXISTS (
                    SELECT 1 FROM story_assignees sa
                    WHERE sa.workspace_id = test_cases.workspace_id AND sa.story_id = test_cases.story_id
                )"""
            else:
                target = user_id if f_assignee == 'me' else f_assignee
                filter_sql += """ AND EXISTS (
                    SELECT 1 FROM story_assignees sa
                    WHERE sa.workspace_id = test_cases.workspace_id AND sa.story_id = test_cases.story_id
                    AND sa.user_id = %s
                )"""
                filter_params.append(target)
        if f_search:
            filter_sql += """ AND (
                story_description ILIKE %s
                OR story_id ILIKE %s
            )"""
            like = f"%{f_search}%"
            filter_params.extend([like, like])

        query += filter_sql
        params.extend(filter_params)

        # Add sorting
        query += f" ORDER BY created_on {sort_order}"

        # Add pagination
        query += " LIMIT %s OFFSET %s"
        params.extend([per_page, (page - 1) * per_page])

        # Get embedding timestamps and doc_content_text from LanceDB
        db = lancedb.connect(Config.LANCE_DB_PATH)
        table = db.open_table(Config.TABLE_NAME_LANCE)
        lance_data = table.to_pandas()
        # Filter LanceDB data to this workspace
        if 'workspace_id' in lance_data.columns:
            lance_data = lance_data[lance_data['workspace_id'] == workspace_id]
        embedding_timestamps = dict(zip(lance_data['storyID'], lance_data['embedding_timestamp']))
        doc_content_texts = dict(zip(lance_data['storyID'], lance_data['doc_content_text']))

        # Execute query
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                cursor.execute(query, params)
                stories = cursor.fetchall()

                # Get total count for pagination
                count_query = """
                    SELECT COUNT(*)
                    FROM test_cases
                    WHERE test_case_generated = TRUE
                    AND workspace_id = %s
                """
                count_params = [workspace_id]
                count_query += filter_sql
                count_params.extend(filter_params)

                cursor.execute(count_query, count_params)
                total = cursor.fetchone()[0]

                # Process results
                result = {
                    'stories': [],
                    'pagination': {
                        'total': total,
                        'page': page,
                        'per_page': per_page,
                        'total_pages': math.ceil(total / per_page)
                    }
                }

                # Format each story
                for story in stories:
                    story_dict = dict(story)

                    # Add download link
                    story_dict['download_link'] = f"/api/stories/download/{story_dict['id']}"

                    # Parse source info
                    source = story_dict.get('source', 'backend')
                    if isinstance(source, str):
                        try:
                            source = json.loads(source)
                        except (json.JSONDecodeError, ValueError):
                            source = {'story': source, 'test_cases': source}
                    story_dict['source'] = source

                    # Add embedding timestamp from LanceDB
                    story_dict['embedding_timestamp'] = embedding_timestamps.get(story_dict['id'])
                    if story_dict['embedding_timestamp'] and hasattr(story_dict['embedding_timestamp'], 'isoformat'):
                        story_dict['embedding_timestamp'] = story_dict['embedding_timestamp'].isoformat()

                    # Format test case creation time
                    if story_dict.get('test_case_created_time'):
                        story_dict['test_case_created_time'] = story_dict['test_case_created_time'].isoformat()

                    # Get document content from LanceDB's doc_content_text
                    story_dict['doc_content_text'] = doc_content_texts.get(story_dict['id'])

                    def _get_impact_count(d):
                        for key in ('impactedtestcases', 'impactedTestCases', 'impacted_test_cases_count'):
                            val = d.pop(key, None) if key in d else None
                            if val is not None:
                                return int(val)
                        return 0
                    story_dict['impactedTestCases'] = _get_impact_count(story_dict)

                    result['stories'].append(story_dict)

                return jsonify(result), 200

    except Exception as e:
        print(f"❌ Error fetching stories: {e}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/<story_id>', methods=['GET'])
@dev_jwt_required
def get_story(story_id):
    """Get a specific story"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        print("DEBUG:get_story: Request received", {'story_id': story_id})
        if not story_id:
            return jsonify({'error': 'Story ID is required'}), 400

        db_service = get_db_service()
        print("DEBUG:get_story: Fetching story from db_service")
        story = db_service.get_story(story_id, user_id=user_id, workspace_id=workspace_id)

        if story:
            print("DEBUG:get_story: Story found", {'story_id': story_id})
            return jsonify(story)
        print("DEBUG:get_story: Story not found", {'story_id': story_id})
        return jsonify({'error': f'Story not found: {story_id}'}), 404
    except Exception as e:
        print(f"Error getting story {story_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/<story_id>', methods=['DELETE'])
@dev_jwt_required
def delete_story(story_id):
    """Delete a story and all of its data (test cases, impacts, vector) from
    both PostgreSQL and LanceDB. Strictly scoped to the current workspace so a
    user can never delete another tenant's story.

    PostgreSQL: deleting the test_cases row cascades to test_case_impacts,
    impact_history and story_versions via their ON DELETE CASCADE foreign keys.
    LanceDB: the matching vector row is removed with a workspace-scoped filter.
    """
    try:
        workspace_id = get_current_workspace_id()
        ok, err = _check_permission('can_delete_stories')
        if not ok: return err
        if not story_id:
            return jsonify({'error': 'Story ID is required'}), 400
        if not workspace_id:
            return jsonify({'error': 'No active workspace'}), 403

        # 1. Delete from PostgreSQL (workspace-scoped). RETURNING tells us whether
        #    a row actually belonged to this workspace.
        deleted_pg = False
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                # Step 1a: Find stories whose test cases were impacted BY this story
                # so we can recalculate their impact counts after deletion.
                cur.execute("""
                    SELECT DISTINCT original_story_id FROM test_case_impacts
                    WHERE new_story_id = %s AND workspace_id = %s
                """, (story_id, workspace_id))
                affected_story_ids = [r[0] for r in cur.fetchall()]

                # Step 1b: Delete impacts where this story was the trigger (new_story_id)
                # These are NOT cascade-deleted because they reference a different story's run_id
                cur.execute("""
                    DELETE FROM test_case_impacts
                    WHERE new_story_id = %s AND workspace_id = %s
                """, (story_id, workspace_id))

                # Step 1c: Recalculate impact counts for stories that were affected by this story
                for affected_id in affected_story_ids:
                    cur.execute("""
                        UPDATE test_cases
                        SET impacted_test_cases_count = (
                            SELECT COUNT(DISTINCT original_test_case_id)
                            FROM test_case_impacts
                            WHERE original_story_id = %s
                            AND workspace_id = %s
                            AND impact_status = 'active'
                        ),
                        has_impacts = (
                            SELECT COUNT(DISTINCT original_test_case_id) > 0
                            FROM test_case_impacts
                            WHERE original_story_id = %s
                            AND workspace_id = %s
                            AND impact_status = 'active'
                        )
                        WHERE story_id = %s AND workspace_id = %s
                    """, (affected_id, workspace_id, affected_id, workspace_id, affected_id, workspace_id))

                # Step 1d: Delete the story itself (cascades to test_case_impacts where original_run_id matches)
                cur.execute(
                    "DELETE FROM test_cases WHERE story_id = %s AND workspace_id = %s RETURNING story_id",
                    (story_id, workspace_id),
                )
                deleted_pg = cur.fetchone() is not None
                conn.commit()

        if affected_story_ids:
            print(f"[delete_story] Recalculated impact counts for {len(affected_story_ids)} affected stories")

        # 2. Delete the vector row from LanceDB (workspace-scoped). Best-effort -
        #    a missing/empty table shouldn't fail the whole delete.
        try:
            db_service = get_db_service()
            table = db_service.lance_db.open_table(Config.TABLE_NAME_LANCE)
            # Escape single quotes in identifiers for the SQL-style filter.
            safe_story = str(story_id).replace("'", "''")
            safe_ws = str(workspace_id).replace("'", "''")
            table.delete(f"storyID = '{safe_story}' AND workspace_id = '{safe_ws}'")
        except Exception as lance_err:
            print(f"Warning: LanceDB delete failed for {story_id}: {lance_err}")

        if not deleted_pg:
            # Nothing in Postgres for this workspace - either it never existed
            # here or belonged to another tenant. Treat as not found.
            return jsonify({'error': f'Story not found: {story_id}'}), 404

        return jsonify({'message': 'Story deleted', 'story_id': story_id}), 200
    except Exception as e:
        print(f"Error deleting story {story_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/search', methods=['POST'])
@dev_jwt_required
def search_stories():
    """Search for similar stories"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json()
        print("DEBUG:search_stories: Request received", {'data': data})
        if not data or 'query' not in data:
            return jsonify({'error': 'Query is required'}), 400

        query = data['query']
        limit = data.get('limit', 5)

        if not query.strip():
            return jsonify({'error': 'Query cannot be empty'}), 400

        if limit < 1:
            limit = 5

        db_service = get_db_service()
        print("DEBUG:search_stories: Calling db_service.search_similar_stories", {
            'query': query,
            'limit': limit
        })
        results = db_service.search_similar_stories(query, limit, user_id=user_id, workspace_id=workspace_id)
        print("DEBUG:search_stories: Returning results", {
            'results_count': len(results) if isinstance(results, list) else 'n/a'
        })
        return jsonify(results)
    except Exception as e:
        print(f"Error searching stories: {str(e)}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/testcases/download/<story_id>', methods=['GET'])
@dev_jwt_required
def download_test_cases(story_id):
    """Download test cases for a story as Excel file"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        print("DEBUG:download_test_cases: Request received", {'story_id': story_id})
        db_service = get_db_service()

        # Get story details from LanceDB (scoped to workspace)
        print("DEBUG:download_test_cases: Fetching story details from db_service")
        story = db_service.get_story(story_id, user_id=user_id, workspace_id=workspace_id)
        if not story:
            return jsonify({
                'error': f'Story not found with ID: {story_id}'
            }), 404

        # Get test cases from PostgreSQL scoped to user
        print("DEBUG:download_test_cases: Querying Postgres for test_case_json")
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT test_case_json, story_description
                    FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                """, (story_id, workspace_id))
                result = cursor.fetchone()

                if not result:
                    print("DEBUG:download_test_cases: No test case row found", {'story_id': story_id})
                    return jsonify({
                        'error': f'No test cases found for story ID: {story_id}'
                    }), 404

                # Parse the test cases JSON if it's a string
                test_case_json = result[0]
                print("DEBUG:download_test_cases: Raw test_case_json type", {
                    'type': str(type(test_case_json))
                })
                if isinstance(test_case_json, str):
                    try:
                        test_case_json = json.loads(test_case_json)
                        print("DEBUG:download_test_cases: Parsed test_case_json keys", {
                            'keys': list(test_case_json.keys())
                        })
                    except json.JSONDecodeError as e:
                        print(f"Error parsing test cases JSON: {str(e)}")
                        return jsonify({
                            'error': 'Invalid test cases data format'
                        }), 500

                # Prepare data for Excel generation
                test_case_json = {
                    'storyID': story_id,
                    'storyDescription': result[1],
                    'testcases': test_case_json.get('test_cases', [])
                }
                print("DEBUG:download_test_cases: Prepared test_case_json for Excel", {
                    'storyID': story_id,
                    'testcases_count': len(test_case_json['testcases'])
                })

                # Generate Excel file
                try:
                    print("DEBUG:download_test_cases: Calling generate_excel")
                    excel_file = generate_excel(test_case_json)
                    print("DEBUG:download_test_cases: Excel generation successful, sending file")
                    return send_file(
                        excel_file,
                        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        as_attachment=True,
                        download_name=f'test_cases_{story_id}.xlsx'
                    )
                except Exception as e:
                    print(f"Error generating Excel file: {str(e)}")
                    return jsonify({
                        'error': 'Failed to generate Excel file',
                        'details': str(e)
                    }), 500

    except Exception as e:
        print(f"Error in download_test_cases: {str(e)}")
        return jsonify({
            'error': 'Failed to download test cases',
            'details': str(e)
        }), 500

@stories_bp.route('/<story_id>/testcases', methods=['GET'])
@dev_jwt_required
def get_story_testcases(story_id):
    """Get test cases for a specific story"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        print(f"DEBUG:get_story_testcases: Request received for story {story_id}")
        db_service = get_db_service()

        # Sprint 1 Phase 3: optional server-side filters (additive; absent = no-op).
        f_priority = [p for p in request.args.getlist('priority') if p in ('High', 'Medium', 'Low')]
        f_status = [s for s in request.args.getlist('status') if s in ('Approved', 'Pending', 'Rejected')]
        f_automation = request.args.get('automation_ready')  # 'true' | 'false'
        f_impacted = request.args.get('impacted')  # 'true' | 'false'

        # Get test cases from PostgreSQL scoped to workspace
        print("DEBUG:get_story_testcases: Querying Postgres for test_case_json")
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT test_case_json, story_description, project_id
                    FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                """, (story_id, workspace_id))
                result = cur.fetchone()

                print("DEBUG:get_story_testcases: Raw DB result exists?", {
                    'has_result': bool(result),
                    'story_id': story_id
                })

                if result and result[0]:
                    print("DEBUG:get_story_testcases: Raw database result", result)
                    # Parse the test cases JSON if it's a string
                    test_case_json = result[0]
                    print("DEBUG:get_story_testcases: test_case_json type before parse", {
                        'type': str(type(test_case_json))
                    })
                    if isinstance(test_case_json, str):
                        try:
                            test_case_json = json.loads(test_case_json)
                            print("DEBUG:get_story_testcases: Parsed JSON from string", {
                                'keys': list(test_case_json.keys())
                            })
                        except json.JSONDecodeError as e:
                            print(f"Error parsing test cases JSON: {str(e)}")
                            return jsonify({
                                'error': 'Invalid test cases data format',
                                'details': str(e)
                            }), 500

                    print("DEBUG:get_story_testcases: Raw test case JSON object", test_case_json)

                    # Prepare data in the same format as the download endpoint
                    testcases_list = test_case_json.get('test_cases', [])

                    # Sprint 1 Phase 3: apply optional server-side filters over the
                    # JSON test-case array. "Impacted" is resolved from
                    # test_case_impacts (workspace-scoped); "Automation Ready" reads
                    # the per-test-case automation_ready flag (default false).
                    if f_priority or f_status or f_automation or f_impacted:
                        impacted_ids = set()
                        if f_impacted:
                            with conn.cursor() as icur:
                                icur.execute("""
                                    SELECT original_test_case_id FROM test_case_impacts
                                    WHERE workspace_id = %s AND original_story_id = %s
                                    UNION
                                    SELECT modified_test_case_id FROM test_case_impacts
                                    WHERE workspace_id = %s AND new_story_id = %s
                                """, (workspace_id, story_id, workspace_id, story_id))
                                impacted_ids = {r[0] for r in icur.fetchall() if r[0]}

                        def _keep(tc):
                            if f_priority and tc.get('priority') not in f_priority:
                                return False
                            if f_status and tc.get('status', 'Pending') not in f_status:
                                return False
                            if f_automation:
                                want = f_automation == 'true'
                                if bool(tc.get('automation_ready', False)) != want:
                                    return False
                            if f_impacted:
                                is_imp = tc.get('id') in impacted_ids
                                if is_imp != (f_impacted == 'true'):
                                    return False
                            return True

                        testcases_list = [tc for tc in testcases_list if _keep(tc)]

                    response_data = {
                        'storyID': story_id,
                        'storyDescription': result[1],
                        'project_id': result[2],
                        'testcases': testcases_list
                    }

                    print("DEBUG:get_story_testcases: Processed response data meta", {
                        'storyID': response_data['storyID'],
                        'project_id': response_data['project_id'],
                        'testcases_count': len(testcases_list)
                    })

                    return jsonify(response_data)

                print(f"DEBUG:get_story_testcases: No test cases found for story {story_id}")
                return jsonify({
                    'storyID': story_id,
                    'storyDescription': None,
                    'project_id': None,
                    'testcases': []
                })

    except Exception as e:
        print(f"Error getting test cases for story {story_id}: {str(e)}")
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@stories_bp.route('/next-reload', methods=['GET'])
@dev_jwt_required
def get_next_reload():
    try:
        import os
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        next_reload_file = os.path.join(base_dir, 'next_reload.txt')

        if os.path.exists(next_reload_file):
            with open(next_reload_file, 'r') as f:
                content = f.read().strip()
                return jsonify({
                    'next_reload': content,
                    'source': 'file'
                }), 200
        else:
            from datetime import datetime, timedelta
            next_time = datetime.now() + timedelta(minutes=5)
            return jsonify({
                'next_reload': next_time.isoformat(),
                'source': 'fallback'
            }), 200
    except Exception as e:
        print(f"Error reading next reload time: {str(e)}")
        from datetime import datetime, timedelta
        next_time = datetime.now() + timedelta(minutes=5)
        return jsonify({
            'error': 'Failed to read next reload time',
            'details': str(e),
            'fallback_next_reload': next_time.isoformat()
        }), 500

@stories_bp.route('/trigger-reload', methods=['POST'])
@dev_jwt_required
def trigger_reload():
    """Trigger the scheduler to run immediately"""
    try:
        from scheduler import scheduled_job
        scheduled_job()
        return jsonify({'message': 'Scheduler triggered successfully'}), 200
    except Exception as e:
        print(f"Error triggering scheduler: {str(e)}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/improve-story', methods=['POST'])
@dev_jwt_required
def improve_story():
    """
    LLM-powered story improvement.
    Takes the current story text + user instructions and returns an improved version.
    Used by the 'Improve Story First' button in the Create Story wizard.
    """
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        ok, err = _check_permission('can_edit_tests')
        if not ok: return err
        data = request.get_json() or {}
        story_content = (data.get('story_content') or '').strip()
        instructions = (data.get('instructions') or '').strip()
        if instructions:
            instructions = instructions[:500]
            import re as _re
            instructions = _re.sub(r'(?i)(ignore (all |previous |above |prior )?instructions?|system prompt|you are now|forget everything|disregard)', '[removed]', instructions)

        if not story_content:
            return jsonify({'error': 'story_content is required'}), 400

        if not _workspace_has_own_key(workspace_id):
            try:
                from app.models.credits_model import CreditsModel, OutOfCreditsException
                CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="improve_story")
            except OutOfCreditsException as e:
                return jsonify({'error': str(e)}), 402
            except Exception:
                pass  # non-fatal

        use_analysis = data.get('use_analysis', False)
        analysis_data = data.get('analysis_data') or {}

        if use_analysis and analysis_data:
            issues = analysis_data.get('issues', [])
            recommendations = analysis_data.get('recommendations', [])
            missing_scenarios = analysis_data.get('missing_scenarios', []) or []
            missing_validations = analysis_data.get('missing_validations', []) or []
            missing_security = analysis_data.get('missing_security_requirements', []) or []
            risk_areas = analysis_data.get('risk_areas', []) or []

            completeness = analysis_data.get('completeness', 0)
            clarity = analysis_data.get('clarity', 0)
            testability = analysis_data.get('testability', 0)

            analysis_context = f"\nScores: Completeness={completeness}/100, Clarity={clarity}/100, Testability={testability}/100\n"

            if issues:
                analysis_context += "\n=== QUALITY ISSUES TO FIX ===\n" + "\n".join(
                    f"[{i.get('severity','?')}] {i.get('title','')}: {i.get('description','')}" for i in issues[:8]
                )
            if risk_areas:
                analysis_context += "\n\n=== RISK AREAS ===\n" + "\n".join(
                    f"[{r.get('severity','?')}] {r.get('area','')}: {r.get('description','')}" for r in risk_areas[:5]
                )
            if missing_scenarios:
                analysis_context += "\n\n=== MISSING SCENARIOS TO ADD ===\n" + "\n".join(
                    f"- {m}" for m in missing_scenarios[:8]
                )
            if missing_validations:
                analysis_context += "\n\n=== MISSING VALIDATIONS TO ADD ===\n" + "\n".join(
                    f"- {m}" for m in missing_validations[:8]
                )
            if missing_security:
                analysis_context += "\n\n=== MISSING SECURITY REQUIREMENTS ===\n" + "\n".join(
                    f"- {m}" for m in missing_security[:5]
                )
            if recommendations:
                analysis_context += "\n\n=== RECOMMENDATIONS ===\n" + "\n".join(
                    f"- {r}" for r in recommendations[:6]
                )

            prompt = f"""You are an expert QA-focused business analyst. Your task is to rewrite this user story so that when it is processed by TestSurge (an AI test case generator), it produces comprehensive, high-quality test cases.

ORIGINAL STORY:
{story_content}

QUALITY ANALYSIS FINDINGS (generated by TestSurge's AI analyzer):
{analysis_context}

{"USER ADDITIONAL INSTRUCTIONS: " + instructions if instructions else ""}

REWRITE INSTRUCTIONS:
1. Fix EVERY quality issue listed above - address each one specifically
2. Add EVERY missing scenario as a concrete acceptance criterion
3. Add EVERY missing validation with exact values (field name, type, format, min/max)
4. Add EVERY missing security requirement
5. Format acceptance criteria as: "Given [context], When [action], Then [specific verifiable outcome]"
6. Replace ALL vague words (appropriate, correct, proper, valid, reasonable) with exact specifications
7. Add specific HTTP status codes for all API operations
8. Add specific error messages for all error conditions
9. Keep the same general structure and intent - only improve, never change the core requirement
10. The result must be self-contained - a QA engineer should be able to write tests without asking any questions

Return ONLY the improved story text. No explanation, no commentary, no markdown headers."""

        else:
            prompt = f"""You are a senior business analyst and QA expert. Improve the following user story to make it clearer, more complete, and more testable.

ORIGINAL STORY:
{story_content}

{"USER INSTRUCTIONS: " + instructions if instructions else "Improve clarity, completeness, and testability. Add missing acceptance criteria if needed."}

Return ONLY the improved story text, no explanation or commentary. Keep the same format as the original but improve it."""

        response = Config.llm.invoke(prompt)
        return jsonify({'improved_story': response.content.strip()}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/analyze-content', methods=['POST'])
@dev_jwt_required
def analyze_story_content():
    """
    Analyze raw story content for quality before it is uploaded/saved.
    Used by Create Story step 3 to show real quality scores instead of mock data.
    """
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json() or {}
        story_content = (data.get('content') or '').strip()
        if not story_content or len(story_content) < 30:
            return jsonify({'error': 'Story content too short for analysis'}), 422

        try:
            from app.models.credits_model import CreditsModel, OutOfCreditsException
            CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="analyze_story")
        except Exception:
            pass  # non-fatal

        # Same TestSurge-specific prompt as _compute_or_get_quality
        prompt = f"""You are an expert QA Architect reviewing a user story that will be fed into TestSurge - an AI-powered test case generation system. Your analysis directly determines how many and how good the generated test cases will be.

USER STORY:
{story_content}

Evaluate for test case generation quality:

**Completeness (0-100)**: Will the AI generate test cases for ALL important scenarios?
- Are acceptance criteria explicitly listed?
- Are all user roles covered?
- Are error/failure paths described?
- Are edge cases mentioned?

**Clarity (0-100)**: Can the AI generate unambiguous test steps with specific expected results?
- Are field names, types, formats specified?
- Are expected outcomes measurable and exact?
- Are business rules stated explicitly?

**Testability (0-100)**: Can every statement be written as a pass/fail test?
- Every AC has a verifiable expected outcome?
- Error conditions are specific enough to test?
- No vague words like "appropriate", "correct", "proper"?

Be specific - cite actual text from the story, not generic advice.

Return ONLY this JSON:
{{
  "completeness": <0-100>,
  "clarity": <0-100>,
  "testability": <0-100>,
  "issues": [
    {{"title": "Concise issue name", "description": "Specific gap quoting story text - explain impact on test generation", "area": "Completeness|Clarity|Testability"}}
  ],
  "risk_areas": [
    {{"area": "Risk name", "severity": "High|Medium|Low", "description": "What test cases cannot be generated, what defects could escape"}}
  ],
  "recommendations": ["Exact text that should be added to the story - not generic advice"]
}}"""

        response = Config.llm.invoke(prompt)
        raw = response.content.strip()
        if '```json' in raw:
            raw = raw.split('```json')[1].split('```')[0].strip()
        elif '```' in raw:
            raw = raw.split('```')[1].strip()
        start, end = raw.find('{'), raw.rfind('}') + 1
        result = _robust_json_loads(raw[start:end])

        completeness = int(result.get('completeness', 70))
        clarity = int(result.get('clarity', 70))
        testability = int(result.get('testability', 70))
        overall = round((completeness + clarity + testability) / 3)

        return jsonify({
            'overall_score': overall,
            'completeness': completeness,
            'clarity': clarity,
            'testability': testability,
            'issues': result.get('issues', []),
            'risk_areas': result.get('risk_areas', []),
            'recommendations': result.get('recommendations', []),
        }), 200

    except Exception as e:
        print(f"[analyze-content] Error: {e}")
        return jsonify({'error': str(e)}), 500



@stories_bp.route('/copilot-chat', methods=['POST'])
@dev_jwt_required
def copilot_chat():
    """Direct LLM chat with page context - no RAG retrieval."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json() or {}
        query = (data.get('query') or '').strip()
        system_prompt = data.get('system_prompt', 'You are a helpful QA assistant.')
        history = data.get('history', [])

        if not query:
            return jsonify({'error': 'query required'}), 400

        messages = []
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        for msg in history[-6:]:
            messages.append({'role': msg.get('role', 'user'), 'content': msg.get('content', '')})
        messages.append({'role': 'user', 'content': query})

        # Build LangChain message list
        from langchain_core.messages import HumanMessage, SystemMessage, AIMessage as LCAIMessage
        lc_messages = []
        for m in messages:
            if m['role'] == 'system':
                lc_messages.append(SystemMessage(content=m['content']))
            elif m['role'] == 'user':
                lc_messages.append(HumanMessage(content=m['content']))
            else:
                lc_messages.append(LCAIMessage(content=m['content']))

        response = Config.llm.invoke(lc_messages)
        return jsonify({'response': response.content}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/rag-chat', methods=['POST'])
@dev_jwt_required
def rag_chat():
    """RAG chatbot endpoint: retrieves similar test cases, sends them as context to Gemini, returns generated test cases."""
    try:
        data = request.get_json()
        print("DEBUG:rag_chat: Request received", {'data': data})
        if not data or 'query' not in data:
            return jsonify({'error': 'Query is required'}), 400
        user_query = data['query']
        
        # Check and deduct credit before proceeding
        workspace_id = get_current_workspace_id()
        user_id = get_current_user_id()
        try:
            from app.models.credits_model import CreditsModel, OutOfCreditsException
            CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="rag_chat")
        except OutOfCreditsException as e:
            return jsonify({'error': str(e)}), 402
        except Exception as e:
            return jsonify({'error': f'Credit system error: {str(e)}'}), 500
            
        # 1. Retrieve similar stories and their test cases (scoped to this workspace)
        try:
            print("DEBUG:rag_chat: Calling Chat_RAG", {'query': user_query})
            rag_results = Chat_RAG(user_query, top_k=5, workspace_id=workspace_id)
            print("DEBUG:rag_chat: Chat_RAG returned results", {
                'results_count': len(rag_results) if isinstance(rag_results, list) else 'n/a'
            })
        except Exception as e:
            print(f"❌ ERROR:rag_chat: Chat_RAG failed: {e}")
            return jsonify({'error': 'Failed to retrieve similar stories', 'details': str(e)}), 500
        context_cases = []
        for res in rag_results:
            tc_json = res.get('test_case_json')
            if tc_json and isinstance(tc_json, dict) and 'test_cases' in tc_json:
                context_cases.extend(tc_json['test_cases'])
        print("DEBUG:rag_chat: Context cases collected", {
            'context_cases_count': len(context_cases)
        })
        if not context_cases:
            return jsonify({'error': 'No relevant test cases found.'}), 404

        # 2. Build prompt for Gemini
        context_str = '\n'.join([
            f"Test Case {i+1}: {tc.get('title', '')}\nDescription: {tc.get('description', '')}\nSteps: {tc.get('steps', [])}\nExpected Result: {tc.get('expected_result', '')}\n" for i, tc in enumerate(context_cases)
        ])
        prompt = f"""
You are an experienced QA analyst. Here are test cases from similar stories:
{context_str}

Now, based on the following user story, generate new, comprehensive test cases in JSON format (fields: id, title, steps, expected_result, priority):
{user_query}
"""

        # 3. Call LLM for rag-chat
        try:
            print("DEBUG:rag_chat: Calling LLM via Config.llm.invoke")
            response = Config.llm.invoke(prompt)
            text = response.content.strip()
            print("DEBUG:rag_chat: LLM raw output received", {'length': len(text)})
            try:
                from app.utils.token_tracker import log_token_usage, extract_groq_tokens
                inp, out = extract_groq_tokens(response)
                log_token_usage("rag_chat", "groq", "llama-3.3-70b-versatile", inp, out,
                                workspace_id=workspace_id, user_id=user_id)
            except Exception:
                pass
        except Exception as e:
            print(f"❌ ERROR:rag_chat: LLM invocation failed: {e}")
            return jsonify({'error': 'Failed to generate test cases from LLM', 'details': str(e)}), 500
        # Clean triple backticks and ```json
        cleaned = text.strip()
        if cleaned.startswith('```json'):
            cleaned = cleaned[7:]
        if cleaned.startswith('```'):
            cleaned = cleaned[3:]
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        import json
        try:
            print("DEBUG:rag_chat: Attempting to parse LLM output as JSON")
            parsed = json.loads(cleaned)
            print("DEBUG:rag_chat: Parsed LLM JSON type", {'type': str(type(parsed))})
            if isinstance(parsed, list):
                print("DEBUG:rag_chat: Returning list of test cases", {
                    'count': len(parsed)
                })
                return jsonify({'testCases': parsed})
            if isinstance(parsed, dict) and 'test_cases' in parsed:
                print("DEBUG:rag_chat: Returning dict['test_cases']", {
                    'count': len(parsed['test_cases'])
                })
                return jsonify({'testCases': parsed['test_cases']})
            print("DEBUG:rag_chat: Returning parsed object without transformation")
            return jsonify({'testCases': parsed})
        except Exception as e:
            print("Failed to parse LLM output as JSON:", e)
            return jsonify({'raw': cleaned, 'error': 'Failed to parse LLM output as JSON', 'details': str(e)}), 200
    except Exception as e:
        print(f"Error in rag_chat: {str(e)}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/projects', methods=['GET'])
@dev_jwt_required
def get_projects():
    """Get unique project IDs for the current workspace"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        db_service = get_db_service()

        # Get stories from LanceDB filtered by workspace
        stories_table = db_service.lance_db.open_table(Config.TABLE_NAME_LANCE)
        lance_stories = stories_table.to_pandas()

        # Always filter by workspace_id - if column missing, startup auto-migration should have added it
        if 'workspace_id' not in lance_stories.columns:
            print(f"[get_projects] WARNING: workspace_id column missing from LanceDB table - returning no projects for safety")
            return jsonify({'projects': []})
        lance_stories = lance_stories[lance_stories['workspace_id'] == workspace_id]

        # Get unique project IDs
        project_ids = lance_stories['project_id'].dropna().unique().tolist()
        project_ids = [pid for pid in project_ids if pid and pid.strip()]

        return jsonify({'projects': project_ids})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/projects/<project_id>', methods=['PATCH'])
@dev_jwt_required
def rename_project(project_id):
    """Rename a project or update its archived flag."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json() or {}

        # Handle archive/unarchive flag (stored in test_cases.inputs JSONB)
        if 'archived' in data:
            archived = bool(data['archived'])
            with Config.get_postgres_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE test_cases
                        SET inputs = COALESCE(inputs, '{}'::jsonb) || %s::jsonb
                        WHERE project_id = %s AND workspace_id = %s
                    """, (json.dumps({'project_archived': archived}), project_id, workspace_id))
                    conn.commit()
            return jsonify({'project_id': project_id, 'archived': archived}), 200

        new_id = (data.get('new_id') or '').strip().lower().replace(' ', '-')
        if not new_id:
            return jsonify({'error': 'new_id or archived required'}), 400
        if new_id == project_id:
            return jsonify({'project_id': new_id}), 200

        # Update Postgres
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE test_cases SET project_id = %s
                    WHERE project_id = %s AND workspace_id = %s
                """, (new_id, project_id, workspace_id))
                conn.commit()

        # Update LanceDB
        try:
            import lancedb
            db = lancedb.connect(Config.LANCE_DB_PATH)
            t = db.open_table(Config.TABLE_NAME_LANCE)
            df = t.to_pandas()
            if 'workspace_id' not in df.columns:
                raise ValueError("workspace_id column missing from LanceDB - cannot safely rename")
            mask = (df['project_id'] == project_id) & (df['workspace_id'] == workspace_id)
            df.loc[mask, 'project_id'] = new_id
            db.drop_table(Config.TABLE_NAME_LANCE)
            db.create_table(Config.TABLE_NAME_LANCE, df)
        except Exception as le:
            print(f"[rename_project] LanceDB update failed: {le}")

        return jsonify({'project_id': new_id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/projects/<project_id>', methods=['DELETE'])
@dev_jwt_required
def delete_project(project_id):
    """Delete all stories in a project."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()

        # Get story IDs in this project
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT story_id FROM test_cases
                    WHERE project_id = %s AND workspace_id = %s
                """, (project_id, workspace_id))
                story_ids = [r[0] for r in cur.fetchall()]

                # Delete from Postgres
                cur.execute("""
                    DELETE FROM test_cases
                    WHERE project_id = %s AND workspace_id = %s
                """, (project_id, workspace_id))
                conn.commit()

        # Delete from LanceDB
        try:
            import lancedb
            db = lancedb.connect(Config.LANCE_DB_PATH)
            t = db.open_table(Config.TABLE_NAME_LANCE)
            df = t.to_pandas()
            if 'workspace_id' not in df.columns:
                raise ValueError("workspace_id column missing from LanceDB - cannot safely delete")
            mask = (df['project_id'] == project_id) & (df['workspace_id'] == workspace_id)
            df = df[~mask]
            db.drop_table(Config.TABLE_NAME_LANCE)
            db.create_table(Config.TABLE_NAME_LANCE, df)
        except Exception as le:
            print(f"[delete_project] LanceDB update failed: {le}")

        return jsonify({'deleted': project_id, 'stories_removed': len(story_ids)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/project', methods=['PATCH'])
@dev_jwt_required
def move_story_to_project(story_id):
    """Move a story to a different project within the same workspace."""
    try:
        workspace_id = get_current_workspace_id()
        data = request.get_json() or {}
        new_project_id = (data.get('project_id') or '').strip()
        if not new_project_id:
            return jsonify({'error': 'project_id required'}), 400

        # Update Postgres
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE test_cases SET project_id = %s WHERE story_id = %s AND workspace_id = %s",
                    (new_project_id, story_id, workspace_id)
                )
                conn.commit()

        # Update LanceDB (non-fatal)
        try:
            import lancedb
            db = lancedb.connect(Config.LANCE_DB_PATH)
            table = db.open_table(Config.TABLE_NAME_LANCE)
            df = table.to_pandas()
            if 'workspace_id' in df.columns:
                mask = (df['storyID'] == story_id) & (df['workspace_id'] == workspace_id)
                if mask.any():
                    df.loc[mask, 'project_id'] = new_project_id
                    db.drop_table(Config.TABLE_NAME_LANCE)
                    db.create_table(Config.TABLE_NAME_LANCE, df)
        except Exception as e:
            print(f'[move_story] LanceDB update failed (non-fatal): {e}')

        return jsonify({'story_id': story_id, 'project_id': new_project_id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/upload', methods=['POST'])
@dev_jwt_required
def upload_story():
    """Upload a new user story with project ID, story ID, content, and optional file. Description will be AI-generated."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        ok, err = _check_permission('can_create_stories')
        if not ok: return err
        # Get form data
        project_id = request.form.get('project_id')
        story_id = request.form.get('story_id')
        content = request.form.get('content')
        file = request.files.get('file')
        source = request.form.get('source', 'backend')
        page_url = (request.form.get('page_url') or '').strip()

        # Validate required fields
        if not project_id or not story_id or (not content and not file):
            return jsonify({
                'error': 'Project ID, Story ID, and either Content or File are required'
            }), 400

        # Check if story already exists in this workspace
        db_service = get_db_service()
        existing_story = db_service.get_story(story_id, user_id=user_id, workspace_id=workspace_id)
        if existing_story:
            return jsonify({
                'error': f'Story with ID "{story_id}" already exists'
            }), 409

        # Check and deduct credit before proceeding (skip if workspace has own AI key)
        if not _workspace_has_own_key(workspace_id):
            try:
                from app.models.credits_model import CreditsModel, OutOfCreditsException
                CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="generate_tests", story_id=story_id)
            except OutOfCreditsException as e:
                return jsonify({'error': str(e)}), 402
            except Exception as e:
                return jsonify({'error': f'Credit system error: {str(e)}'}), 500

        # Create project folder if it doesn't exist
        import os
        upload_dir = os.getenv("UPLOAD_FOLDER", "./data/uploaded_docs")
        project_dir = os.path.join(upload_dir, project_id)
        os.makedirs(project_dir, exist_ok=True)

        # Handle file upload if provided
        file_path = None
        file_content = None

        if file and file.filename:
            # Validate file type
            allowed_extensions = {'.pdf', '.docx', '.txt'}
            file_ext = os.path.splitext(file.filename)[1].lower()
            if file_ext not in allowed_extensions:
                return jsonify({
                    'error': f'File type {file_ext} not supported. Allowed: {", ".join(allowed_extensions)}'
                }), 400

            # Save file to project folder
            filename = f"{story_id}{file_ext}"
            file_path = os.path.join(project_dir, filename)
            file.save(file_path)

            # Extract text from file
            try:
                from app.datapipeline.text_extractor import extract_text
                file_content = extract_text(file_path)
                if not file_content:
                    return jsonify({
                        'error': 'Could not extract text from the uploaded file'
                    }), 400
            except Exception as e:
                return jsonify({
                    'error': f'Error extracting text from file: {str(e)}'
                }), 500

        # Create story content (use file content if available, otherwise use typed content)
        story_content = file_content if file_content else content

        # Generate AI description from content using chunking method
        try:
            def summarize_in_chunks(text, chunk_size=4000):
                try:
                    chunks = [text[i:i + chunk_size] for i in range(0, len(text), chunk_size)]
                    summaries = []
                    for chunk in chunks[:3]:
                        prompt = (
                            "Summarize the following document section in 1 sentence:\n\n" + chunk
                        )
                        try:
                            response = Config.llm.invoke(prompt)
                            summaries.append(response.content.strip())
                        except Exception as e:
                            summaries.append("[Summary failed for a chunk]")
                            print(f"❌ LLM failed on a chunk: {e}")
                    return " ".join(summaries)
                except Exception as e:
                    print(f"❌ LLM summary failed: {e}")
                    return "Summary could not be generated."

            description = summarize_in_chunks(story_content)

        except Exception as e:
            print(f"Error generating AI description: {str(e)}")
            description = story_content[:147] + "..." if len(story_content) > 150 else story_content

        # Generate a short 3-5 word title from the description using LLM
        try:
            title_prompt = (
                "Generate a short title of 3-5 words (no punctuation, no quotes) that captures "
                "the main feature described below. Return ONLY the title, nothing else.\n\n"
                + description[:500]
            )
            title_response = Config.llm.invoke(title_prompt)
            short_title = title_response.content.strip().strip('"').strip("'").strip()
            # Fallback if LLM returns something too long or empty
            if not short_title or len(short_title) > 60:
                words = description.split()[:5]
                short_title = " ".join(words)
        except Exception:
            words = description.split()[:5]
            short_title = " ".join(words)

        # Add to LanceDB with user_id
        try:
            from app.config import get_embedding_model
            from datetime import datetime
            import lancedb

            db = lancedb.connect(Config.LANCE_DB_PATH)
            table = db.open_table(Config.TABLE_NAME_LANCE)

            # Generate embedding
            embedding = get_embedding_model().encode(story_content).tolist()

            # Add to LanceDB - storyDescription stores the short title for card display
            table.add([{
                "workspace_id": workspace_id,
                "user_id": user_id,
                "project_id": project_id,
                "vector": embedding,
                "storyID": story_id,
                "storyDescription": short_title,
                "test_case_content": "",
                "filename": filename if file else f"{story_id}.txt",
                "original_path": file_path if file else None,
                "doc_content_text": story_content,
                "embedding_timestamp": datetime.now(),
                "source": source,
            }])
            # page_url is stored in test_cases.inputs JSONB (not LanceDB) to avoid schema issues

        except Exception as e:
            return jsonify({
                'error': f'Error adding story to database: {str(e)}'
            }), 500

        # Run test case generation + impact analysis entirely in background
        # so the HTTP response returns immediately (202 Accepted).
        # Frontend polls GET /api/stories/<id> until test_case_count > 0.
        import threading

        def run_full_pipeline(sid, proj_id, uid, wsid, fpath, fname, purl=""):
            try:
                from app.LLM.Test_case_generator import generate_test_case_for_story
                generate_test_case_for_story(sid, user_id=uid, workspace_id=wsid, page_url=purl)

                # Move file to success folder after generation
                if fpath and os.path.exists(fpath):
                    import shutil
                    success_dir = os.path.join(os.getenv("SUCCESS_FOLDER", "./data/success"), proj_id)
                    os.makedirs(success_dir, exist_ok=True)
                    try:
                        shutil.move(fpath, os.path.join(success_dir, fname))
                    except Exception:
                        pass

                # Run impact analysis
                try:
                    from app.LLM.impact_analyzer import analyze_test_case_impacts
                    analyze_test_case_impacts(new_story_id=sid, project_id=proj_id, user_id=uid, workspace_id=wsid)
                except Exception as ia_err:
                    print(f"[Pipeline] Impact analysis failed for {sid}: {ia_err}")

                print(f"[Pipeline] ✅ Completed full pipeline for {sid}")
            except Exception as e:
                print(f"[Pipeline] ❌ Pipeline failed for {sid}: {e}")
                if fpath and os.path.exists(fpath):
                    import shutil
                    failure_dir = os.path.join(os.getenv("FAILURE_FOLDER", "./data/failure"), proj_id)
                    os.makedirs(failure_dir, exist_ok=True)
                    try:
                        shutil.move(fpath, os.path.join(failure_dir, fname))
                    except Exception:
                        pass

        thread = threading.Thread(
            target=run_full_pipeline,
            args=(story_id, project_id, user_id, workspace_id, file_path, filename if file else f"{story_id}.txt", page_url),
            daemon=True
        )
        thread.start()
        print(f"[Upload] Background pipeline started for story {story_id}")

        # Log activity event
        try:
            from app.routes.activity import log_activity
            log_activity(workspace_id, user_id, 'story_uploaded',
                         f'Story uploaded: {short_title}',
                         body=f'Test generation started for {story_id}',
                         story_id=story_id)
        except Exception: pass

        # Broadcast notification to workspace members
        try:
            from app.models.notification_model import NotificationModel
            NotificationModel.broadcast_to_workspace(
                workspace_id=workspace_id,
                event_type=NotificationModel.STORY_UPLOADED,
                title='New story uploaded',
                body=f'A new story was added to the workspace',
                actor_id=user_id,
                entity_id=story_id,
                entity_type='story',
                exclude_user_id=user_id,
            )
        except Exception: pass

        return jsonify({
            'message': 'Story uploaded. Test generation started in background.',
            'story_id': story_id,
            'project_id': project_id,
            'description': short_title,
            'test_cases_generated': False,
            'file_processed': file is not None,
            'source': source
        }), 202

    except Exception as e:
        print(f"Error in upload_story: {str(e)}")
        return jsonify({
            'error': f'Internal server error: {str(e)}'
        }), 500

@stories_bp.route('/impacts/<project_id>', methods=['GET'])
@dev_jwt_required
def get_project_impacts(project_id):
    """Get all impact analyses for a project"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        db_service = get_db_service()
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                cursor.execute("""
                    SELECT
                        tci.impact_id,
                        tci.new_story_id,
                        tci.original_story_id,
                        tci.original_test_case_id,
                        tci.modified_test_case_id,
                        tci.impact_created_on,
                        tci.similarity_score,
                        tci.impact_analysis_json,
                        tci.impact_status,
                        tc.story_description as original_story_description
                    FROM test_case_impacts tci
                    JOIN test_cases tc ON tc.story_id = tci.original_story_id
                        AND tc.workspace_id = tci.workspace_id
                    WHERE tci.project_id = %s AND tci.workspace_id = %s
                    ORDER BY tci.impact_created_on DESC
                """, (project_id, workspace_id))

                impacts = cursor.fetchall()

                return jsonify({
                    'project_id': project_id,
                    'total_impacts': len(impacts),
                    'impacts': [dict(impact) for impact in impacts]
                }), 200

    except Exception as e:
        print(f"❌ Error fetching project impacts: {e}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/impacts/story/<story_id>', methods=['GET'])
@dev_jwt_required
def get_story_impacts(story_id):
    """Get impacts where this story is either the source or target"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        db_service = get_db_service()
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                cursor.execute("""
                    SELECT
                        tci.*,
                        tc_orig.story_description as impacted_story_description,
                        tc_new.story_description as new_story_description
                    FROM test_case_impacts tci
                    JOIN test_cases tc_orig ON tc_orig.story_id = tci.original_story_id
                    JOIN test_cases tc_new ON tc_new.story_id = tci.new_story_id
                    WHERE (tci.original_story_id = %s OR tci.new_story_id = %s)
                    AND tci.workspace_id = %s
                    ORDER BY tci.impact_created_on DESC
                """, (story_id, story_id, workspace_id))

                impacts = cursor.fetchall()

                # Organize impacts by role (source vs target)
                caused_impacts = []
                received_impacts = []

                for impact in impacts:
                    impact_dict = dict(impact)
                    is_self_impact = impact['new_story_id'] == impact['original_story_id']
                    if is_self_impact:
                        # Self-impact (same story, new version changed existing TC)
                        # Show in received_impacts so Impact tab displays it for review
                        received_impacts.append(impact_dict)
                    elif impact['new_story_id'] == story_id:
                        caused_impacts.append(impact_dict)
                    else:
                        received_impacts.append(impact_dict)

                return jsonify({
                    'story_id': story_id,
                    'total_impacts': len(impacts),
                    'caused_impacts': caused_impacts,
                    'received_impacts': received_impacts
                }), 200

    except Exception as e:
        print(f"❌ Error fetching story impacts: {e}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/impacts/details/<impact_id>', methods=['GET'])
@dev_jwt_required
def get_impact_details(impact_id):
    """Get detailed view of a specific impact"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        db_service = get_db_service()
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                cursor.execute("""
                    SELECT
                        tci.*,
                        tc_orig.story_description as original_story_description,
                        tc_orig.test_case_json as original_test_cases,
                        tc_new.story_description as new_story_description,
                        tc_new.test_case_json as new_test_cases
                    FROM test_case_impacts tci
                    JOIN test_cases tc_orig ON tc_orig.story_id = tci.original_story_id
                    JOIN test_cases tc_new ON tc_new.story_id = tci.new_story_id
                    WHERE tci.impact_id = %s AND tci.workspace_id = %s
                """, (impact_id, workspace_id))

                impact = cursor.fetchone()

                if not impact:
                    return jsonify({'error': 'Impact not found'}), 404

                return jsonify(dict(impact)), 200

    except Exception as e:
        print(f"❌ Error fetching impact details: {e}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/impacts/summary/<project_id>', methods=['GET'])
@dev_jwt_required
def get_project_impact_summary(project_id):
    """Get summary of impacts in a project"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                cursor.execute("""
                    SELECT * FROM test_case_impact_summary
                    WHERE project_id = %s
                    AND story_id IN (
                        SELECT story_id FROM test_cases WHERE workspace_id = %s
                    )
                    ORDER BY total_impacts DESC
                """, (project_id, workspace_id))
                summaries = cursor.fetchall()

        return jsonify({
            'project_id': project_id,
            'total_stories': len(summaries),
            'stories_with_impacts': len([s for s in summaries if s['total_impacts'] > 0]),
            'summaries': [dict(summary) for summary in summaries]
        }), 200

    except Exception as e:
        print(f"❌ Error fetching impact summary: {e}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/impacts/analyze', methods=['POST'])
@dev_jwt_required
def trigger_impact_analysis():
    """Manually trigger impact analysis for a story"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json()
        story_id = data.get('story_id')
        project_id = data.get('project_id')

        if not story_id or not project_id:
            return jsonify({
                'error': 'Both story_id and project_id are required'
            }), 400

        analyze_test_case_impacts(story_id, project_id, user_id=user_id, workspace_id=workspace_id)

        return jsonify({
            'message': 'Impact analysis triggered successfully',
            'story_id': story_id,
            'project_id': project_id
        }), 200

    except Exception as e:
        print(f"❌ Error triggering impact analysis: {e}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/impacts/analyze-project', methods=['POST'])
@dev_jwt_required
def trigger_project_impact_analysis():
    """Trigger impact analysis for ALL stories in a project (background thread)."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json()
        project_id = data.get('project_id')

        if not project_id:
            return jsonify({'error': 'project_id is required'}), 400

        # Get all stories with test cases in this project scoped to workspace
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                cursor.execute("""
                    SELECT story_id FROM test_cases
                    WHERE project_id = %s AND test_case_generated = TRUE AND workspace_id = %s
                    ORDER BY created_on ASC
                """, (project_id, workspace_id))
                stories = [row['story_id'] for row in cursor.fetchall()]

        if not stories:
            return jsonify({
                'message': 'No stories with test cases found in project',
                'project_id': project_id,
                'stories_queued': 0
            }), 200

        # Run analysis in background thread
        import threading
        def run_all_impact_analyses(story_list, proj_id, uid, wsid):
            try:
                print(f"[ImpactAnalysis] Starting project-wide impact analysis for {len(story_list)} stories in project {proj_id}")
                from app.LLM.impact_analyzer import analyze_test_case_impacts
                for sid in story_list:
                    try:
                        analyze_test_case_impacts(new_story_id=sid, project_id=proj_id, user_id=uid, workspace_id=wsid)
                        print(f"[ImpactAnalysis] Completed impact analysis for story {sid}")
                    except Exception as story_err:
                        print(f"[ImpactAnalysis] Error analyzing story {sid}: {story_err}")
                print(f"[ImpactAnalysis] Project-wide impact analysis completed for project {proj_id}")
            except Exception as e:
                print(f"[ImpactAnalysis] Project-wide impact analysis failed: {e}")

        thread = threading.Thread(
            target=run_all_impact_analyses,
            args=(stories, project_id, user_id, workspace_id),
            daemon=True
        )
        thread.start()

        return jsonify({
            'message': f'Impact analysis started for {len(stories)} stories in background',
            'project_id': project_id,
            'stories_queued': len(stories)
        }), 202

    except Exception as e:
        print(f"Error triggering project impact analysis: {e}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/<story_id>/test-cases/<test_case_id>', methods=['GET'])
@dev_jwt_required
def get_test_case(story_id, test_case_id):
    """Get a specific test case from a story"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        print(f"Fetching test case {test_case_id} from story {story_id}")
        db_service = get_db_service()

        # Get test cases from PostgreSQL scoped to workspace
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    WITH test_cases_array AS (
                        SELECT jsonb_array_elements(test_case_json->'test_cases') as test_case
                        FROM test_cases
                        WHERE story_id = %s AND workspace_id = %s
                    )
                    SELECT test_case
                    FROM test_cases_array
                    WHERE test_case->>'id' = %s
                    OR test_case->>'test_case_id' = %s
                    LIMIT 1
                """, (story_id, workspace_id, test_case_id, test_case_id))
                result = cur.fetchone()

                if not result:
                    return jsonify({
                        'error': f'Test case {test_case_id} not found in story {story_id}'
                    }), 404

                test_case = result[0]
                return jsonify({
                    'id': test_case.get('id') or test_case.get('test_case_id'),
                    'title': test_case.get('title'),
                    'test_steps': test_case.get('steps', []),
                    'expected_result': test_case.get('expected_result', ''),
                    'priority': test_case.get('priority', 'medium'),
                    'severity': test_case.get('severity', 'medium')
                })

    except Exception as e:
        print(f"Error getting test case {test_case_id} from story {story_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/impacts/story-test-cases/<story_id>', methods=['GET'])
@dev_jwt_required
def get_story_test_case_impacts(story_id):
    """Get details of how test cases in this story were impacted by other stories"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        project_id = request.args.get('project_id')
        if not project_id:
            return jsonify({'error': 'project_id is required as query parameter'}), 400

        print(f"DEBUG: Starting story test case impacts fetch for story {story_id} in project {project_id}")

        # Get story description first to check if story exists
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                # First get the impacted test cases count directly from the database
                cursor.execute("""
                    SELECT COUNT(DISTINCT original_test_case_id) as impacted_count
                    FROM test_case_impacts
                    WHERE original_story_id = %s
                    AND project_id = %s
                    AND impact_status = 'active'
                    AND workspace_id = %s
                """, (story_id, project_id, workspace_id))
                db_impacted_count = cursor.fetchone()['impacted_count']

                cursor.execute("""
                    SELECT story_description, test_case_json
                    FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                """, (story_id, workspace_id))
                story_info = cursor.fetchone()

                if not story_info:
                    return jsonify({'error': 'Story not found'}), 404

                print("DEBUG: Found story info")
                story_info = dict(story_info)

                # Handle test_case_json which could be either string or dict
                test_case_json = story_info['test_case_json']
                if isinstance(test_case_json, str):
                    try:
                        test_case_json = json.loads(test_case_json)
                    except Exception as e:
                        print(f"DEBUG: Error parsing test_case_json string: {e}")
                        test_case_json = {'test_cases': []}
                elif not isinstance(test_case_json, dict):
                    print(f"DEBUG: Unexpected test_case_json type: {type(test_case_json)}")
                    test_case_json = {'test_cases': []}

                test_cases = test_case_json.get('test_cases', [])
                total_test_cases = len(test_cases)
                test_case_ids = [tc.get('id') for tc in test_cases]
                print(f"DEBUG: Found {total_test_cases} test cases with IDs: {test_case_ids}")

                # Get all impacts for these test cases
                if test_case_ids:
                    placeholders = ','.join(['%s'] * len(test_case_ids))
                    cursor.execute(f"""
                        SELECT
                            tci.original_test_case_id,
                            tci.impact_id,
                            tci.new_story_id,
                            new_tc.story_description,
                            tci.impact_created_on,
                            tci.impact_severity,
                            tci.impact_priority,
                            tci.impact_details,
                            tci.impact_analysis_json
                        FROM test_case_impacts tci
                        JOIN test_cases new_tc ON new_tc.story_id = tci.new_story_id
                        WHERE tci.project_id = %s
                        AND tci.original_test_case_id IN ({placeholders})
                        AND tci.impact_status = 'active'
                        AND tci.workspace_id = %s
                        ORDER BY tci.original_test_case_id, tci.impact_created_on DESC
                    """, (project_id,) + tuple(test_case_ids) + (workspace_id,))
                    impacts = cursor.fetchall()
                    print(f"DEBUG: Found {len(impacts)} impacts")
                else:
                    impacts = []

                # Group impacts by test case ID
                impact_map = {}
                for impact in impacts:
                    test_case_id = impact['original_test_case_id']
                    if test_case_id not in impact_map:
                        impact_map[test_case_id] = []

                    # Handle impact_analysis_json
                    impact_analysis = impact['impact_analysis_json']
                    try:
                        if isinstance(impact_analysis, str):
                            impact_analysis = json.loads(impact_analysis)
                        elif hasattr(impact_analysis, 'decode'):
                            impact_analysis = json.loads(impact_analysis.decode())
                    except Exception as e:
                        print(f"DEBUG: Error parsing impact_analysis_json: {e}")
                        impact_analysis = str(impact_analysis)

                    formatted_impact = {
                        'impact_id': str(impact['impact_id']),
                        'impacting_story_id': str(impact['new_story_id']),
                        'impacting_story_description': str(impact['story_description']) if impact['story_description'] else '',
                        'impact_created_on': impact['impact_created_on'].isoformat() if isinstance(impact['impact_created_on'], datetime) else str(impact['impact_created_on']) if impact['impact_created_on'] else None,
                        'impact_severity': str(impact['impact_severity']) if impact['impact_severity'] else '',
                        'impact_priority': str(impact['impact_priority']) if impact['impact_priority'] else '',
                        'impact_details': json.dumps(impact['impact_details']) if isinstance(impact['impact_details'], (dict, list)) else str(impact['impact_details']) if impact['impact_details'] else '',
                        'impact_analysis_json': json.dumps(impact_analysis) if isinstance(impact_analysis, (dict, list)) else str(impact_analysis)
                    }
                    impact_map[test_case_id].append(formatted_impact)

                # Build response — only include test cases that actually have impacts
                impacted_test_cases = []
                for tc in test_cases:
                    tc_id = tc.get('id')
                    steps = tc.get('steps', [])
                    steps_str = json.dumps(steps) if isinstance(steps, (list, dict)) else str(steps)
                    tc_impacts = impact_map.get(tc_id, [])
                    if not tc_impacts:
                        continue  # skip test cases with no active impacts
                    test_case = {
                        'test_case_id': str(tc_id),
                        'original_title': str(tc.get('title', '')),
                        'original_expected_result': str(tc.get('expected_result', '')),
                        'original_steps': steps_str,
                        'impacts': tc_impacts
                    }
                    impacted_test_cases.append(test_case)

                # Use actual count from current data, not stale DB column
                actual_impacted_count = len(impacted_test_cases)

                response = {
                    'story_id': str(story_id),
                    'story_description': str(story_info['story_description']) if story_info['story_description'] else '',
                    'total_test_cases': str(total_test_cases),
                    'impacted_test_cases_count': str(actual_impacted_count),
                    'impact_percentage': str(round((actual_impacted_count / total_test_cases * 100) if total_test_cases > 0 else 0, 2)),
                    'impacted_test_cases': impacted_test_cases,
                    'severity_summary': {
                        'high': str(len([tc for tc in impacted_test_cases if any(i['impact_severity'] == 'high' for i in tc['impacts'])])),
                        'medium': str(len([tc for tc in impacted_test_cases if any(i['impact_severity'] == 'medium' for i in tc['impacts'])])),
                        'low': str(len([tc for tc in impacted_test_cases if any(i['impact_severity'] == 'low' for i in tc['impacts'])]))
                    }
                }

                return jsonify(response), 200

    except Exception as e:
        print(f"❌ Error fetching story test case impacts: {e}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/impacts/story-details/<story_id>', methods=['GET'])
@dev_jwt_required
def get_story_impact_details(story_id):
    """Get detailed impact information for a story"""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        project_id = request.args.get('project_id')
        if not project_id:
            return jsonify({'error': 'project_id is required as query parameter'}), 400

        db_service = get_db_service()
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                # Get story details first
                cursor.execute("""
                    SELECT story_description, test_case_json
                    FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                """, (story_id, workspace_id))
                story_info = cursor.fetchone()

                if not story_info:
                    return jsonify({'error': 'Story not found'}), 404

                # Get all test cases and their impacts
                cursor.execute("""
                    WITH story_test_cases AS (
                        SELECT
                            story_id,
                            jsonb_array_elements(test_case_json->'test_cases') as test_case,
                            (jsonb_array_elements(test_case_json->'test_cases')->>'id') as test_case_id
                        FROM test_cases
                        WHERE story_id = %s AND workspace_id = %s
                    ),
                    impact_details AS (
                        SELECT
                            tc.test_case_id,
                            tc.test_case->>'title' as test_case_title,
                            tc.test_case->>'expected_result' as original_expected_result,
                            tc.test_case->'steps' as original_steps,
                            json_agg(
                                CASE WHEN tci.impact_id IS NOT NULL THEN
                                    json_build_object(
                                        'impact_id', tci.impact_id,
                                        'impacting_story_id', tci.new_story_id,
                                        'impact_created_on', tci.impact_created_on,
                                        'impact_severity', tci.impact_severity,
                                        'impact_priority', tci.impact_priority,
                                        'impact_details', tci.impact_details,
                                        'impact_analysis_json', tci.impact_analysis_json
                                    )
                                ELSE NULL
                                END
                            ) FILTER (WHERE tci.impact_id IS NOT NULL) as impacts
                        FROM story_test_cases tc
                        LEFT JOIN test_case_impacts tci ON tci.original_test_case_id = tc.test_case_id
                            AND tci.project_id = %s
                            AND tci.impact_status = 'active'
                            AND tci.workspace_id = %s
                        GROUP BY tc.test_case_id, tc.test_case
                    )
                    SELECT
                        test_case_id,
                        test_case_title,
                        original_expected_result,
                        original_steps,
                        impacts,
                        impacts IS NOT NULL as is_impacted,
                        CASE
                            WHEN impacts IS NULL THEN 'none'
                            WHEN impacts::text LIKE '%%"impact_severity":"high"%%' THEN 'high'
                            WHEN impacts::text LIKE '%%"impact_severity":"medium"%%' THEN 'medium'
                            ELSE 'low'
                        END as highest_severity
                    FROM impact_details
                    ORDER BY
                        is_impacted DESC,
                        CASE highest_severity
                            WHEN 'high' THEN 1
                            WHEN 'medium' THEN 2
                            WHEN 'low' THEN 3
                            ELSE 4
                        END,
                        test_case_title
                """, (story_id, workspace_id, project_id, workspace_id))

                test_cases = cursor.fetchall()

                # Calculate summary statistics
                raw_tc_json = story_info['test_case_json']
                try:
                    if isinstance(raw_tc_json, str):
                        parsed_tc_json = json.loads(raw_tc_json)
                    elif isinstance(raw_tc_json, dict):
                        parsed_tc_json = raw_tc_json
                    else:
                        print(f"DEBUG:get_story_impact_details: Unexpected test_case_json type: {type(raw_tc_json)}")
                        parsed_tc_json = {'test_cases': []}
                except Exception as e:
                    print(f"DEBUG:get_story_impact_details: Error parsing test_case_json: {e}")
                    return jsonify({
                        'error': 'Invalid test cases data format for story',
                        'details': str(e)
                    }), 500

                total_test_cases = len(parsed_tc_json.get('test_cases', []))
                impacted_test_cases = sum(1 for tc in test_cases if tc['is_impacted'])
                severity_counts = {
                    'high': sum(1 for tc in test_cases if tc['highest_severity'] == 'high'),
                    'medium': sum(1 for tc in test_cases if tc['highest_severity'] == 'medium'),
                    'low': sum(1 for tc in test_cases if tc['highest_severity'] == 'low')
                }

                response = {
                    'story_id': story_id,
                    'story_description': story_info['story_description'],
                    'total_test_cases': total_test_cases,
                    'impacted_test_cases_count': impacted_test_cases,
                    'impact_percentage': round((impacted_test_cases / total_test_cases * 100) if total_test_cases > 0 else 0, 2),
                    'severity_summary': severity_counts,
                    'test_cases': [
                        {
                            'test_case_id': tc['test_case_id'],
                            'title': tc['test_case_title'],
                            'expected_result': tc['original_expected_result'],
                            'steps': tc['original_steps'],
                            'is_impacted': tc['is_impacted'],
                            'highest_severity': tc['highest_severity'],
                            'impacts': tc['impacts'] if tc['impacts'] else []
                        } for tc in test_cases
                    ]
                }

                return jsonify(response), 200

    except Exception as e:
        print(f"❌ Error fetching story impact details: {e}")
        return jsonify({'error': str(e)}), 500


# ── Generate User Stories from Requirements document ──────────────────────────

@stories_bp.route('/generate-from-requirements', methods=['POST'])
@dev_jwt_required
def generate_stories_from_requirements():
    """
    Accept a requirements document (PDF/DOCX/TXT file or pasted text),
    extract text, send to LLM, return structured user stories for review.

    Request: multipart/form-data
      - file (optional): PDF, DOCX, or TXT requirements document
      - text (optional): pasted requirement text
      - project_id (optional): project to scope the stories to

    Response: { stories: [{ title, narrative, acceptance_criteria: [] }] }
    """
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()

        try:
            from app.models.credits_model import CreditsModel, OutOfCreditsException
            CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="analyze_requirements")
        except OutOfCreditsException as e:
            return jsonify({'error': str(e), 'code': 'OUT_OF_CREDITS'}), 402

        text_content = request.form.get('text', '').strip()
        file = request.files.get('file')
        project_id = request.form.get('project_id', 'default')

        # Extract text from uploaded file if provided
        if file and file.filename:
            import os, tempfile
            file_ext = os.path.splitext(file.filename)[1].lower()
            allowed = {'.pdf', '.docx', '.txt', '.md'}
            if file_ext not in allowed:
                return jsonify({'error': f'File type {file_ext} not supported. Allowed: PDF, DOCX, TXT, MD'}), 400
            # Save to temp file and extract
            with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
                file.save(tmp.name)
                tmp_path = tmp.name
            try:
                from app.datapipeline.text_extractor import extract_text
                file_text = extract_text(tmp_path)
                if file_text:
                    text_content = (text_content + '\n\n' + file_text).strip() if text_content else file_text
            finally:
                os.unlink(tmp_path)

        if not text_content:
            return jsonify({'error': 'No content provided. Upload a file or paste requirements text.'}), 400

        if len(text_content) < 100:
            return jsonify({'error': 'Content too short. Please provide at least 100 characters of requirements.'}), 400

        # Truncate to avoid token limit (keep first ~12000 chars)
        content_for_llm = text_content[:12000]

        # LLM prompt to extract user stories
        prompt = f"""You are a senior business analyst. Extract user stories from the following requirements document.

REQUIREMENTS DOCUMENT:
{content_for_llm}

TASK: Extract ALL user stories from this document and return them as a JSON array.

Each user story must follow the standard format:
- title: Short 3-8 word title (e.g. "User Login with Email")
- narrative: Full "As a [role], I want to [action] so that [benefit]" statement
- acceptance_criteria: List of 2-6 specific, testable acceptance criteria

RULES:
- Extract ONLY stories that are clearly implied by the requirements
- Do NOT invent stories not present in the document
- Each story must be distinct and testable
- Acceptance criteria must be specific and measurable
- Return 3 to 15 stories depending on document complexity

Return ONLY a valid JSON array, no other text:
[
  {{
    "title": "story title here",
    "narrative": "As a [role], I want to [action] so that [benefit].",
    "acceptance_criteria": [
      "Given [context], when [action], then [outcome]",
      "The system must [requirement]"
    ]
  }}
]"""

        # Call LLM
        response = Config.llm.invoke(prompt)
        raw = response.content.strip()

        try:
            from app.utils.token_tracker import log_token_usage, extract_groq_tokens
            inp, out = extract_groq_tokens(response)
            log_token_usage("generate_from_requirements", "groq", "llama-3.3-70b-versatile",
                            inp, out, workspace_id=workspace_id, user_id=user_id)
        except Exception:
            pass

        # Clean up response
        if '```json' in raw:
            raw = raw.split('```json')[1].split('```')[0].strip()
        elif '```' in raw:
            raw = raw.split('```')[1].strip()

        # Find JSON array
        start = raw.find('[')
        end = raw.rfind(']') + 1
        if start == -1 or end == 0:
            return jsonify({'error': 'LLM did not return valid JSON. Please try again.'}), 500

        import json as _json
        stories_list = _json.loads(raw[start:end])

        if not isinstance(stories_list, list) or len(stories_list) == 0:
            return jsonify({'error': 'No user stories could be extracted from this document. Please check the content.'}), 422

        # Normalize and validate each story
        normalized = []
        for i, s in enumerate(stories_list[:15]):  # cap at 15
            if not isinstance(s, dict):
                continue
            title = str(s.get('title', f'Story {i+1}')).strip()[:100]
            narrative = str(s.get('narrative', '')).strip()
            ac = s.get('acceptance_criteria', s.get('acceptanceCriteria', []))
            if isinstance(ac, str):
                ac = [ac]
            ac = [str(c).strip() for c in ac if str(c).strip()][:8]

            if not title or not narrative:
                continue

            normalized.append({
                'id': f'gen-{i+1}',
                'title': title,
                'narrative': narrative,
                'acceptance_criteria': ac,
                'status': 'draft'
            })

        if not normalized:
            return jsonify({'error': 'Could not parse any valid stories from LLM response.'}), 500

        return jsonify({
            'stories': normalized,
            'source_length': len(text_content),
            'project_id': project_id,
        }), 200

    except Exception as e:
        print(f'❌ Error generating stories from requirements: {e}')
        return jsonify({'error': str(e)}), 500


# ── Story quality analysis ────────────────────────────────────────────────────

def _compute_or_get_quality(story_id, workspace_id, user_id, force_refresh=False):
    """
    Shared quality-analysis implementation. One LLM call, cached in the
    story's inputs JSONB column. Used by both GET /<story_id>/quality and
    GET /<story_id>/intelligence (which reuses this exact function instead
    of running a second LLM pipeline). Returns (result_dict, status_code).

    Use LLM to analyze story quality and return:
      - overall_score (0-100)
      - completeness, clarity, testability sub-scores (0-100)
      - issues: list of {title, description, area}
      - risk_areas: list of {area, severity, description}
      - recommendations: list of strings
      - missing_scenarios / missing_validations / missing_security_requirements
      - suggested_test_areas: {functional, security, performance, accessibility}
    """
    try:
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT story_description, inputs,
                           inputs->>'main_text'    AS main_text,
                           inputs->>'content'      AS input_content,
                           inputs->>'story_description' AS input_desc
                    FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                """, (story_id, workspace_id))
                row = cur.fetchone()

        if not row:
            # Try LanceDB for content
            import lancedb
            db = lancedb.connect(Config.LANCE_DB_PATH)
            table = db.open_table(Config.TABLE_NAME_LANCE)
            all_rows = table.to_pandas()
            story_rows = all_rows[all_rows['storyID'] == story_id]
            if 'workspace_id' in story_rows.columns:
                story_rows = story_rows[story_rows['workspace_id'] == workspace_id]
            if story_rows.empty:
                return {'error': 'Story not found'}, 404
            content = str(story_rows.iloc[0].get('doc_content_text', ''))
            description = str(story_rows.iloc[0].get('storyDescription', ''))
            cached_quality = None
        else:
            # Content priority: main_text > input_content > story_description
            content = (
                str(row.get('main_text') or '')
                or str(row.get('input_content') or '')
                or str(row.get('input_desc') or '')
                or str(row.get('story_description') or '')
            )
            description = str(row.get('story_description') or '')
            inputs = row.get('inputs') or {}
            if isinstance(inputs, str):
                try:
                    inputs = json.loads(inputs)
                except Exception:
                    inputs = {}
            cached_quality = None if force_refresh else inputs.get('quality_analysis')

        # Return cached result if available (avoid re-calling LLM)
        if cached_quality:
            return cached_quality, 200

        story_text = content or description
        if not story_text or len(story_text) < 30:
            return {'error': 'Story content too short for analysis'}, 422

        # Build LLM prompt - TestSurge-specific quality analysis
        prompt = f"""You are an expert QA Architect reviewing a user story that will be fed into TestSurge - an AI-powered test case generation system. Your analysis directly determines how many and how good the generated test cases will be.

Your job is NOT a generic writing review. You are evaluating whether this story will produce HIGH-QUALITY, COMPREHENSIVE test cases when processed by an AI test case generator.

USER STORY:
{story_text}

---

EVALUATION CRITERIA FOR TEST CASE GENERATION:

**Completeness (0-100)** - Will the AI be able to generate test cases for ALL the scenarios that matter?
- Are there explicit acceptance criteria (Given/When/Then or bullet points)?
- Are all user roles/personas covered (who uses this feature)?
- Are all entry points documented (API, UI, batch, event-triggered)?
- Are error states described (what happens when things go wrong)?
- Are edge cases mentioned (empty states, max/min values, concurrent users)?
- Are integrations with other systems described?
- Penalise heavily: no AC at all (-30), only happy path described (-20), user roles missing (-10)

**Clarity (0-100)** - Can the AI unambiguously generate test steps and expected results?
- Are field names, values, and formats specified (e.g. "email field, max 255 chars, RFC 5321" not "valid email")?
- Are expected outcomes measurable and specific (e.g. "returns HTTP 200 with JSON {id, token}" not "succeeds")?
- Are business rules stated explicitly (e.g. "user can have max 3 active sessions" not "sessions are managed")?
- Are UI states described (what does the user see, what changes on screen)?
- Are data relationships clear (e.g. "only admins can delete, editors can archive")?
- Penalise: vague verbs like "appropriate", "correct", "proper" (-5 each), missing expected values (-10 each)

**Testability (0-100)** - Can a QA engineer write a pass/fail test for every statement?
- Every acceptance criterion must have a verifiable expected outcome
- Negative scenarios must be testable (e.g. "system rejects invalid token with 401" not "handles errors")
- Performance requirements must be measurable (e.g. "loads in <2s on 3G" not "fast")
- Authorisation rules must be specific enough to test (e.g. "viewers cannot edit" not "access control")
- Penalise: statements that can't be verified (-15 each), missing HTTP status codes for APIs (-5 each)

---

WHAT GOOD LOOKS LIKE FOR TEST CASE GENERATION:
- Completeness 90+: Story has AC, lists all user types, happy path + 3+ error paths, data validations
- Clarity 90+: All fields have types/formats, all outcomes have exact values, no ambiguous words
- Testability 90+: Every AC can be phrased as "Given X, When Y, Then Z" with specific Z

---

Be specific. Every issue must quote the exact sentence or gap in the story. Do not write generic advice.

Return ONLY valid JSON:
{{
  "completeness": <0-100>,
  "clarity": <0-100>,
  "testability": <0-100>,
  "overall_score": <round(completeness*0.4 + clarity*0.3 + testability*0.3)>,
  "issues": [
    {{
      "title": "Concise issue name (5-8 words)",
      "description": "Specific gap - quote the missing/ambiguous text, explain why it hurts test generation",
      "area": "Completeness|Clarity|Testability",
      "severity": "Critical|High|Medium|Low"
    }}
  ],
  "risk_areas": [
    {{
      "area": "Risk name",
      "severity": "High|Medium|Low",
      "description": "What test cases CANNOT be generated because of this gap, and what defects could escape"
    }}
  ],
  "recommendations": [
    "Specific rewrite suggestion - provide exact text that should be added to the story"
  ],
  "missing_scenarios": [
    "Exact scenario: 'What happens when [specific condition]?' - be precise, not generic"
  ],
  "missing_validations": [
    "Exact validation: 'Field/rule X has no [type/length/format/range] defined' - cite field name"
  ],
  "missing_security_requirements": [
    "Specific security gap relevant to this story's domain"
  ],
  "suggested_test_areas": {{
    "functional": true,
    "negative": <true if error paths can be tested>,
    "boundary": <true if any numeric/length/date fields exist>,
    "security": <true if story involves auth, permissions, PII, or sensitive data>,
    "performance": <true if story mentions volume, load, SLAs, or concurrency>,
    "accessibility": <true if story has UI components>
  }}
}}"""

        response = Config.llm.invoke(prompt)
        raw = response.content.strip()

        try:
            from app.utils.token_tracker import log_token_usage, extract_groq_tokens
            inp, out = extract_groq_tokens(response)
            log_token_usage("story_quality", "groq", "llama-3.3-70b-versatile", inp, out,
                            workspace_id=workspace_id, user_id=user_id, story_id=story_id)
        except Exception:
            pass

        # Parse JSON
        if '```json' in raw:
            raw = raw.split('```json')[1].split('```')[0].strip()
        elif '```' in raw:
            raw = raw.split('```')[1].strip()
        start = raw.find('{')
        end = raw.rfind('}') + 1
        if start == -1 or end == 0:
            return {'error': 'LLM did not return valid JSON'}, 500

        result = _robust_json_loads(raw[start:end])

        # Compute overall score
        completeness = min(100, max(0, int(result.get('completeness', 70))))
        clarity = min(100, max(0, int(result.get('clarity', 70))))
        testability = min(100, max(0, int(result.get('testability', 70))))
        # Use LLM's weighted overall if provided, otherwise calculate
        if result.get('overall_score'):
            overall = min(100, max(0, int(result['overall_score'])))
        else:
            overall = round(completeness * 0.4 + clarity * 0.3 + testability * 0.3)

        risk_areas = result.get('risk_areas', [])[:3]
        suggested_test_areas = result.get('suggested_test_areas') or {}

        quality = {
            'overall_score': overall,
            'completeness': completeness,
            'clarity': clarity,
            'testability': testability,
            'issues': result.get('issues', [])[:4],
            'risk_areas': risk_areas,
            'recommendations': result.get('recommendations', [])[:6],
            'missing_scenarios': result.get('missing_scenarios', [])[:8],
            'missing_scenarios_total': len(result.get('missing_scenarios', [])),
            'missing_validations': result.get('missing_validations', [])[:8],
            'missing_validations_total': len(result.get('missing_validations', [])),
            'missing_security_requirements': result.get('missing_security_requirements', [])[:3],
            'suggested_test_areas': {
                'functional': bool(suggested_test_areas.get('functional', True)),
                'security': bool(suggested_test_areas.get('security', False)),
                'performance': bool(suggested_test_areas.get('performance', False)),
                'accessibility': bool(suggested_test_areas.get('accessibility', False)),
            },
        }

        # Cache result in inputs column
        try:
            with Config.get_postgres_connection() as conn:
                with conn.cursor() as cur:
                    quality['cached_at'] = datetime.utcnow().isoformat()
                    cur.execute("""
                        UPDATE test_cases
                        SET inputs = COALESCE(inputs, '{}'::jsonb) || %s::jsonb
                        WHERE story_id = %s AND workspace_id = %s
                    """, (json.dumps({'quality_analysis': quality}), story_id, workspace_id))
                    conn.commit()
        except Exception:
            pass  # caching failure is non-fatal

        return quality, 200

    except Exception as e:
        print(f'❌ Error in quality analysis for {story_id}: {e}')
        return {'error': str(e)}, 500


@stories_bp.route('/<story_id>/quality', methods=['GET'])
@dev_jwt_required
def get_story_quality(story_id):
    """
    Use LLM to analyze story quality and return overall_score, completeness,
    clarity, testability, issues, risk_areas, recommendations, and the
    missing-criteria / suggested-test-area fields. See _compute_or_get_quality
    for the full implementation (shared with GET /<story_id>/intelligence).
    """
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    result, status = _compute_or_get_quality(story_id, workspace_id, user_id)
    return jsonify(result), status


# ── Story Intelligence (AI Insights panel) ─────────────────────────────────────
# Reuses _compute_or_get_quality (same prompt/cache as /quality) for risk +
# requirement-quality + missing-criteria + suggested-test-areas, and
# StoryIntelligenceModel for the impact summary (pure aggregation of rows the
# existing impact analyzer already wrote). No second LLM pipeline.

def _build_intelligence_response(story_id, workspace_id, user_id, force_refresh=False):
    from app.models.story_intelligence_model import StoryIntelligenceModel, aggregate_risk_level

    quality, status = _compute_or_get_quality(story_id, workspace_id, user_id, force_refresh=force_refresh)
    if status != 200:
        return quality, status

    risk_areas = quality.get('risk_areas', [])
    impact_summary = StoryIntelligenceModel.get_impact_summary(workspace_id, story_id)

    intelligence = {
        'risk_score': {
            'level': aggregate_risk_level(risk_areas),
            'risk_areas': risk_areas,
        },
        'requirement_quality': {
            'score': quality.get('overall_score'),
            'completeness': quality.get('completeness'),
            'clarity': quality.get('clarity'),
            'testability': quality.get('testability'),
            'issues': quality.get('issues', []),
            'recommendations': quality.get('recommendations', []),
        },
        'missing_criteria': {
            'missing_scenarios': quality.get('missing_scenarios', []),
            'missing_validations': quality.get('missing_validations', []),
            'missing_security_requirements': quality.get('missing_security_requirements', []),
        },
        'suggested_test_areas': quality.get('suggested_test_areas', {}),
        'impact_summary': impact_summary,
        'generated_at': datetime.utcnow().isoformat(),
    }
    return intelligence, 200


@stories_bp.route('/<story_id>/intelligence', methods=['GET'])
@dev_jwt_required
def get_story_intelligence(story_id):
    """AI Insights for the Story Detail Drawer: risk score, requirement quality,
    missing acceptance criteria, suggested test areas, impact summary. Reuses
    the existing quality-analysis cache (test_cases.inputs.quality_analysis) -
    a cache hit costs zero LLM calls, identical to GET /<story_id>/quality."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()

        # Deduct a credit only when this actually triggers a fresh LLM call.
        # Determine cache status the same way _compute_or_get_quality does,
        # so a cache hit (the common case) never costs a credit.
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT inputs FROM test_cases WHERE story_id = %s AND workspace_id = %s",
                    (story_id, workspace_id),
                )
                row = cur.fetchone()
        cached = False
        if row and row[0]:
            inputs = row[0]
            if isinstance(inputs, str):
                try:
                    inputs = json.loads(inputs)
                except Exception:
                    inputs = {}
            cached = bool(inputs.get('quality_analysis'))

        if not cached:
            try:
                from app.models.credits_model import CreditsModel, OutOfCreditsException
                CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="story_intelligence", story_id=story_id)
            except OutOfCreditsException as e:
                return jsonify({'error': str(e)}), 402
            except Exception as e:
                return jsonify({'error': f'Credit system error: {str(e)}'}), 500

        result, status = _build_intelligence_response(story_id, workspace_id, user_id)
        return jsonify(result), status
    except Exception as e:
        print(f'❌ Error in story intelligence for {story_id}: {e}')
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/intelligence/refresh', methods=['POST'])
@dev_jwt_required
def refresh_story_intelligence(story_id):
    """Force-regenerate AI Insights, bypassing the cache. Always deducts a
    credit since this always triggers a fresh LLM call by design."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()

        try:
            from app.models.credits_model import CreditsModel, OutOfCreditsException
            CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="story_intelligence_refresh", story_id=story_id)
        except OutOfCreditsException as e:
            return jsonify({'error': str(e)}), 402
        except Exception as e:
            return jsonify({'error': f'Credit system error: {str(e)}'}), 500

        result, status = _build_intelligence_response(story_id, workspace_id, user_id, force_refresh=True)
        return jsonify(result), status
    except Exception as e:
        print(f'❌ Error refreshing story intelligence for {story_id}: {e}')
        return jsonify({'error': str(e)}), 500


# ── Story Kanban status ───────────────────────────────────────────────────────

@stories_bp.route('/<story_id>/status', methods=['PATCH'])
@dev_jwt_required
@require_workspace_role(['owner', 'admin', 'editor'])
def update_story_status(story_id):
    """Update the Kanban column for a story (in_review / in_progress / completed)."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json(silent=True) or {}
        new_status = data.get('status')
        allowed = ('in_review', 'in_progress', 'completed')
        if new_status not in allowed:
            return jsonify({'error': f'status must be one of: {", ".join(allowed)}'}), 400

        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE test_cases
                    SET story_status = %s
                    WHERE story_id = %s AND workspace_id = %s
                    RETURNING story_id
                """, (new_status, story_id, workspace_id))
                row = cur.fetchone()
                if not row:
                    return jsonify({'error': 'Story not found'}), 404
                conn.commit()

        StoryActivityModel.log(
            workspace_id, story_id, user_id, 'status_changed', {'new_status': new_status}
        )

        return jsonify({'story_id': story_id, 'status': new_status}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Story Kanban collaboration: assignees + activity (Phase 2) ────────────────

@stories_bp.route('/<story_id>/assignees', methods=['GET'])
@dev_jwt_required
def get_story_assignees(story_id):
    workspace_id = get_current_workspace_id()
    try:
        assignees = StoryAssigneesModel.get_assignees(workspace_id, story_id)
        return jsonify({'assignees': assignees}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/assignees', methods=['POST'])
@dev_jwt_required
def add_story_assignee(story_id):
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    data = request.get_json(silent=True) or {}
    target_user_id = data.get('user_id')
    if not target_user_id:
        return jsonify({'error': 'user_id is required'}), 400

    try:
        result = StoryAssigneesModel.assign(workspace_id, story_id, target_user_id, user_id)
        if result is None:
            return jsonify({'error': 'User is not a member of this workspace'}), 403

        StoryActivityModel.log(
            workspace_id, story_id, user_id, 'assignee_added', {'user_id': target_user_id}
        )
        # Phase 5: notify the assignee (best-effort, workspace-scoped).
        try:
            from app.services.notification_service import notify_story_assigned
            story = get_db_service().get_story(story_id, user_id=user_id, workspace_id=workspace_id)
            story_title = (story or {}).get('storyDescription') or (story or {}).get('description') or story_id
            notify_story_assigned(workspace_id, story_id, story_title, target_user_id, user_id)
        except Exception as e:
            print(f"[add_story_assignee] notify skipped: {e}")
        return jsonify({'assignee': result}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/assignees/<target_user_id>', methods=['DELETE'])
@dev_jwt_required
def remove_story_assignee(story_id, target_user_id):
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    try:
        removed = StoryAssigneesModel.remove(workspace_id, story_id, target_user_id)
        if not removed:
            return jsonify({'error': 'Assignment not found'}), 404

        StoryActivityModel.log(
            workspace_id, story_id, user_id, 'assignee_removed', {'user_id': target_user_id}
        )
        return jsonify({'story_id': story_id, 'user_id': target_user_id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/activity', methods=['GET'])
@dev_jwt_required
def get_story_activity(story_id):
    workspace_id = get_current_workspace_id()
    try:
        timeline = StoryActivityModel.get_timeline(workspace_id, story_id)
        return jsonify({'activity': timeline}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Story comments (Phase 3A) ──────────────────────────────────────────────────

@stories_bp.route('/<story_id>/comments', methods=['GET'])
@dev_jwt_required
def get_story_comments(story_id):
    workspace_id = get_current_workspace_id()
    try:
        comments = StoryCommentsModel.list_comments(workspace_id, story_id)
        return jsonify({'comments': comments}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/comments', methods=['POST'])
@dev_jwt_required
def add_story_comment(story_id):
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    data = request.get_json(silent=True) or {}
    body = (data.get('body') or '').strip()
    if not body:
        return jsonify({'error': 'body is required'}), 400

    try:
        comment = StoryCommentsModel.add_comment(workspace_id, story_id, user_id, body)
        StoryActivityModel.log(
            workspace_id, story_id, user_id, 'comment_added', {'comment_id': comment['id']}
        )
        # Phase 5: notify mentioned members + story assignees (best-effort).
        try:
            from app.services.notification_service import notify_mentions, notify_comment
            link = f"{os.environ.get('APP_URL') or os.environ.get('FRONTEND_URL') or 'http://localhost:3000'}/stories/{story_id}"
            mentioned = notify_mentions(workspace_id, user_id, story_id, body, link)
            assignee_ids = [a['user_id'] for a in StoryAssigneesModel.get_assignees(workspace_id, story_id)]
            recipients = [uid for uid in assignee_ids if uid not in mentioned]
            notify_comment(workspace_id, user_id, 'story', story_id, body, link, recipients)
        except Exception as e:
            print(f"[add_story_comment] notify skipped: {e}")
        return jsonify({'comment': comment}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/comments/<comment_id>', methods=['PATCH'])
@dev_jwt_required
def edit_story_comment(story_id, comment_id):
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    data = request.get_json(silent=True) or {}
    body = (data.get('body') or '').strip()
    if not body:
        return jsonify({'error': 'body is required'}), 400

    try:
        comment = StoryCommentsModel.edit_comment(workspace_id, story_id, comment_id, user_id, body)
        if not comment:
            return jsonify({'error': 'Comment not found or not editable by this user'}), 404
        return jsonify({'comment': comment}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/comments/<comment_id>', methods=['DELETE'])
@dev_jwt_required
def delete_story_comment(story_id, comment_id):
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    try:
        deleted = StoryCommentsModel.delete_comment(workspace_id, story_id, comment_id, user_id)
        if not deleted:
            return jsonify({'error': 'Comment not found or not deletable by this user'}), 404

        StoryActivityModel.log(
            workspace_id, story_id, user_id, 'comment_deleted', {'comment_id': comment_id}
        )
        return jsonify({'story_id': story_id, 'comment_id': comment_id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Story version history ─────────────────────────────────────────────────────

@stories_bp.route('/<story_id>/versions', methods=['GET'])
@dev_jwt_required
def get_story_versions(story_id):
    """Return all versions for a story, newest first."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT version_id, story_id, version_number, description,
                           file_name, created_on, run_id
                    FROM story_versions
                    WHERE story_id = %s AND workspace_id = %s
                    ORDER BY version_number DESC
                """, (story_id, workspace_id))
                rows = cur.fetchall()
                versions = []
                for r in rows:
                    d = dict(r)
                    if d.get('created_on'):
                        d['created_on'] = d['created_on'].isoformat()
                    versions.append(d)
        return jsonify({'story_id': story_id, 'versions': versions}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/versions/<int:version_number>/snapshot', methods=['GET'])
@dev_jwt_required
def get_version_snapshot(story_id, version_number):
    """
    Return a complete snapshot for a given version number:
    - story content (from story_versions for historical, from LanceDB for current/latest)
    - test cases filtered to version <= version_number
    - version metadata (description, created_on)

    Used by the version picker in the story workspace so the user can
    browse any past version's story text and its test cases.
    """
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                # ── 1. Get max version so we know if this is "current" ──────────
                cur.execute("""
                    SELECT COALESCE(MAX(version_number), 0) FROM story_versions
                    WHERE story_id = %s AND workspace_id = %s
                """, (story_id, workspace_id))
                max_archived = cur.fetchone()[0]

                # ── 2. Story content ──────────────────────────────────────────────
                # Archived versions are in story_versions; the latest is in LanceDB.
                # "latest" version number = max_archived + 1
                latest_version = max_archived + 1
                is_latest = version_number >= latest_version

                if is_latest:
                    # Fetch from LanceDB
                    try:
                        import lancedb as _ldb
                        _db = _ldb.connect(Config.LANCE_DB_PATH)
                        _table = _db.open_table(Config.TABLE_NAME_LANCE)
                        _rows = _table.to_pandas()
                        _mask = _rows['storyID'] == story_id
                        if 'workspace_id' in _rows.columns:
                            _mask = _mask & (_rows['workspace_id'] == workspace_id)
                        _match = _rows[_mask]
                        story_content = str(_match.iloc[0].get('doc_content_text', '')) if len(_match) > 0 else ''
                        story_description = str(_match.iloc[0].get('storyDescription', '')) if len(_match) > 0 else ''
                    except Exception as le:
                        print(f"[VersionSnapshot] LanceDB read failed: {le}")
                        story_content = ''
                        story_description = ''
                    version_created_on = None
                else:
                    # Fetch from story_versions
                    cur.execute("""
                        SELECT content, description, created_on
                        FROM story_versions
                        WHERE story_id = %s AND workspace_id = %s AND version_number = %s
                    """, (story_id, workspace_id, version_number))
                    row = cur.fetchone()
                    if not row:
                        return jsonify({'error': f'Version {version_number} not found'}), 404
                    story_content = row['content'] or ''
                    story_description = row['description'] or ''
                    version_created_on = row['created_on'].isoformat() if row['created_on'] else None

                    # Fallback: if content is empty (older stories archived before content was stored),
                    # try to get it from test_cases.inputs which stores the original upload
                    if not story_content.strip():
                        cur.execute("""
                            SELECT inputs FROM test_cases
                            WHERE story_id = %s AND workspace_id = %s LIMIT 1
                        """, (story_id, workspace_id))
                        tc_row = cur.fetchone()
                        if tc_row and tc_row['inputs']:
                            import json as _json2
                            inp = tc_row['inputs']
                            if isinstance(inp, str):
                                try: inp = _json2.loads(inp)
                                except: inp = {}
                            story_content = (
                                inp.get('main_text') or
                                inp.get('content') or
                                inp.get('file_content') or
                                ''
                            )
                        # Final fallback: try LanceDB current content
                        if not story_content.strip():
                            try:
                                import lancedb as _ldb2
                                _db2 = _ldb2.connect(Config.LANCE_DB_PATH)
                                _t2 = _db2.open_table(Config.TABLE_NAME_LANCE)
                                _r2 = _t2.to_pandas()
                                _m2 = _r2['storyID'] == story_id
                                if 'workspace_id' in _r2.columns:
                                    _m2 = _m2 & (_r2['workspace_id'] == workspace_id)
                                _match2 = _r2[_m2]
                                if len(_match2) > 0:
                                    story_content = str(_match2.iloc[0].get('doc_content_text', ''))
                            except Exception:
                                pass

                # ── 3. Test cases for this version (version field <= version_number) ─
                cur.execute("""
                    SELECT test_case_json FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                """, (story_id, workspace_id))
                tc_row = cur.fetchone()
                all_tcs = []
                if tc_row and tc_row['test_case_json']:
                    import json as _json
                    tc_data = tc_row['test_case_json']
                    if isinstance(tc_data, str):
                        tc_data = _json.loads(tc_data)
                    all_tcs = tc_data.get('test_cases', [])

                # Filter: TCs that existed when this version was current.
                # When archiving vN, existing TCs get tagged version=N+1 (the next upload number).
                # So "vN's TCs" = TCs with version <= N+1.
                # TCs with no version field default to 1 (original upload).
                tc_version_threshold = version_number + 1
                filtered_tcs = [
                    tc for tc in all_tcs
                    if int(tc.get('version', 1)) <= tc_version_threshold
                ]

        return jsonify({
            'story_id': story_id,
            'version_number': version_number,
            'is_latest': is_latest,
            'story_content': story_content,
            'story_description': story_description,
            'created_on': version_created_on,
            'test_cases': filtered_tcs,
            'test_case_count': len(filtered_tcs),
        }), 200

    except Exception as e:
        print(f"[VersionSnapshot] Error: {e}")
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/compare', methods=['POST'])
@dev_jwt_required
def compare_story_versions(story_id):
    """Compare two versions of a story - returns a structured diff of content and test counts."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json() or {}
        v1 = data.get('version_a')  # version number (int) or 'current'
        v2 = data.get('version_b')

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                # Get version content from story_versions table
                def get_version_content(v):
                    if v == 'current' or v is None:
                        cur.execute("""
                            SELECT tc.story_description as description,
                                   jsonb_array_length(tc.test_case_json->'test_cases') as tc_count,
                                   tc.test_case_json
                            FROM test_cases tc
                            WHERE tc.story_id = %s AND tc.workspace_id = %s
                            ORDER BY tc.created_on DESC LIMIT 1
                        """, (story_id, workspace_id))
                        r = cur.fetchone()
                        if not r: return None
                        return {'label': 'Current', 'description': r['description'] or '', 'tc_count': r['tc_count'] or 0, 'test_cases': (r['test_case_json'] or {}).get('test_cases', [])}
                    else:
                        cur.execute("""
                            SELECT version_number, description, content
                            FROM story_versions
                            WHERE story_id = %s AND workspace_id = %s AND version_number = %s
                        """, (story_id, workspace_id, int(v)))
                        r = cur.fetchone()
                        if not r: return None
                        return {'label': f'v{r["version_number"]}', 'description': r['description'] or '', 'tc_count': 0, 'test_cases': []}

                va = get_version_content(v1)
                vb = get_version_content(v2)

        if not va or not vb:
            return jsonify({'error': 'One or both versions not found'}), 404

        # Simple text diff using difflib
        import difflib
        desc_a = (va['description'] or '').splitlines(keepends=True)
        desc_b = (vb['description'] or '').splitlines(keepends=True)
        diff_lines = list(difflib.unified_diff(desc_a, desc_b, fromfile=va['label'], tofile=vb['label'], lineterm=''))

        # Test case diff - compare titles
        titles_a = {tc.get('title', '') for tc in va['test_cases']}
        titles_b = {tc.get('title', '') for tc in vb['test_cases']}
        added_tests = list(titles_b - titles_a)
        removed_tests = list(titles_a - titles_b)

        return jsonify({
            'version_a': {'label': va['label'], 'tc_count': va['tc_count']},
            'version_b': {'label': vb['label'], 'tc_count': vb['tc_count']},
            'content_diff': diff_lines[:200],  # cap at 200 lines
            'tests_added': added_tests[:20],
            'tests_removed': removed_tests[:20],
            'tc_delta': vb['tc_count'] - va['tc_count'],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/export-code', methods=['GET'])
@dev_jwt_required
def export_code(story_id):
    """Generate framework-specific test code from a story's test cases using LLM."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        fmt = request.args.get('format', 'playwright').lower()
        approved_only = request.args.get('approved_only', 'false').lower() == 'true'

        SUPPORTED = {'playwright', 'cypress', 'pytest', 'bdd', 'selenium', 'postman'}
        if fmt not in SUPPORTED:
            return jsonify({'error': f'Unsupported format: {fmt}'}), 400

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT tc.test_case_json, tc.story_description,
                           tc.inputs->>'page_url' AS page_url,
                           tc.inputs->'dom_snapshot' AS dom_snapshot
                    FROM test_cases tc
                    WHERE tc.story_id = %s AND tc.workspace_id = %s
                    ORDER BY tc.created_on DESC LIMIT 1
                """, (story_id, workspace_id))
                row = cur.fetchone()
                if not row:
                    return jsonify({'error': 'Story not found'}), 404
                tc_json = row['test_case_json']
                story_desc = row['story_description'] or story_id
                if isinstance(tc_json, str):
                    tc_json = json.loads(tc_json)

        cases = tc_json.get('test_cases', [])
        if approved_only:
            cases = [tc for tc in cases if tc.get('status') == 'Approved']
        if not cases:
            return jsonify({'error': 'No test cases to export'}), 404

        page_url = row.get('page_url') or ''
        dom_snapshot = row.get('dom_snapshot') or {}
        if isinstance(dom_snapshot, str):
            try:
                dom_snapshot = json.loads(dom_snapshot)
            except Exception:
                dom_snapshot = {}

        dom_context = ""
        if page_url and dom_snapshot and dom_snapshot.get("elements"):
            elems = dom_snapshot["elements"][:30]
            lines = []
            for e in elems:
                sel = e.get("selector") or "(no stable selector)"
                txt = e.get("text", "")
                tag = e.get("tag", "")
                lines.append(f"  - <{tag}> text={repr(txt)} selector={sel}")
            dom_context = f"""
REAL PAGE STRUCTURE (live-crawled from {page_url}):
Page title: {dom_snapshot.get("page_title", "")}
Interactive elements discovered:
{chr(10).join(lines)}

Use these REAL selectors. For page.goto/cy.visit/driver.get use: {page_url}
"""

        # Build compact test case list for the LLM
        tc_list = '\n'.join([
            f"- [{tc.get('priority','M')}] {tc.get('title','')}:"
            f" Steps: {'; '.join(tc.get('steps',[]))}"
            f" | Expected: {tc.get('expected_result','')}"
            for tc in cases[:30]  # cap at 30 to keep prompt manageable
        ])

        FRAMEWORK_INSTRUCTIONS = {
            'playwright': "TypeScript Playwright tests using @playwright/test. Use test.describe blocks. Use async/await, page.goto, page.fill, page.click, expect().",
            'cypress':    "JavaScript Cypress tests. Use describe/it blocks, cy.visit, cy.get, cy.type, cy.click, cy.should.",
            'pytest':     "Python pytest tests. Use def test_ functions. Use assertions with assert. Add docstrings per test.",
            'bdd':        "Gherkin feature file (BDD). Use Feature/Scenario/Given/When/Then format. One scenario per test case.",
            'selenium':   "Python Selenium WebDriver tests using unittest.TestCase. Use driver.get, driver.find_element, driver.click.",
            'postman':    "Postman Collection JSON v2.1. Include request items with pre-request scripts and test scripts.",
        }

        prompt = f"""Convert these test cases to {fmt.upper()} code.

Story: {story_desc}
{dom_context}
Test cases:
{tc_list}

Instructions: {FRAMEWORK_INSTRUCTIONS[fmt]}

Generate complete, runnable {fmt} test code. Return ONLY the code, no explanation."""

        response = Config.llm.invoke(prompt)
        code = response.content.strip()
        if code.startswith('```'):
            code = code.split('\n', 1)[1] if '\n' in code else code
            code = code.rsplit('```', 1)[0].strip()

        return jsonify({'format': fmt, 'code': code, 'test_count': len(cases)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/crawl', methods=['POST'])
@dev_jwt_required
def crawl_story_url(story_id):
    """Crawl the story page URL to extract real DOM selectors."""
    import re
    from datetime import datetime, timezone
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    try:
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute(
                    "SELECT inputs FROM test_cases WHERE story_id = %s AND workspace_id = %s ORDER BY created_on DESC LIMIT 1",
                    (story_id, workspace_id)
                )
                row = cur.fetchone()
                if not row:
                    return jsonify({"error": "Story not found"}), 404
                inputs = row["inputs"] or {}
                if isinstance(inputs, str):
                    inputs = json.loads(inputs)

        page_url = inputs.get("page_url", "").strip()
        if not page_url:
            return jsonify({"error": "No URL set for this story. Add a URL when uploading."}), 400

        blocked = ["localhost", "127.0.0.1", "0.0.0.0", "::1", "192.168.", "10.", "172.16.", "172.17.", "172.18.", "172.19.", "172.2", "172.3"]
        url_lower = page_url.lower()
        if not url_lower.startswith(("http://", "https://")):
            return jsonify({"error": "URL must start with http:// or https://"}), 400
        for b in blocked:
            if b in url_lower:
                return jsonify({"error": "URL must be publicly accessible. localhost and private IPs cannot be crawled."}), 400

        existing_snapshot = inputs.get("dom_snapshot", {})
        if existing_snapshot and existing_snapshot.get("crawled_at"):
            try:
                crawled_dt = datetime.fromisoformat(existing_snapshot["crawled_at"].replace("Z", "+00:00"))
                age_hours = (datetime.now(timezone.utc) - crawled_dt).total_seconds() / 3600
                if age_hours < 24:
                    return jsonify({
                        "cached": True,
                        "page_title": existing_snapshot.get("page_title", ""),
                        "element_count": len(existing_snapshot.get("elements", [])),
                        "elements": existing_snapshot.get("elements", []),
                        "crawled_at": existing_snapshot["crawled_at"],
                    }), 200
            except Exception:
                pass

        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            return jsonify({"error": "Playwright not available. Contact support."}), 500

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (compatible; TestSurge/1.0; +https://testsurge.kynetropo.com)",
                    viewport={"width": 1280, "height": 800}
                )
                pg = context.new_page()
                pg.set_default_timeout(15000)
                try:
                    pg.goto(page_url, wait_until="networkidle", timeout=20000)
                except Exception as nav_err:
                    browser.close()
                    return jsonify({"error": f"Could not reach {page_url}: {str(nav_err)[:200]}"}), 400

                page_title = pg.title() or page_url

                extract_js = """() => {
                    var results = [];
                    var seen = {};
                    var tags = ['button','input','select','textarea','a[href]','[role="button"]','[data-testid]','[aria-label]','form'];
                    tags.forEach(function(sel) {
                        try {
                            document.querySelectorAll(sel).forEach(function(el) {
                                var selector = null;
                                // Priority: id > data-testid > name > aria-label > type > autocomplete > href
                                if (el.id && el.id.length < 50 && !/^ember|^__/.test(el.id))
                                    selector = '#' + el.id;
                                else if (el.getAttribute('data-testid'))
                                    selector = '[data-testid="' + el.getAttribute('data-testid') + '"]';
                                else if (el.name)
                                    selector = '[name="' + el.name + '"]';
                                else if (el.getAttribute('aria-label'))
                                    selector = '[aria-label="' + el.getAttribute('aria-label') + '"]';
                                else if (el.type && el.type !== 'text' && el.tagName === 'INPUT')
                                    selector = 'input[type="' + el.type + '"]';
                                else if (el.getAttribute('autocomplete'))
                                    selector = '[autocomplete="' + el.getAttribute('autocomplete') + '"]';
                                else if (el.getAttribute('href') && el.tagName === 'A')
                                    selector = 'a[href="' + el.getAttribute('href') + '"]';
                                else if (el.type === 'submit' || el.getAttribute('type') === 'submit')
                                    selector = '[type="submit"]';
                                var text = (el.textContent || el.placeholder || el.getAttribute('aria-label') || el.name || el.id || '').trim().replace(/\\s+/g, ' ').slice(0, 80);
                                var key = selector || (el.tagName + ':' + text);
                                if (!seen[key] && (text || selector)) {
                                    seen[key] = 1;
                                    results.push({
                                        tag: el.tagName.toLowerCase(),
                                        type: el.type || null,
                                        text: text,
                                        selector: selector,
                                        href: el.getAttribute('href') || null
                                    });
                                }
                            });
                        } catch(e) {}
                    });
                    return results.slice(0, 60);
                }"""

                elements = pg.evaluate(extract_js)
                browser.close()

        except Exception as play_err:
            return jsonify({"error": f"Browser error: {str(play_err)[:300]}"}), 500

        snapshot = {
            "page_title": page_title,
            "elements": elements,
            "element_count": len(elements),
            "crawled_at": datetime.now(timezone.utc).isoformat(),
            "url": page_url,
        }

        try:
            with Config.get_postgres_connection() as conn:
                with conn.cursor() as cur:
                    inputs["dom_snapshot"] = snapshot
                    cur.execute(
                        "UPDATE test_cases SET inputs = %s::jsonb WHERE story_id = %s AND workspace_id = %s",
                        (json.dumps(inputs), story_id, workspace_id)
                    )
                    conn.commit()
        except Exception as db_err:
            print(f"[crawl] Cache write failed (non-fatal): {db_err}")

        return jsonify({
            "cached": False,
            "page_title": page_title,
            "element_count": len(elements),
            "elements": elements,
            "crawled_at": snapshot["crawled_at"],
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@stories_bp.route('/<story_id>/regenerate', methods=['POST'])
@dev_jwt_required
def regenerate_tests(story_id):
    """Re-run test case generation for an existing story using its stored content."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        ok, err = _check_permission('can_generate_tests')
        if not ok: return err

        # Fetch existing story content from LanceDB
        db_service = get_db_service()
        story = db_service.get_story(story_id, user_id=user_id, workspace_id=workspace_id)
        if not story:
            return jsonify({'error': f'Story {story_id} not found'}), 404

        import lancedb
        db = lancedb.connect(Config.LANCE_DB_PATH)
        table = db.open_table(Config.TABLE_NAME_LANCE)
        all_rows = table.to_pandas()
        row_data = all_rows[all_rows['storyID'] == story_id]
        if 'workspace_id' in row_data.columns:
            row_data = row_data[row_data['workspace_id'] == workspace_id]
        if row_data.empty:
            return jsonify({'error': 'Story content not found in vector store'}), 404

        project_id = str(row_data.iloc[0].get('project_id', ''))

        # Check and deduct credit before proceeding (skip if workspace has own AI key)
        if not _workspace_has_own_key(workspace_id):
            try:
                from app.models.credits_model import CreditsModel, OutOfCreditsException
                CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="regenerate_tests", story_id=story_id)
            except OutOfCreditsException as e:
                return jsonify({'error': str(e)}), 402
            except Exception as e:
                return jsonify({'error': f'Credit system error: {str(e)}'}), 500

        # Fetch cached quality analysis BEFORE deleting (so the hints survive the DELETE)
        _quality_hints = ""
        try:
            with Config.get_postgres_connection() as _qconn:
                with _qconn.cursor(cursor_factory=psycopg2.extras.DictCursor) as _qcur:
                    _qcur.execute(
                        "SELECT inputs FROM test_cases WHERE story_id = %s AND workspace_id = %s LIMIT 1",
                        (story_id, workspace_id)
                    )
                    _qrow = _qcur.fetchone()
            if _qrow and _qrow['inputs']:
                _inputs = _qrow['inputs'] if isinstance(_qrow['inputs'], dict) else json.loads(_qrow['inputs'])
                _qa = _inputs.get('quality_analysis', {})
                missing = _qa.get('missing_scenarios', []) + _qa.get('missing_validations', [])
                risks = [r.get('area', '') + ': ' + r.get('description', '') for r in _qa.get('risk_areas', []) if r.get('severity') in ('High', 'Medium')]
                recs = _qa.get('recommendations', [])
                if missing or risks or recs:
                    _quality_hints = "=== QUALITY ANALYSIS: GAPS TO COVER ===\n"
                    if missing:
                        _quality_hints += "Missing scenarios (MUST generate test cases for these):\n"
                        _quality_hints += "\n".join(f"- {m}" for m in missing[:5]) + "\n"
                    if risks:
                        _quality_hints += "Risk areas needing test coverage:\n"
                        _quality_hints += "\n".join(f"- {r}" for r in risks[:5]) + "\n"
                    if recs:
                        _quality_hints += "Recommendations:\n"
                        _quality_hints += "\n".join(f"- {r}" for r in recs[:3]) + "\n"
        except Exception as _qe:
            print(f"[regen] Quality hints non-fatal: {_qe}")

        # Delete existing test cases so generation creates fresh ones
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM test_cases WHERE story_id = %s AND workspace_id = %s",
                    (story_id, workspace_id)
                )
                conn.commit()

        # Re-generate
        from app.LLM.Test_case_generator import generate_test_case_for_story
        import threading

        def run_regen():
            generate_test_case_for_story(story_id, user_id=user_id, workspace_id=workspace_id, quality_hints=_quality_hints)
            from app.LLM.impact_analyzer import analyze_test_case_impacts
            try:
                analyze_test_case_impacts(story_id, project_id, user_id=user_id, workspace_id=workspace_id)
            except Exception as e:
                print(f"[Regen] Impact analysis failed: {e}")
            try:
                from app.models.notification_model import NotificationModel
                NotificationModel.broadcast_to_workspace(
                    workspace_id=workspace_id,
                    event_type=NotificationModel.TESTS_GENERATED,
                    title='Test cases generated',
                    body=f'Test cases were generated for a story',
                    actor_id=user_id,
                    entity_id=story_id,
                    entity_type='story',
                    exclude_user_id=user_id,
                )
            except Exception: pass

        threading.Thread(target=run_regen, daemon=True).start()

        return jsonify({
            'message': 'Test regeneration started',
            'story_id': story_id,
            'project_id': project_id,
        }), 202

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Per-test-case CRUD endpoints ─────────────────────────────────────────────

@stories_bp.route('/<story_id>/testcases/<test_case_id>/status', methods=['PATCH'])
@dev_jwt_required
def update_test_case_status(story_id, test_case_id):
    """Approve or reject a single test case."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        ok, err = _check_permission('can_edit_tests')
        if not ok: return err
        data = request.get_json()
        new_status = data.get('status')
        if new_status not in ('Approved', 'Pending', 'Rejected'):
            return jsonify({'error': 'status must be Approved, Pending or Rejected'}), 400

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT test_case_json FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                    ORDER BY created_on DESC LIMIT 1
                """, (story_id, workspace_id))
                row = cur.fetchone()
                if not row:
                    return jsonify({'error': 'Story not found'}), 404
                tc_json = row['test_case_json']
                if isinstance(tc_json, str):
                    tc_json = json.loads(tc_json)

                cases = tc_json.get('test_cases', [])
                updated = False
                for tc in cases:
                    if tc.get('id') == test_case_id:
                        tc['status'] = new_status
                        updated = True
                        break
                if not updated:
                    return jsonify({'error': 'Test case not found'}), 404

                cur.execute("""
                    UPDATE test_cases SET test_case_json = %s
                    WHERE story_id = %s AND workspace_id = %s
                """, (json.dumps(tc_json), story_id, workspace_id))
                conn.commit()
                # Log activity
                try:
                    from app.routes.activity import log_activity
                    log_activity(workspace_id, user_id, 'tests_generated',
                                 f'Test case {new_status.lower()}',
                                 body=f'{test_case_id} status changed to {new_status}',
                                 story_id=story_id)
                except Exception: pass

        return jsonify({'test_case_id': test_case_id, 'status': new_status}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _find_test_case_in_story(story_id, workspace_id, test_case_id):
    """Return the single test case dict (from test_case_json) matching test_case_id
    within this story+workspace, or None. Used to enrich notifications/drawer."""
    try:
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT test_case_json FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                    ORDER BY created_on DESC LIMIT 1
                """, (story_id, workspace_id))
                row = cur.fetchone()
                if not row:
                    return None
                tc_json = row['test_case_json']
                if isinstance(tc_json, str):
                    tc_json = json.loads(tc_json)
                for tc in tc_json.get('test_cases', []):
                    if tc.get('id') == test_case_id:
                        return tc
    except Exception:
        return None
    return None


# ─── Test Case Kanban execution status (Sprint 1 Phase 2) ─────────────────────
# Distinct from the approve/reject "status" field. tc_status backs the Test Case
# Kanban (To Do / In Progress / Done) and is stored inside the test case's JSON
# object so it travels with the test case and survives refresh.

@stories_bp.route('/<story_id>/testcases/<test_case_id>/tc-status', methods=['PATCH'])
@dev_jwt_required
def update_test_case_kanban_status(story_id, test_case_id):
    """Persist the Test Case Kanban column (todo / in_progress / done)."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json(silent=True) or {}
        new_status = data.get('tc_status')
        allowed = ('todo', 'in_progress', 'done')
        if new_status not in allowed:
            return jsonify({'error': f'tc_status must be one of: {", ".join(allowed)}'}), 400

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT test_case_json FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                    ORDER BY created_on DESC LIMIT 1
                """, (story_id, workspace_id))
                row = cur.fetchone()
                if not row:
                    return jsonify({'error': 'Story not found'}), 404
                tc_json = row['test_case_json']
                if isinstance(tc_json, str):
                    tc_json = json.loads(tc_json)

                updated = False
                for tc in tc_json.get('test_cases', []):
                    if tc.get('id') == test_case_id:
                        tc['tc_status'] = new_status
                        updated = True
                        break
                if not updated:
                    return jsonify({'error': 'Test case not found'}), 404

                cur.execute("""
                    UPDATE test_cases SET test_case_json = %s
                    WHERE story_id = %s AND workspace_id = %s
                """, (json.dumps(tc_json), story_id, workspace_id))
                conn.commit()

        TestCaseActivityModel.log(
            workspace_id, story_id, test_case_id, user_id,
            'kanban_status_changed', {'tc_status': new_status},
        )
        return jsonify({'test_case_id': test_case_id, 'tc_status': new_status}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ─── Test Case collaboration: assignees + activity + comments (Sprint 1 Phase 1) ──

@stories_bp.route('/<story_id>/testcases/<test_case_id>/assignees', methods=['GET'])
@dev_jwt_required
def get_test_case_assignees(story_id, test_case_id):
    workspace_id = get_current_workspace_id()
    try:
        return jsonify({'assignees': TestCaseAssigneesModel.get_assignees(workspace_id, test_case_id)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>/assignees', methods=['POST'])
@dev_jwt_required
def add_test_case_assignee(story_id, test_case_id):
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    data = request.get_json(silent=True) or {}
    target_user_id = data.get('user_id')
    if not target_user_id:
        return jsonify({'error': 'user_id is required'}), 400
    try:
        result = TestCaseAssigneesModel.assign(workspace_id, story_id, test_case_id, target_user_id, user_id)
        if result is None:
            return jsonify({'error': 'User is not a member of this workspace'}), 403

        TestCaseActivityModel.log(
            workspace_id, story_id, test_case_id, user_id, 'assignee_added', {'user_id': target_user_id}
        )
        # Phase 5: notify the assignee (best-effort, workspace-scoped).
        try:
            from app.services.notification_service import notify_test_case_assigned
            tc = _find_test_case_in_story(story_id, workspace_id, test_case_id)
            notify_test_case_assigned(
                workspace_id, story_id, test_case_id,
                (tc or {}).get('title'), target_user_id, user_id,
            )
        except Exception as e:
            print(f"[add_test_case_assignee] notify skipped: {e}")
        return jsonify({'assignee': result}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>/assignees/<target_user_id>', methods=['DELETE'])
@dev_jwt_required
def remove_test_case_assignee(story_id, test_case_id, target_user_id):
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    try:
        removed = TestCaseAssigneesModel.remove(workspace_id, test_case_id, target_user_id)
        if not removed:
            return jsonify({'error': 'Assignment not found'}), 404
        TestCaseActivityModel.log(
            workspace_id, story_id, test_case_id, user_id, 'assignee_removed', {'user_id': target_user_id}
        )
        return jsonify({'test_case_id': test_case_id, 'user_id': target_user_id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>/activity', methods=['GET'])
@dev_jwt_required
def get_test_case_activity(story_id, test_case_id):
    workspace_id = get_current_workspace_id()
    try:
        return jsonify({'activity': TestCaseActivityModel.get_timeline(workspace_id, test_case_id)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>/comments', methods=['GET'])
@dev_jwt_required
def get_test_case_comments(story_id, test_case_id):
    workspace_id = get_current_workspace_id()
    try:
        return jsonify({'comments': TestCaseCommentsModel.list_comments(workspace_id, test_case_id)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>/comments', methods=['POST'])
@dev_jwt_required
def add_test_case_comment(story_id, test_case_id):
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    data = request.get_json(silent=True) or {}
    body = (data.get('body') or '').strip()
    if not body:
        return jsonify({'error': 'body is required'}), 400
    try:
        comment = TestCaseCommentsModel.add_comment(workspace_id, story_id, test_case_id, user_id, body)
        TestCaseActivityModel.log(
            workspace_id, story_id, test_case_id, user_id, 'comment_added', {'comment_id': comment['id']}
        )
        # Phase 5: notify mentioned members + test-case assignees (best-effort).
        try:
            from app.services.notification_service import notify_mentions, notify_comment
            link = f"{os.environ.get('APP_URL') or os.environ.get('FRONTEND_URL') or 'http://localhost:3000'}/stories/{story_id}?tc={test_case_id}"
            mentioned = notify_mentions(workspace_id, user_id, test_case_id, body, link)
            assignee_ids = [a['user_id'] for a in TestCaseAssigneesModel.get_assignees(workspace_id, test_case_id)]
            recipients = [uid for uid in assignee_ids if uid not in mentioned]
            notify_comment(workspace_id, user_id, 'test case', test_case_id, body, link, recipients)
        except Exception as e:
            print(f"[add_test_case_comment] notify skipped: {e}")
        return jsonify({'comment': comment}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>/comments/<comment_id>', methods=['PATCH'])
@dev_jwt_required
def edit_test_case_comment(story_id, test_case_id, comment_id):
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    data = request.get_json(silent=True) or {}
    body = (data.get('body') or '').strip()
    if not body:
        return jsonify({'error': 'body is required'}), 400
    try:
        comment = TestCaseCommentsModel.edit_comment(workspace_id, test_case_id, comment_id, user_id, body)
        if not comment:
            return jsonify({'error': 'Comment not found or not editable by this user'}), 404
        return jsonify({'comment': comment}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>/comments/<comment_id>', methods=['DELETE'])
@dev_jwt_required
def delete_test_case_comment(story_id, test_case_id, comment_id):
    user_id = get_current_user_id()
    workspace_id = get_current_workspace_id()
    try:
        deleted = TestCaseCommentsModel.delete_comment(workspace_id, test_case_id, comment_id, user_id)
        if not deleted:
            return jsonify({'error': 'Comment not found or not deletable by this user'}), 404
        TestCaseActivityModel.log(
            workspace_id, story_id, test_case_id, user_id, 'comment_deleted', {'comment_id': comment_id}
        )
        return jsonify({'test_case_id': test_case_id, 'comment_id': comment_id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>', methods=['PATCH'])
@dev_jwt_required
def update_test_case(story_id, test_case_id):
    """Edit a single test case (title, steps, expected_result, priority)."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json()

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT test_case_json FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                    ORDER BY created_on DESC LIMIT 1
                """, (story_id, workspace_id))
                row = cur.fetchone()
                if not row:
                    return jsonify({'error': 'Story not found'}), 404
                tc_json = row['test_case_json']
                if isinstance(tc_json, str):
                    tc_json = json.loads(tc_json)

                cases = tc_json.get('test_cases', [])
                updated = False
                for tc in cases:
                    if tc.get('id') == test_case_id:
                        if 'title' in data:
                            tc['title'] = data['title']
                        if 'steps' in data:
                            tc['steps'] = data['steps']
                        if 'expected_result' in data:
                            tc['expected_result'] = data['expected_result']
                        if 'priority' in data:
                            tc['priority'] = data['priority']
                        updated = True
                        break
                if not updated:
                    return jsonify({'error': 'Test case not found'}), 404

                cur.execute("""
                    UPDATE test_cases SET test_case_json = %s
                    WHERE story_id = %s AND workspace_id = %s
                """, (json.dumps(tc_json), story_id, workspace_id))
                conn.commit()

        return jsonify({'test_case_id': test_case_id, 'updated': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>', methods=['DELETE'])
@dev_jwt_required
def delete_test_case(story_id, test_case_id):
    """Delete a single test case from the story."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        ok, err = _check_permission('can_edit_tests')
        if not ok: return err

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT test_case_json FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                    ORDER BY created_on DESC LIMIT 1
                """, (story_id, workspace_id))
                row = cur.fetchone()
                if not row:
                    return jsonify({'error': 'Story not found'}), 404
                tc_json = row['test_case_json']
                if isinstance(tc_json, str):
                    tc_json = json.loads(tc_json)

                cases = tc_json.get('test_cases', [])
                original_len = len(cases)
                cases = [tc for tc in cases if tc.get('id') != test_case_id]
                if len(cases) == original_len:
                    return jsonify({'error': 'Test case not found'}), 404

                tc_json['test_cases'] = cases
                cur.execute("""
                    UPDATE test_cases SET test_case_json = %s
                    WHERE story_id = %s AND workspace_id = %s
                """, (json.dumps(tc_json), story_id, workspace_id))
                conn.commit()

        return jsonify({'deleted': test_case_id, 'remaining': len(cases)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>/regenerate', methods=['POST'])
@dev_jwt_required
def regenerate_single_test_case(story_id, test_case_id):
    """Regenerate a single test case with optional user instructions and extra context doc."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        ok, err = _check_permission('can_edit_tests')
        if not ok: return err

        # Accept multipart (file attachment) or JSON
        if request.content_type and 'multipart/form-data' in request.content_type:
            instructions = request.form.get('instructions', '').strip()
            extra_file = request.files.get('file')
            extra_context = ''
            if extra_file:
                try:
                    from app.datapipeline.text_extractor import extract_text
                    import os, tempfile
                    file_ext = os.path.splitext(extra_file.filename or '')[1].lower()
                    with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
                        extra_file.save(tmp.name)
                        extra_context = extract_text(tmp.name) or ''
                    os.unlink(tmp.name)
                except Exception as e:
                    extra_context = ''
        else:
            data = request.get_json() or {}
            instructions = data.get('instructions', '').strip()
            extra_context = data.get('extra_context', '').strip()

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT test_case_json, story_description FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                    ORDER BY created_on DESC LIMIT 1
                """, (story_id, workspace_id))
                row = cur.fetchone()
                if not row:
                    return jsonify({'error': 'Story not found'}), 404
                tc_json = row['test_case_json']
                story_desc = row['story_description'] or ''
                if isinstance(tc_json, str):
                    tc_json = json.loads(tc_json)

                cases = tc_json.get('test_cases', [])
                target_tc = next((tc for tc in cases if tc.get('id') == test_case_id), None)
                if not target_tc:
                    return jsonify({'error': 'Test case not found'}), 404

        try:
            from app.models.credits_model import CreditsModel, OutOfCreditsException
            CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="regenerate_test_case", story_id=story_id)
        except OutOfCreditsException as e:
            return jsonify({'error': str(e)}), 402
        except Exception as e:
            return jsonify({'error': f'Credit system error: {str(e)}'}), 500

        # Get story content from LanceDB for richer context
        import lancedb
        story_content = story_desc
        try:
            db = lancedb.connect(Config.LANCE_DB_PATH)
            table = db.open_table(Config.TABLE_NAME_LANCE)
            df = table.to_pandas()
            story_rows = df[df['storyID'] == story_id]
            if not story_rows.empty:
                story_content = str(story_rows.iloc[0].get('doc_content_text', story_desc) or story_desc)
        except Exception:
            pass

        # Build prompt to regenerate this specific test case
        # Sanitize: strip prompt injection attempts (limit length, remove system-like directives)
        if instructions:
            instructions = instructions[:500]  # hard cap
            # Remove common injection patterns
            import re as _re
            instructions = _re.sub(r'(?i)(ignore (all |previous |above |prior )?instructions?|system prompt|you are now|forget everything|disregard)', '[removed]', instructions)
        instructions_section = f"\n\nUser instructions for improvement:\n{instructions}" if instructions else ""
        extra_context_section = f"\n\nAdditional context from attached document:\n{extra_context[:2000]}" if extra_context else ""

        # ── RAG: pull similar stories + existing TCs for context ──────────────
        rag_section = ""
        try:
            from app.LLM.rag_context import build_rag_context, format_rag_context_for_prompt
            query = instructions or target_tc.get('title', '') or story_content[:300]
            ctx = build_rag_context(
                story_id=story_id,
                workspace_id=workspace_id,
                query_text=query,
                top_k=3,
            )
            # Use the full story content from RAG if we didn't get it earlier
            if ctx["story_content"] and not story_content:
                story_content = ctx["story_content"]
            rag_text = format_rag_context_for_prompt(ctx, max_examples=2)
            if rag_text:
                rag_section = f"\n\n{rag_text}"
        except Exception as rag_err:
            print(f"[regen] RAG context failed (non-fatal): {rag_err}")

        prompt = f"""You are an expert QA engineer. Given the following user story, rewrite and improve this specific test case.

User Story:
{story_content}

Existing test case to improve:
- Title: {target_tc.get('title', '')}
- Steps: {json.dumps(target_tc.get('steps', []))}
- Expected Result: {target_tc.get('expected_result', '')}
- Priority: {target_tc.get('priority', 'Medium')}{instructions_section}{extra_context_section}{rag_section}

Write an improved version with clearer, more specific steps and a precise expected result.
Return ONLY valid JSON, no other text:
{{
  "title": "improved title",
  "steps": ["step 1", "step 2", "step 3"],
  "expected_result": "specific expected result",
  "priority": "{target_tc.get('priority', 'Medium')}"
}}"""

        response = Config.llm.invoke(prompt)
        raw = response.content.strip()
        if '```json' in raw:
            raw = raw.split('```json')[1].split('```')[0].strip()
        elif '```' in raw:
            raw = raw.split('```')[1].strip()
        start = raw.find('{')
        end = raw.rfind('}') + 1
        improved = json.loads(raw[start:end])

        # Update the test case in place
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                for tc in cases:
                    if tc.get('id') == test_case_id:
                        tc['title'] = improved.get('title', tc['title'])
                        tc['steps'] = improved.get('steps', tc.get('steps', []))
                        tc['expected_result'] = improved.get('expected_result', tc.get('expected_result', ''))
                        tc['priority'] = improved.get('priority', tc.get('priority', 'Medium'))
                        tc['status'] = 'Pending'
                        break
                tc_json['test_cases'] = cases
                cur.execute("""
                    UPDATE test_cases SET test_case_json = %s
                    WHERE story_id = %s AND workspace_id = %s
                """, (json.dumps(tc_json), story_id, workspace_id))
                conn.commit()

        updated_tc = next((tc for tc in cases if tc.get('id') == test_case_id), {})
        return jsonify({'test_case_id': test_case_id, 'test_case': updated_tc}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/bulk-regenerate', methods=['POST'])
@dev_jwt_required
def bulk_regenerate_test_cases(story_id):
    """Regenerate multiple test cases with shared RAG context, instructions, and optional doc."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        ok, err = _check_permission('can_edit_tests')
        if not ok: return err

        # Accept multipart (file) or JSON
        if request.content_type and 'multipart/form-data' in request.content_type:
            instructions = request.form.get('instructions', '').strip()
            test_case_ids = request.form.getlist('test_case_ids')
            extra_file = request.files.get('file')
            extra_context = ''
            if extra_file:
                try:
                    from app.datapipeline.text_extractor import extract_text
                    import os, tempfile
                    file_ext = os.path.splitext(extra_file.filename or '')[1].lower()
                    with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
                        extra_file.save(tmp.name)
                        extra_context = extract_text(tmp.name) or ''
                    os.unlink(tmp.name)
                except Exception:
                    pass
        else:
            data = request.get_json() or {}
            instructions = data.get('instructions', '').strip()
            test_case_ids = data.get('test_case_ids', [])
            extra_context = data.get('extra_context', '').strip()

        if instructions:
            instructions = instructions[:500]
            import re as _re_bulk
            instructions = _re_bulk.sub(
                r'(?i)(ignore (all |previous |above |prior )?instructions?|system prompt|you are now|forget everything|disregard)',
                '[removed]',
                instructions
            )

        if not test_case_ids:
            return jsonify({'error': 'test_case_ids required'}), 400

        # Load all test cases
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT test_case_json, story_description FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                    ORDER BY created_on DESC LIMIT 1
                """, (story_id, workspace_id))
                row = cur.fetchone()
                if not row:
                    return jsonify({'error': 'Story not found'}), 404
                tc_json = row['test_case_json']
                story_desc = row['story_description'] or ''
                if isinstance(tc_json, str):
                    tc_json = json.loads(tc_json)
                cases = tc_json.get('test_cases', [])

        try:
            from app.models.credits_model import CreditsModel, OutOfCreditsException
            CreditsModel.check_and_deduct_credit(
                workspace_id, user_id, action="bulk_regenerate_test_cases",
                amount=len(test_case_ids), story_id=story_id,
            )
        except OutOfCreditsException as e:
            return jsonify({'error': str(e)}), 402
        except Exception as e:
            return jsonify({'error': f'Credit system error: {str(e)}'}), 500

        # Build RAG context once for all TCs
        story_content = story_desc
        rag_section = ""
        try:
            from app.LLM.rag_context import build_rag_context, format_rag_context_for_prompt
            import lancedb as _ldb
            _db = _ldb.connect(Config.LANCE_DB_PATH)
            _t = _db.open_table(Config.TABLE_NAME_LANCE)
            _df = _t.to_pandas()
            _rows = _df[_df['storyID'] == story_id]
            if not _rows.empty:
                story_content = str(_rows.iloc[0].get('doc_content_text', story_desc) or story_desc)
            query = instructions or story_content[:300]
            ctx = build_rag_context(story_id=story_id, workspace_id=workspace_id, query_text=query, top_k=3)
            rag_section = format_rag_context_for_prompt(ctx, max_examples=2)
        except Exception as e:
            print(f"[bulk_regen] RAG context failed: {e}")

        instructions_section = f"\n\nUser instructions:\n{instructions}" if instructions else ""
        extra_context_section = f"\n\nAdditional context from document:\n{extra_context[:2000]}" if extra_context else ""
        rag_block = f"\n\n{rag_section}" if rag_section else ""

        # Regenerate each selected test case
        updated = []
        for tc in cases:
            if tc.get('id') not in test_case_ids:
                continue
            try:
                prompt = f"""You are an expert QA engineer. Rewrite and improve this test case for the given user story.

User Story:
{story_content[:2000]}

Test case to improve:
- Title: {tc.get('title', '')}
- Steps: {json.dumps(tc.get('steps', []))}
- Expected Result: {tc.get('expected_result', '')}
- Priority: {tc.get('priority', 'Medium')}{instructions_section}{extra_context_section}{rag_block}

Return ONLY valid JSON, no other text:
{{
  "title": "improved title",
  "steps": ["step 1", "step 2", "step 3"],
  "expected_result": "specific expected result",
  "priority": "{tc.get('priority', 'Medium')}"
}}"""
                response = Config.llm.invoke(prompt)
                raw = response.content.strip()
                if '```json' in raw:
                    raw = raw.split('```json')[1].split('```')[0].strip()
                elif '```' in raw:
                    raw = raw.split('```')[1].strip()
                start, end = raw.find('{'), raw.rfind('}') + 1
                improved = json.loads(raw[start:end])
                tc['title'] = improved.get('title', tc['title'])
                tc['steps'] = improved.get('steps', tc.get('steps', []))
                tc['expected_result'] = improved.get('expected_result', tc.get('expected_result', ''))
                tc['priority'] = improved.get('priority', tc.get('priority', 'Medium'))
                tc['status'] = 'Pending'
                tc['_regen_success'] = True
                updated.append(tc)
            except Exception as e:
                print(f"[bulk_regen] TC {tc.get('id')} failed: {e}")
                tc['_regen_success'] = False
                updated.append(tc)  # keep original on failure

        # Persist
        tc_json['test_cases'] = cases
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE test_cases SET test_case_json = %s
                    WHERE story_id = %s AND workspace_id = %s
                """, (json.dumps(tc_json), story_id, workspace_id))
                conn.commit()

        return jsonify({
            'updated': [tc.get('id') for tc in updated if tc.get('_regen_success')],
            'failed': [tc.get('id') for tc in updated if not tc.get('_regen_success')],
            'test_cases': [{k: v for k, v in tc.items() if k != '_regen_success'} for tc in updated]
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>/refine', methods=['POST'])
@dev_jwt_required
def refine_test_case(story_id, test_case_id):
    """Iterative refinement - user reviews regenerated result and asks for more changes."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()

        if request.content_type and 'multipart/form-data' in request.content_type:
            instructions = request.form.get('instructions', '').strip()
            current_title = request.form.get('current_title', '')
            current_steps = json.loads(request.form.get('current_steps', '[]'))
            current_expected = request.form.get('current_expected', '')
            current_priority = request.form.get('current_priority', 'Medium')
            extra_file = request.files.get('file')
            extra_context = ''
            if extra_file:
                try:
                    from app.datapipeline.text_extractor import extract_text
                    import os, tempfile
                    file_ext = os.path.splitext(extra_file.filename or '')[1].lower()
                    with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as tmp:
                        extra_file.save(tmp.name)
                        extra_context = extract_text(tmp.name) or ''
                    os.unlink(tmp.name)
                except Exception:
                    pass
        else:
            data = request.get_json() or {}
            instructions = data.get('instructions', '').strip()
            current_title = data.get('current_title', '')
            current_steps = data.get('current_steps', [])
            current_expected = data.get('current_expected', '')
            current_priority = data.get('current_priority', 'Medium')
            extra_context = data.get('extra_context', '').strip()

        if not instructions:
            return jsonify({'error': 'instructions required for refine'}), 400

        try:
            from app.models.credits_model import CreditsModel, OutOfCreditsException
            CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="refine_test_case", story_id=story_id)
        except OutOfCreditsException as e:
            return jsonify({'error': str(e)}), 402
        except Exception as e:
            return jsonify({'error': f'Credit system error: {str(e)}'}), 500

        # Get story content
        story_content = ''
        try:
            import lancedb as _ldb
            _db = _ldb.connect(Config.LANCE_DB_PATH)
            _t = _db.open_table(Config.TABLE_NAME_LANCE)
            _df = _t.to_pandas()
            _rows = _df[_df['storyID'] == story_id]
            if not _rows.empty:
                story_content = str(_rows.iloc[0].get('doc_content_text', '') or '')
        except Exception:
            pass

        extra_block = f"\n\nExtra context:\n{extra_context[:1500]}" if extra_context else ""

        prompt = f"""You are an expert QA engineer. The user reviewed this test case and wants specific changes.

User Story:
{story_content[:2000]}

Current test case (already improved from original):
- Title: {current_title}
- Steps: {json.dumps(current_steps)}
- Expected Result: {current_expected}
- Priority: {current_priority}

User's refinement request: {instructions}{extra_block}

Apply ONLY the changes the user requested. Keep everything else the same.
Return ONLY valid JSON, no other text:
{{
  "title": "title",
  "steps": ["step 1", "step 2"],
  "expected_result": "expected result",
  "priority": "{current_priority}"
}}"""

        response = Config.llm.invoke(prompt)
        raw = response.content.strip()
        if '```json' in raw:
            raw = raw.split('```json')[1].split('```')[0].strip()
        elif '```' in raw:
            raw = raw.split('```')[1].strip()
        start, end = raw.find('{'), raw.rfind('}') + 1
        refined = json.loads(raw[start:end])

        return jsonify({'test_case_id': test_case_id, 'test_case': refined}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/regroup', methods=['POST'])
@dev_jwt_required
def regroup_test_cases(story_id):
    """Re-run AI group assignment on all test cases for a story."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT test_case_json, story_description FROM test_cases
                    WHERE story_id = %s AND workspace_id = %s
                    ORDER BY created_on DESC LIMIT 1
                """, (story_id, workspace_id))
                row = cur.fetchone()
                if not row:
                    return jsonify({'error': 'Story not found'}), 404
                tc_json = row['test_case_json']
                story_desc = row['story_description'] or ''
                if isinstance(tc_json, str):
                    tc_json = json.loads(tc_json)

                cases = tc_json.get('test_cases', [])
                grouping_prompt = (request.get_json(silent=True) or {}).get('grouping_prompt', '')

                try:
                    from app.models.credits_model import CreditsModel, OutOfCreditsException
                    CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="regroup_test_cases", story_id=story_id)
                except OutOfCreditsException as e:
                    return jsonify({'error': str(e)}), 402
                except Exception as e:
                    return jsonify({'error': f'Credit system error: {str(e)}'}), 500

                from app.LLM.Test_case_generator import assign_groups
                assign_groups(cases, story_desc, grouping_prompt=grouping_prompt)
                tc_json['test_cases'] = cases

                cur.execute("""
                    UPDATE test_cases SET test_case_json = %s
                    WHERE story_id = %s AND workspace_id = %s
                """, (json.dumps(tc_json), story_id, workspace_id))
                conn.commit()

        return jsonify({'story_id': story_id, 'groups': list({tc.get('group','General') for tc in cases})}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Test Case Execution Runs (Pass/Fail/Skip) ─────────────────────────────────

@stories_bp.route('/<story_id>/testcases/<test_case_id>/run', methods=['POST'])
@dev_jwt_required
def record_test_run(story_id, test_case_id):
    """Record a Pass/Fail/Skip execution result for a test case with optional comment."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json() or {}
        run_status = data.get('run_status', '').lower()
        comment = (data.get('comment') or '').strip() or None

        if run_status not in ('pass', 'fail', 'skip'):
            return jsonify({'error': 'run_status must be pass, fail, or skip'}), 400

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    INSERT INTO test_case_runs
                        (workspace_id, story_id, test_case_id, run_status, comment, run_by)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    RETURNING id, run_status, comment, run_at
                """, (workspace_id, story_id, test_case_id, run_status, comment, user_id))
                row = dict(cur.fetchone())
                row['run_at'] = row['run_at'].isoformat() if row.get('run_at') else None
                conn.commit()
                # Log activity
                try:
                    from app.routes.activity import log_activity
                    log_activity(workspace_id, user_id, 'tests_generated',
                                 f'Test run recorded: {run_status}',
                                 body=comment or f'{run_status} on {test_case_id}',
                                 story_id=story_id)
                except Exception: pass

        return jsonify({'run': row}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/testcases/<test_case_id>/runs', methods=['GET'])
@dev_jwt_required
def get_test_runs(story_id, test_case_id):
    """Get execution run history for a test case (most recent first)."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT r.id, r.run_status, r.comment, r.run_at,
                           u.email as run_by_email,
                           COALESCE(u.display_name, u.full_name, u.email) as run_by_name
                    FROM test_case_runs r
                    JOIN users u ON r.run_by = u.user_id
                    WHERE r.workspace_id = %s AND r.story_id = %s AND r.test_case_id = %s
                    ORDER BY r.run_at DESC
                    LIMIT 20
                """, (workspace_id, story_id, test_case_id))
                runs = []
                for r in cur.fetchall():
                    d = dict(r)
                    if d.get('run_at'):
                        d['run_at'] = d['run_at'].isoformat()
                    runs.append(d)

        # Latest run status
        latest = runs[0] if runs else None
        return jsonify({'runs': runs, 'latest': latest}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _smart_version_pipeline(story_id, project_id, user_id, workspace_id, old_doc, new_doc, version_number):
    """
    Smart versioned test case pipeline for upload-new-version.

    Strategy:
    1. LLM diff old_doc vs new_doc → find NEW and CHANGED requirements
    2. For NEW requirements → generate new test cases, append with version tag
    3. For CHANGED requirements → create impact records so user can Accept/Reject
    4. Never delete existing test cases (they carry version=prev tag)
    """
    import json as _json

    # ── Step 0: Tag all existing test cases with their current version ─────────
    with Config.get_postgres_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
            cur.execute(
                "SELECT test_case_json FROM test_cases WHERE story_id = %s AND workspace_id = %s",
                (story_id, workspace_id)
            )
            row = cur.fetchone()
            existing_tc_json = row['test_case_json'] if row else {}
            if isinstance(existing_tc_json, str):
                existing_tc_json = _json.loads(existing_tc_json)

    existing_cases = existing_tc_json.get('test_cases', [])
    prev_version = version_number - 1 if version_number > 1 else 1

    # Tag each existing TC with its version if not already tagged
    modified = False
    for tc in existing_cases:
        if 'version' not in tc:
            tc['version'] = prev_version
            modified = True

    if modified and existing_cases:
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                existing_tc_json['test_cases'] = existing_cases
                cur.execute(
                    "UPDATE test_cases SET test_case_json = %s WHERE story_id = %s AND workspace_id = %s",
                    (_json.dumps(existing_tc_json), story_id, workspace_id)
                )
                conn.commit()

    # ── Step 1: LLM diff - find new and changed requirements ──────────────────
    # If old_doc is empty (first upload had no stored content) fall back to full regen
    if not old_doc or not old_doc.strip():
        print(f"[SmartVersion] No old doc available for {story_id}, running full regen")
        from app.LLM.Test_case_generator import generate_test_case_for_story
        generate_test_case_for_story(story_id, user_id=user_id, workspace_id=workspace_id)
        return

    existing_titles = [tc.get('title', '') for tc in existing_cases]
    existing_summary = '\n'.join(f"- {t}" for t in existing_titles[:30]) if existing_titles else "(none yet)"

    diff_prompt = f"""You are a requirements analyst. Compare an OLD and NEW version of a user story document.

OLD DOCUMENT:
{old_doc[:3000]}

NEW DOCUMENT:
{new_doc[:3000]}

EXISTING TEST CASES (already generated, do NOT re-generate these):
{existing_summary}

Identify:
1. "new_requirements" - requirements that exist only in the NEW doc (not in OLD)
2. "changed_requirements" - requirements present in both docs but with meaningful scope/behavior change

Return ONLY valid JSON with this exact structure:
{{
  "new_requirements": [
    "Requirement text 1",
    "Requirement text 2"
  ],
  "changed_requirements": [
    {{
      "old_text": "old requirement wording",
      "new_text": "new requirement wording",
      "change_summary": "brief description of what changed"
    }}
  ]
}}

Return empty arrays if nothing changed. Do not include minor wording changes."""

    try:
        diff_response = Config.llm.invoke(diff_prompt)
        raw = diff_response.content.strip()
        if '```json' in raw:
            raw = raw.split('```json')[1].split('```')[0].strip()
        elif '```' in raw:
            raw = raw.split('```')[1].strip()
        start, end = raw.find('{'), raw.rfind('}') + 1
        diff_result = _json.loads(raw[start:end])
    except Exception as e:
        print(f"[SmartVersion] Diff LLM failed: {e}, running full regen")
        from app.LLM.Test_case_generator import generate_test_case_for_story
        generate_test_case_for_story(story_id, user_id=user_id, workspace_id=workspace_id)
        return

    new_reqs = diff_result.get('new_requirements', [])
    changed_reqs = diff_result.get('changed_requirements', [])

    print(f"[SmartVersion] {story_id}: {len(new_reqs)} new reqs, {len(changed_reqs)} changed reqs")

    # ── Step 2: Generate test cases for new requirements only ─────────────────
    if new_reqs:
        new_req_text = '\n'.join(f"- {r}" for r in new_reqs)
        gen_prompt = f"""You are a QA engineer. Generate test cases for ONLY these NEW requirements.

Story context (full document for reference):
{new_doc[:2000]}

NEW REQUIREMENTS to generate tests for:
{new_req_text}

Existing test cases (DO NOT duplicate):
{existing_summary}

Generate comprehensive test cases covering positive, negative, boundary, and security scenarios.
Return ONLY valid JSON:
{{
  "test_cases": [
    {{
      "id": "TC-NEW-1",
      "title": "test case title",
      "steps": ["step 1", "step 2", "step 3"],
      "expected_result": "expected outcome",
      "priority": "High",
      "type": "Functional"
    }}
  ]
}}"""

        try:
            gen_response = Config.llm.invoke(gen_prompt)
            raw = gen_response.content.strip()
            if '```json' in raw:
                raw = raw.split('```json')[1].split('```')[0].strip()
            elif '```' in raw:
                raw = raw.split('```')[1].strip()
            start, end = raw.find('{'), raw.rfind('}') + 1
            new_tc_result = _json.loads(raw[start:end])
            new_test_cases = new_tc_result.get('test_cases', [])
        except Exception as e:
            print(f"[SmartVersion] New TC generation failed: {e}")
            new_test_cases = []

        if new_test_cases:
            # Tag each new TC with the current version number and stable IDs
            for i, tc in enumerate(new_test_cases):
                tc['version'] = version_number
                tc['id'] = f"{story_id}-v{version_number}-{i+1}"
                tc.setdefault('status', 'Pending')

            # Append to existing test cases
            all_cases = existing_cases + new_test_cases

            # Re-run AI grouping on ALL test cases so v2 TCs are grouped
            # alongside v1 TCs (not dumped into "General")
            try:
                from app.LLM.Test_case_generator import assign_groups
                story_desc_for_group = existing_tc_json.get('storyDescription', new_doc[:200])
                assign_groups(all_cases, story_desc_for_group)
                print(f"[SmartVersion] Re-grouped {len(all_cases)} TCs after v{version_number} append")
            except Exception as ge:
                print(f"[SmartVersion] Group assignment failed (non-fatal): {ge}")
                # Fallback: assign group based on type
                for tc in new_test_cases:
                    tc.setdefault('group', tc.get('type', 'General'))

            updated_json = dict(existing_tc_json)
            updated_json['test_cases'] = all_cases

            with Config.get_postgres_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE test_cases SET test_case_json = %s, total_test_cases = %s WHERE story_id = %s AND workspace_id = %s",
                        (_json.dumps(updated_json), len(all_cases), story_id, workspace_id)
                    )
                    conn.commit()
            print(f"[SmartVersion] Appended {len(new_test_cases)} new TCs for v{version_number}")
        else:
            print(f"[SmartVersion] No new requirements for {story_id}")

    # ── Step 3: Create impact records for changed requirements ─────────────────
    if changed_reqs and existing_cases:
        for change in changed_reqs:
            old_text = change.get('old_text', '')
            new_text = change.get('new_text', '')
            change_summary = change.get('change_summary', 'Requirement changed in new version')

            # Find the most relevant existing test case for this changed requirement
            # Use normalized overlap (Jaccard + coverage) instead of raw word count
            import re as _re_match
            def _normalize(text):
                stopwords = {'a','an','the','is','are','was','were','with','for','and','or','to','of','in','on','be','not','this','that','should','must','can','will','would','when','if','as','at','by','it','its'}
                words = set(_re_match.sub(r'[^a-z0-9 ]', '', text.lower()).split())
                return words - stopwords

            best_tc = None
            best_score = 0
            req_words = _normalize(old_text)
            for tc in existing_cases:
                title_words = _normalize(tc.get('title', ''))
                steps_words = _normalize(' '.join(tc.get('steps', [])))
                all_tc_words = title_words | steps_words

                if not req_words or not all_tc_words:
                    continue

                intersection = req_words & all_tc_words
                # Jaccard similarity
                union = req_words | all_tc_words
                jaccard = len(intersection) / len(union) if union else 0
                # Coverage: what % of requirement words appear in the TC
                coverage = len(intersection) / len(req_words) if req_words else 0

                combined_score = jaccard * 0.5 + coverage * 0.5
                if combined_score > best_score:
                    best_score = combined_score
                    best_tc = tc

            # Require at least 20% semantic overlap (much better than raw 2-word count)
            if not best_tc or best_score < 0.20:
                # No close match - skip impact, the new TC generation covers it
                continue

            # Generate a modified version of the matched test case
            impact_prompt = f"""A requirement has changed. Update this test case to reflect the change.

ORIGINAL TEST CASE:
Title: {best_tc.get('title', '')}
Steps: {_json.dumps(best_tc.get('steps', []))}
Expected Result: {best_tc.get('expected_result', '')}

REQUIREMENT CHANGE:
Old: {old_text}
New: {new_text}
Summary: {change_summary}

Return ONLY valid JSON with the updated test case:
{{
  "title": "updated title",
  "steps": ["updated step 1", "updated step 2"],
  "expected_result": "updated expected result",
  "priority": "{best_tc.get('priority', 'Medium')}"
}}"""

            try:
                impact_response = Config.llm.invoke(impact_prompt)
                raw = impact_response.content.strip()
                if '```json' in raw:
                    raw = raw.split('```json')[1].split('```')[0].strip()
                elif '```' in raw:
                    raw = raw.split('```')[1].strip()
                start, end = raw.find('{'), raw.rfind('}') + 1
                updated_tc = _json.loads(raw[start:end])
            except Exception as e:
                print(f"[SmartVersion] Impact TC generation failed: {e}")
                continue

            # Insert impact record into test_case_impacts
            try:
                impact_analysis = {
                    "modified_test_case": {
                        "id": f"{best_tc['id']}-mod-v{version_number}",
                        "title": updated_tc.get('title', best_tc.get('title', '')),
                        "steps": updated_tc.get('steps', best_tc.get('steps', [])),
                        "expected_result": updated_tc.get('expected_result', best_tc.get('expected_result', '')),
                        "priority": updated_tc.get('priority', best_tc.get('priority', 'Medium')),
                    },
                    "modification_reason": change_summary,
                    "modifiedTestCase": {
                        "title": updated_tc.get('title', ''),
                        "steps": updated_tc.get('steps', []),
                        "expected_result": updated_tc.get('expected_result', ''),
                    },
                    "impactingStoryDescription": f"New version v{version_number} uploaded",
                    "impactingStoryId": story_id,
                }

                with Config.get_postgres_connection() as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "SELECT run_id FROM test_cases WHERE story_id = %s AND workspace_id = %s LIMIT 1",
                            (story_id, workspace_id)
                        )
                        run_row = cur.fetchone()
                        if not run_row:
                            continue

                        new_impact_id = str(uuid.uuid4())
                        cur.execute("""
                            INSERT INTO test_case_impacts (
                                impact_id, new_story_id, original_story_id,
                                original_test_case_id, modified_test_case_id,
                                project_id, user_id, workspace_id,
                                impact_severity, impact_priority,
                                impact_details, impact_status, impact_analysis_json,
                                impacting_story_description
                            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """, (
                            new_impact_id,
                            story_id,       # new_story_id = same story (self-impact from new version)
                            story_id,       # original_story_id
                            best_tc['id'],  # original_test_case_id
                            f"{best_tc['id']}-mod-v{version_number}",
                            project_id,
                            user_id,
                            workspace_id,
                            'medium',
                            3,
                            _json.dumps({'modificationReason': change_summary, 'reviewed_by': None}),
                            'active',
                            _json.dumps(impact_analysis),
                            f"Version {version_number} upload - {change_summary[:100]}",
                        ))
                        conn.commit()
                print(f"[SmartVersion] Created impact for TC {best_tc['id']} → v{version_number} change")
            except Exception as e:
                print(f"[SmartVersion] Failed to insert impact record: {e}")

    # Run cross-story impact analysis for the updated story (non-blocking already in thread)
    try:
        from app.LLM.impact_analyzer import analyze_test_case_impacts
        analyze_test_case_impacts(story_id, project_id, user_id=user_id, workspace_id=workspace_id)
    except Exception as e:
        print(f"[SmartVersion] Cross-story impact analysis failed: {e}")


@stories_bp.route('/<story_id>/upload-version', methods=['POST'])
@dev_jwt_required
def upload_new_version(story_id):
    """Upload a new version of an existing story, archive the old one, and regenerate tests."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        ok, err = _check_permission('can_create_stories')
        if not ok: return err
        db_service = get_db_service()

        # Story must exist in this workspace
        existing_story = db_service.get_story(story_id, user_id=user_id, workspace_id=workspace_id)
        if not existing_story:
            return jsonify({'error': f'Story {story_id} not found'}), 404

        project_id = existing_story.get('project_id', 'default')
        content = request.form.get('content')
        file = request.files.get('file')
        source = request.form.get('source', 'frontend')

        if not content and not file:
            return jsonify({'error': 'content or file is required'}), 400

        # Extract text
        story_content = content
        filename = None
        if file and file.filename:
            import os
            allowed_extensions = {'.pdf', '.docx', '.txt'}
            file_ext = os.path.splitext(file.filename)[1].lower()
            if file_ext not in allowed_extensions:
                return jsonify({'error': f'File type {file_ext} not supported'}), 400
            upload_dir = os.getenv("UPLOAD_FOLDER", "./data/uploaded_docs")
            project_dir = os.path.join(upload_dir, project_id)
            os.makedirs(project_dir, exist_ok=True)
            filename = f"{story_id}_v{uuid.uuid4().hex[:6]}{file_ext}"
            file_path = os.path.join(project_dir, filename)
            file.save(file_path)
            from app.datapipeline.text_extractor import extract_text
            story_content = extract_text(file_path)
            if not story_content:
                return jsonify({'error': 'Could not extract text from file'}), 400

        try:
            from app.models.credits_model import CreditsModel, OutOfCreditsException
            CreditsModel.check_and_deduct_credit(workspace_id, user_id, action="upload_story_version", story_id=story_id)
        except OutOfCreditsException as e:
            return jsonify({'error': str(e)}), 402
        except Exception as e:
            return jsonify({'error': f'Credit system error: {str(e)}'}), 500

        # Determine next version number
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COALESCE(MAX(version_number), 0) FROM story_versions WHERE story_id = %s AND workspace_id = %s",
                    (story_id, workspace_id)
                )
                max_version = cur.fetchone()[0]
                next_version = max_version + 1

                # Get current run_id to archive
                cur.execute(
                    "SELECT run_id FROM test_cases WHERE story_id = %s AND workspace_id = %s",
                    (story_id, workspace_id)
                )
                existing_run = cur.fetchone()
                current_run_id = existing_run[0] if existing_run else None

                # Get the current story content to archive.
                # Priority: LanceDB doc_content_text -> test_cases.inputs (main_text/content) -> empty
                archive_content = existing_story.get('document_content', '') or ''
                if not archive_content.strip():
                    cur.execute(
                        "SELECT inputs FROM test_cases WHERE story_id = %s AND workspace_id = %s LIMIT 1",
                        (story_id, workspace_id)
                    )
                    inp_row = cur.fetchone()
                    if inp_row and inp_row[0]:
                        import json as _j
                        inp = inp_row[0]
                        if isinstance(inp, str):
                            try: inp = _j.loads(inp)
                            except: inp = {}
                        archive_content = (
                            inp.get('main_text') or
                            inp.get('content') or
                            inp.get('file_content') or
                            ''
                        )

                # Archive current version
                cur.execute("""
                    INSERT INTO story_versions (story_id, user_id, workspace_id, version_number, content, description, file_name, run_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (story_id, user_id, version_number) DO UPDATE SET content = EXCLUDED.content
                """, (story_id, user_id, workspace_id, next_version - 1 if next_version > 1 else 1,
                      archive_content,
                      existing_story.get('description', ''),
                      None, current_run_id))
                conn.commit()

        # Generate new AI description
        try:
            chunks = [story_content[i:i+4000] for i in range(0, len(story_content), 4000)]
            summaries = []
            for chunk in chunks[:3]:
                try:
                    resp = Config.llm.invoke("Summarize in 1 sentence:\n\n" + chunk)
                    summaries.append(resp.content.strip())
                except Exception:
                    pass
            description = " ".join(summaries) if summaries else story_content[:150]
        except Exception:
            description = story_content[:150]

        # Short title
        try:
            title_resp = Config.llm.invoke(
                "Generate a 3-5 word title (no punctuation) for: " + description[:500]
            )
            short_title = title_resp.content.strip().strip('"').strip("'")[:60]
        except Exception:
            short_title = " ".join(description.split()[:5])

        # Update LanceDB entry
        try:
            from app.config import get_embedding_model
            db = lancedb.connect(Config.LANCE_DB_PATH)
            table = db.open_table(Config.TABLE_NAME_LANCE)
            # Drop only THIS story's row within THIS workspace, then re-add it.
            all_rows = table.to_pandas()
            drop = all_rows['storyID'] == story_id
            if 'workspace_id' in all_rows.columns:
                drop = drop & (all_rows['workspace_id'] == workspace_id)
            kept = all_rows[~drop]
            table = db.create_table(Config.TABLE_NAME_LANCE, data=kept, mode='overwrite')
            embedding = get_embedding_model().encode(story_content).tolist()
            from datetime import datetime as _dt
            table.add([{
                'workspace_id': workspace_id, 'user_id': user_id, 'project_id': project_id,
                'vector': embedding, 'storyID': story_id,
                'storyDescription': short_title, 'test_case_content': '',
                'filename': filename or f"{story_id}.txt",
                'original_path': None, 'doc_content_text': story_content,
                'embedding_timestamp': _dt.now(), 'source': source
            }])
        except Exception as e:
            return jsonify({'error': f'Vector store update failed: {str(e)}'}), 500

        # ── Smart versioned regeneration ─────────────────────────────────────────
        # Instead of deleting all test cases, we:
        # 1. LLM-diff old doc vs new doc to find new + changed requirements
        # 2. Generate test cases ONLY for new requirements (appended, tagged version N)
        # 3. Create impact records for changed requirements (shows in Impact tab)
        # 4. Never delete existing approved test cases

        old_content = existing_story.get('document_content', '') or ''

        import threading
        def run_smart_version(old_doc, new_doc, ver_num):
            try:
                _smart_version_pipeline(
                    story_id=story_id,
                    project_id=project_id,
                    user_id=user_id,
                    workspace_id=workspace_id,
                    old_doc=old_doc,
                    new_doc=new_doc,
                    version_number=ver_num,
                )
            except Exception as e:
                print(f"[UploadVersion] Smart pipeline failed, falling back to full regen: {e}")
                # Fallback: delete and regenerate everything
                try:
                    with Config.get_postgres_connection() as conn:
                        with conn.cursor() as cur:
                            cur.execute("DELETE FROM test_cases WHERE story_id = %s AND workspace_id = %s",
                                        (story_id, workspace_id))
                            conn.commit()
                    from app.LLM.Test_case_generator import generate_test_case_for_story
                    generate_test_case_for_story(story_id, user_id=user_id, workspace_id=workspace_id)
                except Exception as fe:
                    print(f"[UploadVersion] Fallback regen also failed: {fe}")

        threading.Thread(
            target=run_smart_version,
            args=(old_content, story_content, next_version),
            daemon=True
        ).start()

        return jsonify({
            'message': 'New version uploaded. Test regeneration started.',
            'story_id': story_id,
            'version_number': next_version,
            'description': short_title,
        }), 202

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Review endpoints (INTEGRATION_PLAN Gap 2) ────────────────────────────────

@stories_bp.route('/impacts/<impact_id>/review', methods=['POST'])
@dev_jwt_required
def review_impact(impact_id):
    """
    Accept, reject, or edit a single impact.

    When action = 'accept':
      - Sets impact_status = 'accepted'
      - Replaces the original test case in test_case_json with the modified version
        from impact_analysis_json so the story's test suite reflects the change.

    When action = 'reject':
      - Sets impact_status = 'rejected'
      - Leaves the original test case unchanged.

    When action = 'edit':
      - Sets impact_status = 'accepted'
      - Uses the caller-supplied edited_test_case instead of impact_analysis_json.
    """
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json(silent=True) or {}
        action = data.get('action')
        if action not in ('accept', 'reject', 'edit'):
            return jsonify({'error': 'action must be accept, reject, or edit'}), 400

        new_status = 'accepted' if action in ('accept', 'edit') else 'rejected'
        edited_tc = data.get('edited_test_case')

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                # Fetch the impact record to get the modified test case (workspace-scoped)
                cur.execute("""
                    SELECT tci.impact_id, tci.original_story_id, tci.original_test_case_id,
                           tci.impact_analysis_json, tci.user_id,
                           tc.test_case_json
                    FROM test_case_impacts tci
                    JOIN test_cases tc ON tc.story_id = tci.original_story_id AND tc.workspace_id = tci.workspace_id
                    WHERE tci.impact_id = %s AND tci.workspace_id = %s
                """, (impact_id, workspace_id))
                impact = cur.fetchone()
                if not impact:
                    return jsonify({'error': 'Impact not found or access denied'}), 404

                # Update impact status
                cur.execute("""
                    UPDATE test_case_impacts
                    SET impact_status = %s,
                        impact_details = CASE
                            WHEN %s IS NOT NULL THEN %s::jsonb
                            ELSE impact_details
                        END
                    WHERE impact_id = %s AND workspace_id = %s
                """, (
                    new_status,
                    json.dumps(edited_tc) if edited_tc else None,
                    json.dumps({'edited_test_case': edited_tc, 'reviewed_by': user_id}) if edited_tc else None,
                    impact_id,
                    workspace_id,
                ))

                # Write to impact_history (changed_by records the acting user)
                cur.execute("""
                    INSERT INTO impact_history
                        (history_id, impact_id, user_id, workspace_id, changed_by, previous_status, new_status, change_reason)
                    VALUES (%s, %s, %s, %s, %s, 'active', %s, 'user_review')
                """, (str(uuid.uuid4()), impact_id, user_id, workspace_id, user_id, new_status))

                # If ACCEPTED: apply the modified test case to the story's test_case_json
                if new_status == 'accepted':
                    original_tc_id = impact['original_test_case_id']
                    original_story_id = impact['original_story_id']
                    tc_json = impact['test_case_json']

                    # Determine which test case to apply
                    if edited_tc:
                        replacement = edited_tc
                    else:
                        # Parse the LLM-generated modified test case from impact_analysis_json
                        analysis = impact['impact_analysis_json']
                        if isinstance(analysis, str):
                            try:
                                analysis = json.loads(analysis)
                            except Exception:
                                analysis = {}
                        replacement = analysis.get('modified_test_case') or analysis.get('modifiedTestCase')

                    if replacement and tc_json:
                        # Parse test_case_json if it's a string
                        if isinstance(tc_json, str):
                            try:
                                tc_json = json.loads(tc_json)
                            except Exception:
                                tc_json = {}

                        test_cases = tc_json.get('test_cases', [])
                        updated = False
                        new_cases = []
                        for tc in test_cases:
                            tc_id = tc.get('id') or tc.get('test_case_id', '')
                            if tc_id == original_tc_id:
                                # Replace with the modified version, preserving the original ID
                                merged = {**tc, **{
                                    'title': replacement.get('title', tc.get('title', '')),
                                    'steps': replacement.get('steps', tc.get('steps', [])),
                                    'expected_result': replacement.get('expected_result', tc.get('expected_result', '')),
                                    'priority': replacement.get('priority', tc.get('priority', 'Medium')),
                                    'id': tc_id,  # keep original ID
                                }}
                                new_cases.append(merged)
                                updated = True
                            else:
                                new_cases.append(tc)

                        if updated:
                            tc_json['test_cases'] = new_cases
                            cur.execute("""
                                UPDATE test_cases
                                SET test_case_json = %s
                                WHERE story_id = %s AND workspace_id = %s
                            """, (json.dumps(tc_json), original_story_id, workspace_id))

                conn.commit()

        return jsonify({
            'impact_id': impact_id,
            'new_status': new_status,
            'message': 'Impact accepted - test case updated in story' if new_status == 'accepted' else 'Impact rejected'
        }), 200

    except Exception as e:
        print(f"❌ Error reviewing impact: {e}")
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/impacts/batch-review', methods=['POST'])
@dev_jwt_required
def batch_review_impacts():
    """Accept/reject/edit multiple impacts in one call (partial-acceptance workflow)."""
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        data = request.get_json(silent=True) or {}
        project_id = data.get('project_id')
        new_story_id = data.get('new_story_id')
        reviews = data.get('reviews', [])

        if not reviews:
            return jsonify({'error': 'reviews list is required'}), 400

        accepted = rejected = edited = 0

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                for review in reviews:
                    iid = review.get('impact_id')
                    action = review.get('action')
                    if not iid or action not in ('accept', 'reject', 'edit'):
                        continue

                    new_status = 'accepted' if action in ('accept', 'edit') else 'rejected'
                    edited_tc = review.get('edited_test_case')

                    # Fetch impact + original test_case_json in one query
                    cur.execute("""
                        SELECT tci.impact_id, tci.original_story_id, tci.original_test_case_id,
                               tci.impact_analysis_json,
                               tc.test_case_json
                        FROM test_case_impacts tci
                        LEFT JOIN test_cases tc ON tc.story_id = tci.original_story_id AND tc.workspace_id = tci.workspace_id
                        WHERE tci.impact_id = %s AND tci.workspace_id = %s
                    """, (iid, workspace_id))
                    impact = cur.fetchone()
                    if not impact:
                        continue

                    cur.execute("""
                        UPDATE test_case_impacts
                        SET impact_status = %s,
                            impact_details = CASE
                                WHEN %s IS NOT NULL THEN %s::jsonb
                                ELSE impact_details
                            END
                        WHERE impact_id = %s AND workspace_id = %s
                    """, (
                        new_status,
                        json.dumps(edited_tc) if edited_tc else None,
                        json.dumps({'edited_test_case': edited_tc, 'reviewed_by': user_id}) if edited_tc else None,
                        iid,
                        workspace_id,
                    ))

                    cur.execute("""
                        INSERT INTO impact_history
                            (history_id, impact_id, user_id, workspace_id, changed_by, previous_status, new_status, change_reason)
                        VALUES (%s, %s, %s, %s, %s, 'active', %s, 'batch_review')
                    """, (str(uuid.uuid4()), iid, user_id, workspace_id, user_id, new_status))

                    # If accepted: apply the modified test case to test_case_json
                    if new_status == 'accepted':
                        original_tc_id = impact['original_test_case_id']
                        original_story_id = impact['original_story_id']
                        tc_json = impact['test_case_json']

                        if edited_tc:
                            replacement = edited_tc
                        else:
                            analysis = impact['impact_analysis_json']
                            if isinstance(analysis, str):
                                try:
                                    analysis = json.loads(analysis)
                                except Exception:
                                    analysis = {}
                            replacement = (analysis or {}).get('modified_test_case') or (analysis or {}).get('modifiedTestCase')

                        if replacement and tc_json:
                            if isinstance(tc_json, str):
                                try:
                                    tc_json = json.loads(tc_json)
                                except Exception:
                                    tc_json = {}
                            test_cases = tc_json.get('test_cases', [])
                            new_cases = []
                            for tc in test_cases:
                                tc_id = tc.get('id') or tc.get('test_case_id', '')
                                if tc_id == original_tc_id:
                                    new_cases.append({**tc, **{
                                        'title': replacement.get('title', tc.get('title', '')),
                                        'steps': replacement.get('steps', tc.get('steps', [])),
                                        'expected_result': replacement.get('expected_result', tc.get('expected_result', '')),
                                        'priority': replacement.get('priority', tc.get('priority', 'Medium')),
                                        'id': tc_id,
                                    }})
                                else:
                                    new_cases.append(tc)
                            tc_json['test_cases'] = new_cases
                            cur.execute("""
                                UPDATE test_cases SET test_case_json = %s
                                WHERE story_id = %s AND workspace_id = %s
                            """, (json.dumps(tc_json), original_story_id, workspace_id))

                    if action == 'accept': accepted += 1
                    elif action == 'reject': rejected += 1
                    elif action == 'edit': edited += 1

                conn.commit()

        total = accepted + rejected + edited
        change_request_status = 'rejected' if accepted == 0 and total > 0 else 'approved'

        return jsonify({
            'message': 'Review submitted',
            'accepted': accepted,
            'rejected': rejected,
            'edited': edited,
            'change_request_status': change_request_status
        }), 202

    except Exception as e:
        print(f"❌ Error in batch review: {e}")
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/changes', methods=['GET'])
@dev_jwt_required
def get_changes():
    """
    List change requests - grouped impacts by new_story_id.
    A change request = all impacts that a new story caused on existing stories.
    Query params: project_id, status (pending|approved|rejected|all), page, per_page
    """
    try:
        user_id = get_current_user_id()
        workspace_id = get_current_workspace_id()
        project_id = request.args.get('project_id')
        status_filter = request.args.get('status', 'all')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        # Map frontend status labels to DB values
        status_map = {
            'pending': ['active'],
            'approved': ['accepted'],
            'rejected': ['rejected'],
            'all': ['active', 'accepted', 'rejected', 'inactive'],
        }
        db_statuses = status_map.get(status_filter, ['active', 'accepted', 'rejected', 'inactive'])

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                # Build query - group impacts by new_story_id
                base_query = """
                    SELECT
                        tci.new_story_id                                      AS change_id,
                        tci.new_story_id,
                        tc_new.story_description                              AS new_story_description,
                        tci.project_id,
                        MIN(tci.impact_created_on)                            AS created_on,
                        COUNT(DISTINCT tci.original_story_id)                 AS stories_affected,
                        COUNT(tci.impact_id)                                  AS tests_affected,
                        MAX(tci.impact_severity)                              AS overall_severity,
                        CASE
                            WHEN BOOL_OR(tci.impact_status = 'active')   THEN 'pending'
                            WHEN BOOL_OR(tci.impact_status = 'accepted') THEN 'approved'
                            ELSE 'rejected'
                        END                                                   AS status
                    FROM test_case_impacts tci
                    JOIN test_cases tc_new
                        ON tc_new.story_id = tci.new_story_id
                    WHERE tci.workspace_id = %s
                """
                params = [workspace_id]

                if project_id:
                    base_query += " AND tci.project_id = %s"
                    params.append(project_id)

                base_query += """
                    GROUP BY tci.new_story_id, tc_new.story_description, tci.project_id
                    HAVING CASE
                        WHEN BOOL_OR(tci.impact_status = 'active')   THEN 'pending'
                        WHEN BOOL_OR(tci.impact_status = 'accepted') THEN 'approved'
                        ELSE 'rejected'
                    END = ANY(%s)
                    ORDER BY MIN(tci.impact_created_on) DESC
                    LIMIT %s OFFSET %s
                """
                params.extend([db_statuses, per_page, (page - 1) * per_page])

                cur.execute(base_query, params)
                rows = cur.fetchall()

                # Count total for pagination
                count_q = """
                    SELECT COUNT(*) FROM (
                        SELECT tci.new_story_id
                        FROM test_case_impacts tci
                        JOIN test_cases tc_new ON tc_new.story_id = tci.new_story_id
                        WHERE tci.workspace_id = %s
                """
                count_params = [workspace_id]
                if project_id:
                    count_q += " AND tci.project_id = %s"
                    count_params.append(project_id)
                count_q += " GROUP BY tci.new_story_id) sub"
                cur.execute(count_q, count_params)
                total = cur.fetchone()[0]

                changes = []
                for row in rows:
                    d = dict(row)
                    if d.get('created_on'):
                        d['created_on'] = d['created_on'].isoformat()
                    changes.append(d)

        return jsonify({
            'changes': changes,
            'pagination': {
                'total': total,
                'page': page,
                'per_page': per_page,
                'total_pages': math.ceil(total / per_page) if per_page else 1
            }
        }), 200

    except Exception as e:
        print(f"❌ Error fetching changes: {e}")
        return jsonify({'error': str(e)}), 500

