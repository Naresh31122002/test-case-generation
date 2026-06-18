import redis
import os

# Use the same Redis instance as Celery/Limiter
redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
jwt_redis_blocklist = redis.StrictRedis.from_url(redis_url, decode_responses=True)

def check_if_token_is_revoked(jwt_header, jwt_payload: dict) -> bool:
    """
    Callback function to check if a JWT exists in the Redis blocklist.
    """
    jti = jwt_payload["jti"]
    token_in_redis = jwt_redis_blocklist.get(jti)
    return token_in_redis is not None
