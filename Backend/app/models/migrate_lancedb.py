import os
import sys
import lancedb
import psycopg2
import psycopg2.extras
import pyarrow as pa
from datetime import datetime

# Add the Backend directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.abspath(os.path.join(current_dir, "../.."))
sys.path.insert(0, backend_dir)

from app.config import Config

def migrate_lancedb():
    print("🚀 Starting LanceDB Migration for Multi-Tenancy (adding workspace_id)")
    
    db = lancedb.connect(Config.LANCE_DB_PATH)
    
    # 1. Read existing data
    try:
        table = db.open_table(Config.TABLE_NAME_LANCE)
        df = table.to_pandas()
        print(f"✅ Loaded {len(df)} existing vectors from LanceDB")
    except Exception as e:
        print(f"⚠️ Could not open existing table (might not exist): {e}")
        return
        
    if len(df) == 0:
        print("✅ No data to migrate.")
        # Just drop and recreate to apply schema
        db.drop_table(Config.TABLE_NAME_LANCE)
        create_new_table(db)
        return

    # 2. Query Postgres to map storyID to workspace_id
    print("🔍 Querying PostgreSQL for workspace_ids...")
    story_to_workspace = {}
    try:
        with psycopg2.connect(
            dbname=Config.POSTGRES_DB,
            user=Config.POSTGRES_USER,
            password=Config.POSTGRES_PASSWORD,
            host=Config.POSTGRES_HOST,
            port=Config.POSTGRES_PORT
        ) as conn:
            with conn.cursor() as cur:
                story_ids = df['storyID'].tolist()
                cur.execute("SELECT story_id, workspace_id FROM test_cases WHERE story_id = ANY(%s)", (story_ids,))
                for row in cur.fetchall():
                    if row[1]: # if workspace_id is not null
                        story_to_workspace[row[0]] = str(row[1])
        print(f"✅ Found {len(story_to_workspace)} workspace mappings in PostgreSQL")
    except Exception as e:
        print(f"❌ Failed to query PostgreSQL: {e}")
        return

    # 3. Add workspace_id column to dataframe
    # If a workspace_id is missing, we use a fallback or skip. We must provide a string.
    fallback_ws = "00000000-0000-0000-0000-000000000000"
    df['workspace_id'] = df['storyID'].map(lambda x: story_to_workspace.get(x, fallback_ws))
    
    unmapped_count = sum(df['workspace_id'] == fallback_ws)
    if unmapped_count > 0:
        print(f"⚠️ WARNING: {unmapped_count} stories had no workspace_id mapping in PostgreSQL. They are assigned a fallback ID.")
    
    # Ensure columns match new schema
    # LanceDB might return internal columns like id or _distance, we only want the schema columns
    schema_cols = [
        "workspace_id", "user_id", "project_id", "vector", "storyID", 
        "storyDescription", "test_case_content", "filename", "original_path", 
        "doc_content_text", "embedding_timestamp", "source"
    ]
    
    # Fill missing columns if they didn't exist in old schema
    for col in schema_cols:
        if col not in df.columns:
            if col == "workspace_id": continue # already added
            if col == "vector": continue # must exist
            if col == "embedding_timestamp": 
                df[col] = datetime.now()
            else:
                df[col] = ""
    
    # Filter to only schema columns
    df = df[schema_cols]
    
    # 4. Drop old table
    print("🗑️ Dropping old LanceDB table...")
    db.drop_table(Config.TABLE_NAME_LANCE)
    
    # 5. Recreate table with new schema
    print("🏗️ Creating new LanceDB table with workspace_id schema...")
    new_table = create_new_table(db)
    
    # 6. Insert data
    print("💾 Inserting migrated data...")
    # We must convert dataframe to list of dicts for safe ingestion with PyArrow schema
    records = df.to_dict('records')
    new_table.add(records)
    
    print(f"🎉 Migration Complete! Successfully migrated {len(records)} vectors.")

def create_new_table(db):
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
    return db.create_table(Config.TABLE_NAME_LANCE, schema=schema)

if __name__ == "__main__":
    migrate_lancedb()
