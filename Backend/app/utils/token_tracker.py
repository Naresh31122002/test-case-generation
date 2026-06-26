"""
Token usage tracker — logs LLM input/output tokens per action to the
token_usage table so admins can audit cost per workspace/user.
"""
import uuid
from app.config import Config


def log_token_usage(
    action: str,
    provider: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    workspace_id: str = None,
    user_id: str = None,
    story_id: str = None,
):
    """Fire-and-forget token usage log. Never raises — best effort only."""
    conn = None
    try:
        conn = Config.get_postgres_connection()
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO token_usage
                    (workspace_id, user_id, action, provider, model,
                     input_tokens, output_tokens, story_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                workspace_id or None,
                user_id or None,
                action,
                provider,
                model,
                input_tokens,
                output_tokens,
                story_id or None,
            ))
        conn.commit()
    except Exception as e:
        print(f"[token_usage] Failed to log: {e}")
    finally:
        if conn is not None:
            try:
                conn.close()
            except Exception:
                pass


def extract_groq_tokens(response) -> tuple[int, int]:
    """Extract (input_tokens, output_tokens) from a Groq/LangChain response."""
    try:
        meta = getattr(response, 'usage_metadata', None) or getattr(response, 'response_metadata', {})
        if hasattr(meta, 'get'):
            inp = meta.get('input_tokens') or meta.get('prompt_tokens') or 0
            out = meta.get('output_tokens') or meta.get('completion_tokens') or 0
            return int(inp), int(out)
        # LangChain wraps it differently sometimes
        usage = getattr(response, 'usage', None)
        if usage:
            return int(getattr(usage, 'prompt_tokens', 0)), int(getattr(usage, 'completion_tokens', 0))
    except Exception:
        pass
    return 0, 0
