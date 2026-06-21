import psycopg2
import lancedb
import json
from typing import Dict, Any, List, Optional
import pandas as pd
import numpy as np
from app.config import Config
import psycopg2.extras

class DatabaseService:
    _instance = None

    def __init__(self, postgres_config: Dict[str, Any], lance_db_path: str):
        """Initialize database connections"""
        if DatabaseService._instance is not None:
            raise Exception("DatabaseService is a singleton!")

        self.postgres_config = postgres_config
        self.lance_db_path = lance_db_path
        self.lance_db = lancedb.connect(lance_db_path)
        self.postgres_config = {
            'dbname': Config.POSTGRES_DB,
            'user': Config.POSTGRES_USER,
            'password': Config.POSTGRES_PASSWORD,
            'host': Config.POSTGRES_HOST,
            'port': Config.POSTGRES_PORT
        }
        self.TABLE_NAME_LANCE = Config.TABLE_NAME_LANCE
        DatabaseService._instance = self
        # Auto-create LanceDB table if it doesn't exist
        self._ensure_lance_table()

    def _ensure_lance_table(self):
        """Create LanceDB table if it doesn't exist."""
        try:
            self.lance_db.open_table(self.TABLE_NAME_LANCE)
        except Exception:
            import pyarrow as pa
            schema = pa.schema([
                ("workspace_id", pa.string()),
                ("user_id", pa.string()),
                ("project_id", pa.string()),
                ("vector", pa.list_(pa.float32(), 768)),
                ("storyID", pa.string()),
                ("storyDescription", pa.string()),
                ("test_case_content", pa.string()),
                ("filename", pa.string()),
                ("original_path", pa.string()),
                ("doc_content_text", pa.string()),
                ("embedding_timestamp", pa.timestamp("us")),
                ("source", pa.string())
            ])
            self.lance_db.create_table(self.TABLE_NAME_LANCE, schema=schema)
            print(f"Created LanceDB table '{self.TABLE_NAME_LANCE}'")

    def get_recent_stories(self, page: int = 1, per_page: int = 10, from_date: str = None, to_date: str = None, project_id: str = None, sort_order: str = 'desc', user_id: str = None, workspace_id: str = None) -> Dict[str, Any]:
        """
        Get paginated stories with test case information from both PostgreSQL and LanceDB.
        Scoped to workspace_id (preferred) or user_id.
        """
        try:
            if not workspace_id:
                raise ValueError("workspace_id is required")

            # Get stories from LanceDB
            stories_table = self.lance_db.open_table(self.TABLE_NAME_LANCE)
            lance_stories = stories_table.to_pandas()

            # Strict workspace filter
            if 'workspace_id' not in lance_stories.columns:
                return {'stories': [], 'total': 0, 'total_pages': 0, 'current_page': page, 'per_page': per_page}
                
            lance_stories = lance_stories[lance_stories['workspace_id'] == workspace_id]

            # Filter by project_id if provided
            if project_id:
                lance_stories = lance_stories[lance_stories['project_id'] == project_id]

            # Get all stories with their test case creation times for sorting
            story_ids = lance_stories['storyID'].tolist()
            created_on_map = {}
            test_case_times_map = {}
            test_case_count_map = {}
            test_case_source_map = {}

            with psycopg2.connect(**self.postgres_config) as conn:
                with conn.cursor() as cur:
                    query = """
                        SELECT story_id, created_on, total_test_cases, source
                        FROM test_cases
                        WHERE story_id = ANY(%s)
                    """
                    params = [story_ids]
                    if workspace_id:
                        query += " AND workspace_id = %s"
                        params.append(workspace_id)
                    elif user_id:
                        query += " AND user_id = %s"
                        params.append(user_id)
                    query += " ORDER BY created_on DESC NULLS LAST"
                    cur.execute(query, params)
                    for row in cur.fetchall():
                        story_id, created_on, total_test_cases, source = row
                        if story_id not in created_on_map:
                            created_on_map[story_id] = created_on
                            test_case_times_map[story_id] = created_on
                            test_case_count_map[story_id] = total_test_cases
                            test_case_source_map[story_id] = source

            # Add created_on and test_case_created_time to LanceDB data
            lance_stories['created_on'] = lance_stories['storyID'].map(created_on_map)
            lance_stories['test_case_created_time'] = lance_stories['storyID'].map(test_case_times_map)
            lance_stories['total_test_cases'] = lance_stories['storyID'].map(test_case_count_map)
            lance_stories['test_case_source'] = lance_stories['storyID'].map(test_case_source_map)

            # Filter by date range if provided
            if from_date:
                lance_stories = lance_stories[lance_stories['created_on'] >= from_date]
            if to_date:
                lance_stories = lance_stories[lance_stories['created_on'] <= to_date]

            # Sort by test_case_created_time based on sort_order
            ascending = sort_order.lower() == 'asc'
            lance_stories = lance_stories.sort_values(
                by=['test_case_created_time', 'storyID'],
                ascending=[ascending, True],
                na_position='last'
            )

            # Calculate pagination
            total_stories = len(lance_stories)
            total_pages = (total_stories + per_page - 1) // per_page
            start_idx = (page - 1) * per_page
            end_idx = start_idx + per_page

            # Get paginated stories
            paginated_stories = lance_stories.iloc[start_idx:end_idx]

            stories = []
            for _, lance_story in paginated_stories.iterrows():
                story_id = lance_story['storyID']
                test_case_created_time = lance_story['test_case_created_time']
                test_case_count = lance_story.get('total_test_cases', 0)

                stories.append({
                    'id': story_id,
                    'description': lance_story['storyDescription'],
                    'document_content': lance_story.get('document_content', None),
                    'test_case_count': test_case_count if test_case_count is not None else 0,
                    'download_link': f'/api/stories/download/{story_id}',
                    'test_case_created_time': test_case_created_time.isoformat() if test_case_created_time else None,
                    'project_id': lance_story['project_id'],
                    'source': {
                        'story': lance_story.get('source', 'backend'),
                        'test_cases': lance_story.get('test_case_source', 'backend')
                    }
                })

            return {
                'stories': stories,
                'total': total_stories,
                'total_pages': total_pages,
                'current_page': page,
                'per_page': per_page
            }
        except Exception as e:
            print(f"Error getting recent stories: {str(e)}")
            return {
                'stories': [],
                'total': 0,
                'total_pages': 0,
                'current_page': page,
                'per_page': per_page
            }

    def get_story(self, story_id: str, user_id: str = None, workspace_id: str = None) -> Optional[Dict[str, Any]]:
        """Get a specific story by ID. Scoped strictly to workspace_id."""
        try:
            if not workspace_id:
                raise ValueError("workspace_id is required")
                
            # Get story from LanceDB
            stories_table = self.lance_db.open_table(self.TABLE_NAME_LANCE)
            story_data = stories_table.to_pandas()
            lance_story = story_data[story_data['storyID'] == story_id]

            # Strict workspace filter
            if 'workspace_id' in lance_story.columns:
                lance_story = lance_story[lance_story['workspace_id'] == workspace_id]
            else:
                return None

            if lance_story.empty:
                print(f"Story not found in LanceDB: {story_id}")
                return None

            # Get the latest test case row + count impacts this story caused
            with psycopg2.connect(**self.postgres_config) as conn:
                with conn.cursor() as cur:
                    query = """
                        SELECT tc.total_test_cases, tc.created_on, tc.source,
                               COALESCE(tc.impacted_test_cases_count, 0) as received_impacts,
                               COALESCE((
                                   SELECT COUNT(*) FROM test_case_impacts tci
                                   WHERE tci.new_story_id = %s
                                     AND tci.workspace_id = %s
                                     AND tci.impact_status = 'active'
                               ), 0) as caused_impacts
                        FROM test_cases tc
                        WHERE tc.story_id = %s
                    """
                    params = [story_id, workspace_id, story_id]
                    if workspace_id:
                        query += " AND tc.workspace_id = %s"
                        params.append(workspace_id)
                    elif user_id:
                        query += " AND tc.user_id = %s"
                        params.append(user_id)
                    query += " ORDER BY tc.created_on DESC NULLS LAST LIMIT 1"
                    cur.execute(query, params)
                    pg_result = cur.fetchone()

            # Get embedding_timestamp from LanceDB
            embedding_timestamp = None
            if 'embedding_timestamp' in lance_story.columns:
                ts = lance_story['embedding_timestamp'].iloc[0]
                if ts:
                    if hasattr(ts, 'isoformat'):
                        embedding_timestamp = ts.isoformat()
                    else:
                        from dateutil import parser
                        embedding_timestamp = parser.parse(ts).isoformat()

            return {
                'id': story_id,
                'description': lance_story['storyDescription'].iloc[0],
                'document_content': lance_story['doc_content_text'].iloc[0] if 'doc_content_text' in lance_story.columns else None,
                'test_case_count': pg_result[0] if pg_result else 0,
                # caused_impacts: how many impacts this story caused on other stories
                # received_impacts: how many of this story's own test cases were impacted
                'impactedTestCases': (pg_result[4] if pg_result and len(pg_result) > 4 else 0),
                'impacted_test_cases_count': (pg_result[4] if pg_result and len(pg_result) > 4 else 0),
                'download_link': f'/api/stories/download/{story_id}',
                'test_case_created_time': pg_result[1].isoformat() if pg_result and pg_result[1] else None,
                'embedding_timestamp': embedding_timestamp,
                'project_id': lance_story['project_id'].iloc[0] if 'project_id' in lance_story.columns else '',
                'source': {
                    'story': lance_story['source'].iloc[0] if 'source' in lance_story.columns else 'backend',
                    'test_cases': pg_result[2] if pg_result and len(pg_result) > 2 else 'backend'
                }
            }
        except Exception as e:
            print(f"Error getting story {story_id}: {str(e)}")
            return None

    def get_all_stories(self, workspace_id: str = None) -> List[Dict[str, Any]]:
        """Return all stories that have test cases generated.
        If workspace_id is provided, scopes to that workspace.
        Otherwise (e.g. for the global scheduler), returns all.
        """
        try:
            with psycopg2.connect(**self.postgres_config) as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    if workspace_id:
                        cur.execute("""
                            SELECT story_id, project_id, user_id
                            FROM test_cases
                            WHERE test_case_generated = TRUE AND workspace_id = %s
                            ORDER BY created_on DESC NULLS LAST
                        """, (workspace_id,))
                    else:
                        cur.execute("""
                            SELECT story_id, project_id, user_id
                            FROM test_cases
                            WHERE test_case_generated = TRUE
                            ORDER BY created_on DESC NULLS LAST
                        """)
                    return [
                        {'id': row['story_id'], 'project_id': row['project_id'], 'user_id': str(row['user_id']) if row['user_id'] else None}
                        for row in cur.fetchall()
                    ]
        except Exception as e:
            print(f"Error getting all stories: {str(e)}")
            return []

    def search_similar_stories(self, query: str, limit: int = 3, user_id: str = None, workspace_id: str = None) -> Dict[str, Any]:
        """
        Search for similar stories using vector similarity.
        Scoped to workspace_id (preferred) or user_id.
        """
        try:
            if not query or not query.strip():
                return {'stories': [], 'error': 'Query cannot be empty'}
                
            if not workspace_id:
                return {'stories': [], 'error': 'workspace_id is required'}

            # Get stories table from LanceDB
            stories_table = self.lance_db.open_table(self.TABLE_NAME_LANCE)

            # Encode the query using the embedding model
            query_vector = Config.EMBEDDING_MODEL.encode(query).tolist()

            # Execute native LanceDB vector search with SQL pre-filter
            results = (
                stories_table.search(query_vector)
                .where(f"workspace_id = '{workspace_id}'")
                .metric("cosine")
                .limit(limit)
                .to_list()
            )

            if not results:
                return {'stories': [], 'message': 'No matching stories found'}

            # Get PostgreSQL connection for fetching additional data
            with psycopg2.connect(**self.postgres_config) as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
                    stories = []
                    for result in results:
                        story_id = result['storyID']

                        # Fetch test case data and impacted test cases count
                        query_sql = """
                            SELECT
                                story_description,
                                test_case_json,
                                total_test_cases,
                                created_on,
                                source,
                                impacted_test_cases_count,
                                inputs
                            FROM test_cases
                            WHERE story_id = %s
                        """
                        params = [story_id]
                        if workspace_id:
                            query_sql += " AND workspace_id = %s"
                            params.append(workspace_id)
                        elif user_id:
                            query_sql += " AND user_id = %s"
                            params.append(user_id)
                        cur.execute(query_sql, params)
                        pg_result = cur.fetchone()

                        if pg_result:
                            # Get additional content from PostgreSQL inputs if available
                            pg_inputs = pg_result['inputs'] if pg_result['inputs'] else {}
                            if isinstance(pg_inputs, str):
                                pg_inputs = json.loads(pg_inputs)

                            # Use the most complete content available
                            content = (
                                result.get('doc_content_text', '') or
                                result.get('storyDescription', '') or
                                pg_inputs.get('content', '') or
                                pg_inputs.get('file_content', '') or
                                pg_result['story_description']
                            )

                            story_data = {
                                'id': story_id,
                                'description': pg_result['story_description'],
                                'document_content': content,
                                'story_content': content,
                                'content': content,
                                'test_case_count': pg_result['total_test_cases'] or 0,
                                'impactedTestCases': pg_result['impacted_test_cases_count'] or 0,
                                'download_link': f'/api/stories/download/{story_id}',
                                'test_case_created_time': pg_result['created_on'].isoformat() if pg_result['created_on'] else None,
                                'test_case_json': pg_result['test_case_json'],
                                'similarity_score': result.get('_distance'),
                                'source': {
                                    'story': result.get('source', 'backend'),
                                    'test_cases': pg_result['source'] or 'backend'
                                }
                            }
                            stories.append(story_data)

            return {'stories': stories}
        except Exception as e:
            print(f"Error searching stories: {str(e)}")
            return {'stories': [], 'error': str(e)}


def get_db_service() -> DatabaseService:
    """Get or create the singleton instance of DatabaseService"""
    if DatabaseService._instance is None:
        DatabaseService(
            postgres_config={
                'dbname': Config.POSTGRES_DB,
                'user': Config.POSTGRES_USER,
                'password': Config.POSTGRES_PASSWORD,
                'host': Config.POSTGRES_HOST,
                'port': Config.POSTGRES_PORT
            },
            lance_db_path=Config.LANCE_DB_PATH
        )
    return DatabaseService._instance
