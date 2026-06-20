import os
from dotenv import load_dotenv

load_dotenv()

# Lazy globals
_llm = None
_llm_impact = None

def get_embedding_model():
    """Return a lightweight embedding wrapper using Google Generative AI API."""
    return GoogleEmbeddingWrapper()

def get_llm():
    global _llm
    if _llm is None:
        from langchain_groq import ChatGroq
        # llama-3.3-70b-versatile: higher quality + higher TPM limit than 8b-instant
        _llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.3,
            groq_api_key=os.environ["GROQ_API_KEY"]
        )
    return _llm

def get_llm_impact():
    global _llm_impact
    if _llm_impact is None:
        from langchain_groq import ChatGroq
        # Use the faster 8b model for impact analysis (more calls, smaller prompts)
        _llm_impact = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.3,
            groq_api_key=os.environ.get("GROQ_API_KEY_IMPACT", os.environ["GROQ_API_KEY"])
        )
    return _llm_impact


class GoogleEmbeddingWrapper:
    """Wraps Google's text-embedding-004 model using the new google-genai SDK.
    Produces 768-dim vectors padded/truncated to match LanceDB schema."""

    def encode(self, text, **kwargs):
        import numpy as np
        api_key = os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
        if not api_key:
            return np.zeros(768, dtype="float32")
        try:
            from google import genai
            from google.genai import types as genai_types
            client = genai.Client(api_key=api_key)
            result = client.models.embed_content(
                model="models/gemini-embedding-001",
                contents=text,
                config=genai_types.EmbedContentConfig(output_dimensionality=768),
            )
            vec = result.embeddings[0].values
        except Exception as e:
            print(f"Embedding failed: {e} — using zero vector")
            return np.zeros(768, dtype="float32")
        # Pad or truncate to 768 dimensions
        vec = list(vec)
        if len(vec) < 768:
            vec = vec + [0.0] * (768 - len(vec))
        elif len(vec) > 768:
            vec = vec[:768]
        return np.array(vec, dtype="float32")


# Module-level aliases used by embedding_generator.py and other legacy imports
llm = None          # accessed as llm.invoke() — replaced at runtime via get_llm()
EMBEDDING_MODEL = None  # replaced at runtime via get_embedding_model()


class Config:
    # Database configurations
    POSTGRES_DB = os.getenv('POSTGRES_DB', 'test_case_generator')
    POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
    POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'admin')
    POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
    POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')

    LANCE_DB_PATH = os.getenv('LANCE_DB_PATH', './data/lance_db')
    TABLE_NAME_LANCE = os.getenv('TABLE_NAME_LANCE', 'user_stories')

    TEST_CASE_COUNTS = {
        "positive": int(os.getenv('TEST_CASE_COUNT_POSITIVE', '50')),
        "negative": int(os.getenv('TEST_CASE_COUNT_NEGATIVE', '30')),
        "boundary": int(os.getenv('TEST_CASE_COUNT_BOUNDARY', '10')),
        "security": int(os.getenv('TEST_CASE_COUNT_SECURITY', '10')),
        "performance": int(os.getenv('TEST_CASE_COUNT_PERFORMANCE', '10'))
    }

    # AWS SES Configuration
    AWS_SES_REGION = os.getenv("AWS_SES_REGION", "us-east-1")
    AWS_SES_ACCESS_KEY = os.getenv("AWS_SES_ACCESS_KEY")
    AWS_SES_SECRET_KEY = os.getenv("AWS_SES_SECRET_KEY")
    MAIL_DEFAULT_SENDER = os.getenv("MAIL_DEFAULT_SENDER", "noreply@kynetropo.com")

    # Admin Dashboard — no hardcoded fallback. Must be set via environment
    # variables; app/__init__.py refuses to start if either is missing.
    ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
    ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

    # Security / Monitoring
    SENTRY_DSN = os.getenv("SENTRY_DSN", "")

    # Google OAuth (Sign in with Google) — Client ID is also used by the
    # frontend (NEXT_PUBLIC_GOOGLE_CLIENT_ID) to render the official button;
    # the backend verifies ID tokens are issued for this same client.
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")

    @property
    def EMBEDDING_MODEL(self):
        return get_embedding_model()

    @property
    def llm(self):
        return get_llm()

    @property
    def llm_impact(self):
        return get_llm_impact()

    @classmethod
    def get_postgres_connection(cls):
        import psycopg2
        import time
        last_err = None
        for attempt in range(3):
            try:
                return psycopg2.connect(
                    dbname=cls.POSTGRES_DB,
                    user=cls.POSTGRES_USER,
                    password=cls.POSTGRES_PASSWORD,
                    host=cls.POSTGRES_HOST,
                    port=cls.POSTGRES_PORT,
                    sslmode='require',
                    connect_timeout=10,
                )
            except Exception as e:
                last_err = e
                if attempt < 2:
                    time.sleep(1)
        raise last_err

    @classmethod
    def postgres_config(cls):
        return {
            'dbname': cls.POSTGRES_DB,
            'user': cls.POSTGRES_USER,
            'password': cls.POSTGRES_PASSWORD,
            'host': cls.POSTGRES_HOST,
            'port': cls.POSTGRES_PORT,
            'sslmode': 'require'
        }


class DevelopmentConfig(Config):
    pass

class ProductionConfig(Config):
    pass

class TestingConfig(Config):
    TESTING = True
    POSTGRES_DB = 'test_db'
    LANCE_DB_PATH = './data/test_lance_db'

config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}

# Singleton — all code using Config.llm / Config.EMBEDDING_MODEL uses this instance
Config = Config()
