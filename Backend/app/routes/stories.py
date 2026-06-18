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
stories_bp = Blueprint('stories', __name__)

# ── Dev auth bypass ───────────────────────────────────────────────────────────
# Set DEV_BYPASS_AUTH=1 in .env to skip JWT and use a fixed dev user_id.
# REMOVE before deploying to production.
_DEV_USER_ID = "00000000-0000-0000-0000-000000000001"

def _is_bypass():
    return os.getenv("DEV_BYPASS_AUTH", "0") == "1"

def dev_jwt_required(fn):
    """Drop-in replacement for @dev_jwt_required that respects DEV_BYPASS_AUTH."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if _is_bypass():
            return fn(*args, **kwargs)
        return jwt_required()(fn)(*args, **kwargs)
    return wrapper

def get_current_user_id():
    """Return user_id from JWT or the fixed dev user when bypassing."""
    if _is_bypass():
        return _DEV_USER_ID
    return get_jwt_identity()
# ─────────────────────────────────────────────────────────────────────────────

def serialize_datetime(obj):
    """Helper function to serialize datetime objects"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)

@stories_bp.route('/', methods=['GET'])
@dev_jwt_required
def get_stories():
    """Get all stories with pagination and sorting"""
    try:
        user_id = get_current_user_id()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        sort_order = request.args.get('sort_order', 'desc')
        project_id = request.args.get('project_id')

        print("DEBUG:get_stories: Request received", {
            'page': page,
            'per_page': per_page,
            'sort_order': sort_order,
            'project_id': project_id
        })

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
            AND user_id = %s
        """
        params = [user_id]

        # Add project filter if specified
        if project_id:
            query += " AND project_id = %s"
            params.append(project_id)

        # Add sorting
        query += f" ORDER BY created_on {sort_order}"

        # Add pagination
        query += " LIMIT %s OFFSET %s"
        params.extend([per_page, (page - 1) * per_page])

        # Get embedding timestamps and doc_content_text from LanceDB
        print("DEBUG:get_stories: Connecting to LanceDB", {
            'lance_db_path': Config.LANCE_DB_PATH,
            'table_name': Config.TABLE_NAME_LANCE
        })
        db = lancedb.connect(Config.LANCE_DB_PATH)
        table = db.open_table(Config.TABLE_NAME_LANCE)
        lance_data = table.to_pandas()
        # Filter LanceDB data to this user
        if 'user_id' in lance_data.columns:
            lance_data = lance_data[lance_data['user_id'] == user_id]
        embedding_timestamps = dict(zip(lance_data['storyID'], lance_data['embedding_timestamp']))
        doc_content_texts = dict(zip(lance_data['storyID'], lance_data['doc_content_text']))

        # Execute query
        print("DEBUG:get_stories: Executing Postgres query", {
            'query': query,
            'params': params
        })
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                cursor.execute(query, params)
                stories = cursor.fetchall()
                print("DEBUG:get_stories: Query returned stories", {
                    'stories_count': len(stories)
                })

                # Get total count for pagination
                count_query = """
                    SELECT COUNT(*)
                    FROM test_cases
                    WHERE test_case_generated = TRUE
                    AND user_id = %s
                """
                count_params = [user_id]
                if project_id:
                    count_query += " AND project_id = %s"
                    count_params.append(project_id)

                cursor.execute(count_query, count_params)
                total = cursor.fetchone()[0]
                print("DEBUG:get_stories: Total stories count", {
                    'total': total
                })

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
                        except:
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

                print("DEBUG:get_stories: Returning response", {
                    'stories_returned': len(result['stories']),
                    'pagination': result['pagination']
                })
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
        print("DEBUG:get_story: Request received", {'story_id': story_id})
        if not story_id:
            return jsonify({'error': 'Story ID is required'}), 400

        db_service = get_db_service()
        print("DEBUG:get_story: Fetching story from db_service")
        story = db_service.get_story(story_id, user_id=user_id)

        if story:
            print("DEBUG:get_story: Story found", {'story_id': story_id})
            return jsonify(story)
        print("DEBUG:get_story: Story not found", {'story_id': story_id})
        return jsonify({'error': f'Story not found: {story_id}'}), 404
    except Exception as e:
        print(f"Error getting story {story_id}: {str(e)}")
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/search', methods=['POST'])
@dev_jwt_required
def search_stories():
    """Search for similar stories"""
    try:
        user_id = get_current_user_id()
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
        results = db_service.search_similar_stories(query, limit, user_id=user_id)
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
        print("DEBUG:download_test_cases: Request received", {'story_id': story_id})
        db_service = get_db_service()

        # Get story details from LanceDB (scoped to user)
        print("DEBUG:download_test_cases: Fetching story details from db_service")
        story = db_service.get_story(story_id, user_id=user_id)
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
                    WHERE story_id = %s AND user_id = %s
                """, (story_id, user_id))
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
        print(f"DEBUG:get_story_testcases: Request received for story {story_id}")
        db_service = get_db_service()

        # Get test cases from PostgreSQL scoped to user
        print("DEBUG:get_story_testcases: Querying Postgres for test_case_json")
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT test_case_json, story_description, project_id
                    FROM test_cases
                    WHERE story_id = %s AND user_id = %s
                """, (story_id, user_id))
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
        # 1. Retrieve similar stories and their test cases
        try:
            print("DEBUG:rag_chat: Calling Chat_RAG", {'query': user_query})
            rag_results = Chat_RAG(user_query, top_k=3)
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

        # 3. Call Gemini LLM using the configured object
        try:
            print("DEBUG:rag_chat: Calling LLM via Config.llm.invoke")
            response = Config.llm.invoke(prompt)
            text = response.content.strip()
            print("DEBUG:rag_chat: LLM raw output received", {
                'length': len(text)
            })
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
    """Get unique project IDs for the current user"""
    try:
        user_id = get_current_user_id()
        db_service = get_db_service()

        # Get stories from LanceDB filtered by user
        stories_table = db_service.lance_db.open_table(Config.TABLE_NAME_LANCE)
        lance_stories = stories_table.to_pandas()

        # Filter by user_id if column exists
        if 'user_id' in lance_stories.columns:
            lance_stories = lance_stories[lance_stories['user_id'] == user_id]

        # Get unique project IDs
        project_ids = lance_stories['project_id'].dropna().unique().tolist()
        project_ids = [pid for pid in project_ids if pid and pid.strip()]

        return jsonify({
            'projects': project_ids
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@stories_bp.route('/upload', methods=['POST'])
@dev_jwt_required
def upload_story():
    """Upload a new user story with project ID, story ID, content, and optional file. Description will be AI-generated."""
    try:
        user_id = get_current_user_id()
        # Get form data
        project_id = request.form.get('project_id')
        story_id = request.form.get('story_id')
        content = request.form.get('content')
        file = request.files.get('file')
        source = request.form.get('source', 'backend')

        # Validate required fields
        if not project_id or not story_id or (not content and not file):
            return jsonify({
                'error': 'Project ID, Story ID, and either Content or File are required'
            }), 400

        # Check if story already exists for this user
        db_service = get_db_service()
        existing_story = db_service.get_story(story_id, user_id=user_id)
        if existing_story:
            return jsonify({
                'error': f'Story with ID "{story_id}" already exists'
            }), 409

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

            # Add to LanceDB — storyDescription stores the short title for card display
            table.add([{
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
                "source": source
            }])

        except Exception as e:
            return jsonify({
                'error': f'Error adding story to database: {str(e)}'
            }), 500

        # Run test case generation + impact analysis entirely in background
        # so the HTTP response returns immediately (202 Accepted).
        # Frontend polls GET /api/stories/<id> until test_case_count > 0.
        import threading

        def run_full_pipeline(sid, proj_id, uid, fpath, fname):
            try:
                from app.LLM.Test_case_generator import generate_test_case_for_story
                generate_test_case_for_story(sid, user_id=uid)

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
                    analyze_test_case_impacts(new_story_id=sid, project_id=proj_id, user_id=uid)
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
            args=(story_id, project_id, user_id, file_path, filename if file else f"{story_id}.txt"),
            daemon=True
        )
        thread.start()
        print(f"[Upload] Background pipeline started for story {story_id}")

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
                        tc.story_description as original_story_description
                    FROM test_case_impacts tci
                    JOIN test_cases tc ON tc.story_id = tci.original_story_id
                    WHERE tci.project_id = %s AND tci.user_id = %s
                    ORDER BY tci.impact_created_on DESC
                """, (project_id, user_id))

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
                    AND tci.user_id = %s
                    ORDER BY tci.impact_created_on DESC
                """, (story_id, story_id, user_id))

                impacts = cursor.fetchall()

                # Organize impacts by role (source vs target)
                caused_impacts = []
                received_impacts = []

                for impact in impacts:
                    impact_dict = dict(impact)
                    if impact['new_story_id'] == story_id:
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
                    WHERE tci.impact_id = %s AND tci.user_id = %s
                """, (impact_id, user_id))

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
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                cursor.execute("""
                    SELECT * FROM test_case_impact_summary
                    WHERE project_id = %s
                    AND story_id IN (
                        SELECT story_id FROM test_cases WHERE user_id = %s
                    )
                    ORDER BY total_impacts DESC
                """, (project_id, user_id))
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
        data = request.get_json()
        story_id = data.get('story_id')
        project_id = data.get('project_id')

        if not story_id or not project_id:
            return jsonify({
                'error': 'Both story_id and project_id are required'
            }), 400

        analyze_test_case_impacts(story_id, project_id, user_id=user_id)

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
        data = request.get_json()
        project_id = data.get('project_id')

        if not project_id:
            return jsonify({'error': 'project_id is required'}), 400

        # Get all stories with test cases in this project scoped to user
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                cursor.execute("""
                    SELECT story_id FROM test_cases
                    WHERE project_id = %s AND test_case_generated = TRUE AND user_id = %s
                    ORDER BY created_on ASC
                """, (project_id, user_id))
                stories = [row['story_id'] for row in cursor.fetchall()]

        if not stories:
            return jsonify({
                'message': 'No stories with test cases found in project',
                'project_id': project_id,
                'stories_queued': 0
            }), 200

        # Run analysis in background thread
        import threading
        def run_all_impact_analyses(story_list, proj_id, uid):
            try:
                print(f"[ImpactAnalysis] Starting project-wide impact analysis for {len(story_list)} stories in project {proj_id}")
                from app.LLM.impact_analyzer import analyze_test_case_impacts
                for sid in story_list:
                    try:
                        analyze_test_case_impacts(new_story_id=sid, project_id=proj_id, user_id=uid)
                        print(f"[ImpactAnalysis] Completed impact analysis for story {sid}")
                    except Exception as story_err:
                        print(f"[ImpactAnalysis] Error analyzing story {sid}: {story_err}")
                print(f"[ImpactAnalysis] Project-wide impact analysis completed for project {proj_id}")
            except Exception as e:
                print(f"[ImpactAnalysis] Project-wide impact analysis failed: {e}")

        thread = threading.Thread(
            target=run_all_impact_analyses,
            args=(stories, project_id, user_id),
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
        print(f"Fetching test case {test_case_id} from story {story_id}")
        db_service = get_db_service()

        # Get test cases from PostgreSQL scoped to user
        with psycopg2.connect(**db_service.postgres_config) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    WITH test_cases_array AS (
                        SELECT jsonb_array_elements(test_case_json->'test_cases') as test_case
                        FROM test_cases
                        WHERE story_id = %s AND user_id = %s
                    )
                    SELECT test_case
                    FROM test_cases_array
                    WHERE test_case->>'id' = %s
                    OR test_case->>'test_case_id' = %s
                    LIMIT 1
                """, (story_id, user_id, test_case_id, test_case_id))
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
                    AND user_id = %s
                """, (story_id, project_id, user_id))
                db_impacted_count = cursor.fetchone()['impacted_count']

                cursor.execute("""
                    SELECT story_description, test_case_json
                    FROM test_cases
                    WHERE story_id = %s AND user_id = %s
                """, (story_id, user_id))
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
                        AND tci.user_id = %s
                        ORDER BY tci.original_test_case_id, tci.impact_created_on DESC
                    """, (project_id,) + tuple(test_case_ids) + (user_id,))
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
                        'impact_details': str(impact['impact_details']) if impact['impact_details'] else '',
                        'impact_analysis_json': json.dumps(impact_analysis) if isinstance(impact_analysis, (dict, list)) else str(impact_analysis)
                    }
                    impact_map[test_case_id].append(formatted_impact)

                # Build response with all test cases
                impacted_test_cases = []
                for tc in test_cases:
                    tc_id = tc.get('id')
                    steps = tc.get('steps', [])
                    steps_str = json.dumps(steps) if isinstance(steps, (list, dict)) else str(steps)

                    test_case = {
                        'test_case_id': str(tc_id),
                        'original_title': str(tc.get('title', '')),
                        'original_expected_result': str(tc.get('expected_result', '')),
                        'original_steps': steps_str,
                        'impacts': impact_map.get(tc_id, [])
                    }
                    impacted_test_cases.append(test_case)

                print(f"DEBUG: Using database count - {db_impacted_count} impacted test cases")

                response = {
                    'story_id': str(story_id),
                    'story_description': str(story_info['story_description']) if story_info['story_description'] else '',
                    'total_test_cases': str(total_test_cases),
                    'impacted_test_cases_count': str(db_impacted_count),
                    'impact_percentage': str(round((db_impacted_count / total_test_cases * 100) if total_test_cases > 0 else 0, 2)),
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
                    WHERE story_id = %s AND user_id = %s
                """, (story_id, user_id))
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
                        WHERE story_id = %s AND user_id = %s
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
                            AND tci.user_id = %s
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
                """, (story_id, user_id, project_id, user_id))

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

@stories_bp.route('/<story_id>/quality', methods=['GET'])
@dev_jwt_required
def get_story_quality(story_id):
    """
    Use LLM to analyze story quality and return:
      - overall_score (0-100)
      - completeness, clarity, testability sub-scores (0-100)
      - issues: list of {title, description, area}
      - risk_areas: list of {area, severity, description}
      - recommendations: list of strings

    Results are cached in the story's inputs JSONB column to avoid
    re-calling the LLM on every page load.
    """
    try:
        user_id = get_current_user_id()

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT story_description, inputs,
                           inputs->>'main_text'    AS main_text,
                           inputs->>'content'      AS input_content,
                           inputs->>'story_description' AS input_desc
                    FROM test_cases
                    WHERE story_id = %s AND user_id = %s
                """, (story_id, user_id))
                row = cur.fetchone()

        if not row:
            # Try LanceDB for content
            import lancedb
            db = lancedb.connect(Config.LANCE_DB_PATH)
            table = db.open_table(Config.TABLE_NAME_LANCE)
            all_rows = table.to_pandas()
            story_rows = all_rows[all_rows['storyID'] == story_id]
            if 'user_id' in story_rows.columns:
                story_rows = story_rows[story_rows['user_id'] == user_id]
            if story_rows.empty:
                return jsonify({'error': 'Story not found'}), 404
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
            cached_quality = inputs.get('quality_analysis')

        # Return cached result if available (avoid re-calling LLM)
        if cached_quality:
            return jsonify(cached_quality), 200

        story_text = content or description
        if not story_text or len(story_text) < 30:
            return jsonify({'error': 'Story content too short for analysis'}), 422

        # Build LLM prompt
        prompt = f"""You are a senior QA analyst and business analyst expert. Analyze this user story and return a quality assessment.

USER STORY:
{story_text[:3000]}

Evaluate the story on three dimensions (0-100 each):
- Completeness: Are all scenarios, edge cases, and error states covered?
- Clarity: Is the story unambiguous and clearly written?
- Testability: Can acceptance criteria be turned directly into test cases?

Also identify:
- Quality issues (things that would cause poor test generation)
- Risk areas (potential defects or security concerns)
- Recommendations (specific improvements)

Return ONLY this JSON, no other text:
{{
  "completeness": <0-100>,
  "clarity": <0-100>,
  "testability": <0-100>,
  "issues": [
    {{"title": "Issue title", "description": "Specific explanation", "area": "Completeness|Clarity|Testability"}}
  ],
  "risk_areas": [
    {{"area": "Risk area name", "severity": "High|Medium|Low", "description": "Why this is risky"}}
  ],
  "recommendations": [
    "Specific actionable recommendation"
  ]
}}

Keep issues to 2-4, risk_areas to 2-3, recommendations to 2-4. Be specific to THIS story, not generic."""

        response = Config.llm.invoke(prompt)
        raw = response.content.strip()

        # Parse JSON
        if '```json' in raw:
            raw = raw.split('```json')[1].split('```')[0].strip()
        elif '```' in raw:
            raw = raw.split('```')[1].strip()
        start = raw.find('{')
        end = raw.rfind('}') + 1
        if start == -1 or end == 0:
            return jsonify({'error': 'LLM did not return valid JSON'}), 500

        result = json.loads(raw[start:end])

        # Compute overall score
        completeness = min(100, max(0, int(result.get('completeness', 70))))
        clarity = min(100, max(0, int(result.get('clarity', 70))))
        testability = min(100, max(0, int(result.get('testability', 70))))
        overall = round(completeness * 0.35 + clarity * 0.35 + testability * 0.30)

        quality = {
            'overall_score': overall,
            'completeness': completeness,
            'clarity': clarity,
            'testability': testability,
            'issues': result.get('issues', [])[:4],
            'risk_areas': result.get('risk_areas', [])[:3],
            'recommendations': result.get('recommendations', [])[:4],
        }

        # Cache result in inputs column
        try:
            with Config.get_postgres_connection() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE test_cases
                        SET inputs = COALESCE(inputs, '{}'::jsonb) || %s::jsonb
                        WHERE story_id = %s AND user_id = %s
                    """, (json.dumps({'quality_analysis': quality}), story_id, user_id))
                    conn.commit()
        except Exception:
            pass  # caching failure is non-fatal

        return jsonify(quality), 200

    except Exception as e:
        print(f'❌ Error in quality analysis for {story_id}: {e}')
        return jsonify({'error': str(e)}), 500


# ── Story Kanban status ───────────────────────────────────────────────────────

@stories_bp.route('/<story_id>/status', methods=['PATCH'])
@dev_jwt_required
def update_story_status(story_id):
    """Update the Kanban column for a story (in_review / in_progress / completed)."""
    try:
        user_id = get_current_user_id()
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
                    WHERE story_id = %s AND user_id = %s
                    RETURNING story_id
                """, (new_status, story_id, user_id))
                row = cur.fetchone()
                if not row:
                    return jsonify({'error': 'Story not found'}), 404
                conn.commit()

        return jsonify({'story_id': story_id, 'status': new_status}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Story version history ─────────────────────────────────────────────────────

@stories_bp.route('/<story_id>/versions', methods=['GET'])
@dev_jwt_required
def get_story_versions(story_id):
    """Return all versions for a story, newest first."""
    try:
        user_id = get_current_user_id()
        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                cur.execute("""
                    SELECT version_id, story_id, version_number, description,
                           file_name, created_on, run_id
                    FROM story_versions
                    WHERE story_id = %s AND user_id = %s
                    ORDER BY version_number DESC
                """, (story_id, user_id))
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


@stories_bp.route('/<story_id>/regenerate', methods=['POST'])
@dev_jwt_required
def regenerate_tests(story_id):
    """Re-run test case generation for an existing story using its stored content."""
    try:
        user_id = get_current_user_id()

        # Fetch existing story content from LanceDB
        db_service = get_db_service()
        story = db_service.get_story(story_id, user_id=user_id)
        if not story:
            return jsonify({'error': f'Story {story_id} not found'}), 404

        import lancedb
        db = lancedb.connect(Config.LANCE_DB_PATH)
        table = db.open_table(Config.TABLE_NAME_LANCE)
        all_rows = table.to_pandas()
        row_data = all_rows[all_rows['storyID'] == story_id]
        if 'user_id' in row_data.columns:
            row_data = row_data[row_data['user_id'] == user_id]
        if row_data.empty:
            return jsonify({'error': 'Story content not found in vector store'}), 404

        project_id = str(row_data.iloc[0].get('project_id', ''))

        # Delete existing test cases so generation creates fresh ones
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM test_cases WHERE story_id = %s AND user_id = %s",
                    (story_id, user_id)
                )
                conn.commit()

        # Re-generate
        from app.LLM.Test_case_generator import generate_test_case_for_story
        import threading
        def run_regen():
            generate_test_case_for_story(story_id, user_id=user_id)
            from app.LLM.impact_analyzer import analyze_test_case_impacts
            try:
                analyze_test_case_impacts(story_id, project_id, user_id=user_id)
            except Exception as e:
                print(f"[Regen] Impact analysis failed: {e}")

        threading.Thread(target=run_regen, daemon=True).start()

        return jsonify({
            'message': 'Test regeneration started',
            'story_id': story_id,
            'project_id': project_id,
        }), 202

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@stories_bp.route('/<story_id>/upload-version', methods=['POST'])
@dev_jwt_required
def upload_new_version(story_id):
    """Upload a new version of an existing story, archive the old one, and regenerate tests."""
    try:
        user_id = get_current_user_id()
        db_service = get_db_service()

        # Story must exist
        existing_story = db_service.get_story(story_id, user_id=user_id)
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

        # Determine next version number
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COALESCE(MAX(version_number), 0) FROM story_versions WHERE story_id = %s AND user_id = %s",
                    (story_id, user_id)
                )
                max_version = cur.fetchone()[0]
                next_version = max_version + 1

                # Get current run_id to archive
                cur.execute(
                    "SELECT run_id FROM test_cases WHERE story_id = %s AND user_id = %s",
                    (story_id, user_id)
                )
                existing_run = cur.fetchone()
                current_run_id = existing_run[0] if existing_run else None

                # Archive current version
                cur.execute("""
                    INSERT INTO story_versions (story_id, user_id, version_number, content, description, file_name, run_id)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (story_id, user_id, version_number) DO NOTHING
                """, (story_id, user_id, next_version - 1 if next_version > 1 else 1,
                      existing_story.get('document_content', ''),
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
            # Delete old entry and re-add
            all_rows = table.to_pandas()
            mask = all_rows['storyID'] != story_id
            if 'user_id' in all_rows.columns:
                mask = mask | (all_rows['user_id'] != user_id)
            kept = all_rows[mask]
            table = db.create_table(Config.TABLE_NAME_LANCE, data=kept, mode='overwrite')
            embedding = get_embedding_model().encode(story_content).tolist()
            from datetime import datetime as _dt
            table.add([{
                'user_id': user_id, 'project_id': project_id,
                'vector': embedding, 'storyID': story_id,
                'storyDescription': short_title, 'test_case_content': '',
                'filename': filename or f"{story_id}.txt",
                'original_path': None, 'doc_content_text': story_content,
                'embedding_timestamp': _dt.now(), 'source': source
            }])
        except Exception as e:
            return jsonify({'error': f'Vector store update failed: {str(e)}'}), 500

        # Delete old test cases and regenerate
        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM test_cases WHERE story_id = %s AND user_id = %s", (story_id, user_id))
                conn.commit()

        import threading
        def run_regen_version():
            from app.LLM.Test_case_generator import generate_test_case_for_story
            generate_test_case_for_story(story_id, user_id=user_id)
            from app.LLM.impact_analyzer import analyze_test_case_impacts
            try:
                analyze_test_case_impacts(story_id, project_id, user_id=user_id)
            except Exception as e:
                print(f"[UploadVersion] Impact analysis failed: {e}")

        threading.Thread(target=run_regen_version, daemon=True).start()

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
        data = request.get_json(silent=True) or {}
        action = data.get('action')
        if action not in ('accept', 'reject', 'edit'):
            return jsonify({'error': 'action must be accept, reject, or edit'}), 400

        new_status = 'accepted' if action in ('accept', 'edit') else 'rejected'
        edited_tc = data.get('edited_test_case')

        with Config.get_postgres_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                # Fetch the impact record to get the modified test case
                cur.execute("""
                    SELECT tci.impact_id, tci.original_story_id, tci.original_test_case_id,
                           tci.impact_analysis_json, tci.user_id,
                           tc.test_case_json
                    FROM test_case_impacts tci
                    JOIN test_cases tc ON tc.story_id = tci.original_story_id AND tc.user_id = tci.user_id
                    WHERE tci.impact_id = %s AND tci.user_id = %s
                """, (impact_id, user_id))
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
                    WHERE impact_id = %s AND user_id = %s
                """, (
                    new_status,
                    json.dumps(edited_tc) if edited_tc else None,
                    json.dumps({'edited_test_case': edited_tc, 'reviewed_by': user_id}) if edited_tc else None,
                    impact_id,
                    user_id,
                ))

                # Write to impact_history
                cur.execute("""
                    INSERT INTO impact_history
                        (history_id, impact_id, changed_by, previous_status, new_status, change_reason)
                    VALUES (%s, %s, %s, 'active', %s, 'user_review')
                """, (str(uuid.uuid4()), impact_id, user_id, new_status))

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
                                WHERE story_id = %s AND user_id = %s
                            """, (json.dumps(tc_json), original_story_id, user_id))

                conn.commit()

        return jsonify({
            'impact_id': impact_id,
            'new_status': new_status,
            'message': 'Impact accepted — test case updated in story' if new_status == 'accepted' else 'Impact rejected'
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
        data = request.get_json(silent=True) or {}
        project_id = data.get('project_id')
        new_story_id = data.get('new_story_id')
        reviews = data.get('reviews', [])

        if not reviews:
            return jsonify({'error': 'reviews list is required'}), 400

        accepted = rejected = edited = 0

        with Config.get_postgres_connection() as conn:
            with conn.cursor() as cur:
                for review in reviews:
                    iid = review.get('impact_id')
                    action = review.get('action')
                    if not iid or action not in ('accept', 'reject', 'edit'):
                        continue

                    new_status = 'accepted' if action in ('accept', 'edit') else 'rejected'
                    edited_tc = review.get('edited_test_case')

                    cur.execute("""
                        UPDATE test_case_impacts
                        SET impact_status = %s,
                            impact_details = CASE
                                WHEN %s IS NOT NULL THEN %s::jsonb
                                ELSE impact_details
                            END
                        WHERE impact_id = %s AND user_id = %s
                    """, (
                        new_status,
                        json.dumps(edited_tc) if edited_tc else None,
                        json.dumps({'edited_test_case': edited_tc, 'reviewed_by': user_id}) if edited_tc else None,
                        iid,
                        user_id,
                    ))

                    cur.execute("""
                        INSERT INTO impact_history
                            (history_id, impact_id, changed_by, previous_status, new_status, change_reason)
                        VALUES (%s, %s, %s, 'active', %s, 'batch_review')
                    """, (str(uuid.uuid4()), iid, user_id, new_status))

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
    List change requests — grouped impacts by new_story_id.
    A change request = all impacts that a new story caused on existing stories.
    Query params: project_id, status (pending|approved|rejected|all), page, per_page
    """
    try:
        user_id = get_current_user_id()
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
                # Build query — group impacts by new_story_id
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
                    WHERE tci.user_id = %s
                """
                params = [user_id]

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
                        WHERE tci.user_id = %s
                """
                count_params = [user_id]
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

