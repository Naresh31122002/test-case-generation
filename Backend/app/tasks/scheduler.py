import os
import asyncio
from datetime import datetime
from celery_app import celery

# Import Jira integration gracefully
try:
    from app.services.jira_integration_improved import JiraIntegration, JiraStatus, JiraIssueType
    JIRA_AVAILABLE = True
except ImportError:
    JIRA_AVAILABLE = False

def get_jira_config():
    """Get Jira configuration from environment variables"""
    jira_sync_enabled = os.getenv('JIRA_SYNC_ENABLED', 'false').lower() == 'true'
    jira_project_keys = os.getenv('JIRA_PROJECT_KEYS', '').split(',') if os.getenv('JIRA_PROJECT_KEYS') else []
    jira_sync_all_projects = os.getenv('JIRA_SYNC_ALL_PROJECTS', 'false').lower() == 'true'
    jira_project_keys = [key.strip() for key in jira_project_keys if key.strip()]
    
    return {
        'sync_enabled': jira_sync_enabled,
        'project_keys': jira_project_keys,
        'sync_all_projects': jira_sync_all_projects
    }

async def sync_jira_stories():
    """Sync stories from Jira projects asynchronously"""
    if not JIRA_AVAILABLE:
        return
    
    jira_config = get_jira_config()
    if not jira_config['sync_enabled']:
        return
    
    try:
        integration = JiraIntegration()
        if jira_config['sync_all_projects']:
            await integration.sync_all_available_projects(
                workspace_id="00000000-0000-0000-0000-000000000000",
                statuses=[JiraStatus.SELECTED_FOR_DEV, JiraStatus.IN_PROGRESS],
                issue_types=[JiraIssueType.STORY]
            )
        elif jira_config['project_keys']:
            await integration.sync_stories_from_multiple_projects(
                workspace_id="00000000-0000-0000-0000-000000000000",
                project_keys=jira_config['project_keys'],
                statuses=[JiraStatus.SELECTED_FOR_DEV, JiraStatus.IN_PROGRESS],
                issue_types=[JiraIssueType.STORY]
            )
    except Exception as e:
        print(f"[Celery] Error syncing from Jira: {e}")

@celery.task
def run_pipeline():
    """Main pipeline execution scheduled by Celery Beat"""
    print(f"🔄 [Celery] Starting pipeline at {datetime.now()}")
    
    try:
        # Step 0: Sync from Jira
        if JIRA_AVAILABLE:
            jira_config = get_jira_config()
            if jira_config['sync_enabled']:
                asyncio.run(sync_jira_stories())
        
        # Step 1: Process project folders and generate embeddings
        from app.datapipeline.embedding_generator import generate_embeddings
        generate_embeddings(workspace_id="00000000-0000-0000-0000-000000000000")
        
        # Step 2: Generate test cases for all stories
        from app.LLM.Test_case_generator import generate_test_cases_for_all_stories
        generate_test_cases_for_all_stories()

        # Step 3: Run impact analysis
        from app.LLM.impact_analyzer import analyze_test_case_impacts
        from app.models.db_service import get_db_service

        db_service = get_db_service()
        # For global background jobs, get_all_stories with no workspace_id returns everything
        stories = db_service.get_all_stories()

        for story in stories:
            try:
                analyze_test_case_impacts(
                    new_story_id=story["id"],
                    project_id=story["project_id"]
                )
            except Exception as e:
                print(f"[Celery] Impact analysis failed for {story['id']}: {e}")
                
        print(f"✅ [Celery] Pipeline completed successfully.")
        
    except Exception as e:
        print(f"❌ [Celery] Error in scheduled job: {e}")
