import os
from dotenv import load_dotenv

load_dotenv()

# Lazy globals — loaded on first access, not at import time
_embedding_model = None
_llm = None
_llm_impact = None

def get_embedding_model():
    global _embedding_model
    if _embedding_model is None:
        from sentence_transformers import SentenceTransformer
        _embedding_model = SentenceTransformer("sentence-transformers/all-mpnet-base-v2")
    return _embedding_model

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


class Config:
    # Database configurations
    POSTGRES_DB = os.getenv('POSTGRES_DB', 'test_case_generator')
    POSTGRES_USER = os.getenv('POSTGRES_USER', 'postgres')
    POSTGRES_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'admin')
    POSTGRES_HOST = os.getenv('POSTGRES_HOST', 'localhost')
    POSTGRES_PORT = os.getenv('POSTGRES_PORT', '5432')

    LANCE_DB_PATH = os.getenv('LANCE_DB_PATH', './data/lance_db')
    TABLE_NAME_LANCE = os.getenv('TABLE_NAME_LANCE', 'user_stories')

    # Test case generation configuration
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

# Singleton instance — all code that does Config.llm / Config.EMBEDDING_MODEL uses this
Config = Config()
