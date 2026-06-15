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
        _llm = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.3,
            groq_api_key=os.environ["GROQ_API_KEY"]
        )
    return _llm

def get_llm_impact():
    global _llm_impact
    if _llm_impact is None:
        from langchain_groq import ChatGroq
        _llm_impact = ChatGroq(
            model="llama-3.1-8b-instant",
            temperature=0.3,
            groq_api_key=os.environ.get("GROQ_API_KEY_IMPACT", os.environ["GROQ_API_KEY"])
        )
    return _llm_impact


class GoogleEmbeddingWrapper:
    """Wraps Google's text-embedding-004 model to match SentenceTransformer API.
    Produces 768-dim vectors — same dimension as all-mpnet-base-v2.
    Zero RAM overhead — uses the API, no local model loaded."""

    def encode(self, text, **kwargs):
        import google.generativeai as genai
        import numpy as np
        api_key = os.environ.get("GOOGLE_GENERATIVE_AI_API_KEY")
        if not api_key:
            # Fallback: zero vector if no API key
            return np.zeros(768, dtype="float32")
        genai.configure(api_key=api_key)
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=text,
            task_type="retrieval_document",
        )
        vec = result["embedding"]
        # Pad or truncate to 768 dimensions to match existing LanceDB schema
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
        return psycopg2.connect(
            dbname=cls.POSTGRES_DB,
            user=cls.POSTGRES_USER,
            password=cls.POSTGRES_PASSWORD,
            host=cls.POSTGRES_HOST,
            port=cls.POSTGRES_PORT
        )

    @classmethod
    def postgres_config(cls):
        return {
            'dbname': cls.POSTGRES_DB,
            'user': cls.POSTGRES_USER,
            'password': cls.POSTGRES_PASSWORD,
            'host': cls.POSTGRES_HOST,
            'port': cls.POSTGRES_PORT
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
