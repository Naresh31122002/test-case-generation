import redis
import os

redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

try:
    jwt_redis_blocklist = redis.StrictRedis.from_url(redis_url, decode_responses=True)
    jwt_redis_blocklist.ping()
    _redis_available = True
except Exception:
    jwt_redis_blocklist = None
    _redis_available = False
    print("WARNING: Redis unavailable — JWT blocklist disabled. Logouts won't revoke tokens until Redis is running.")

def check_if_token_is_revoked(jwt_header, jwt_payload: dict) -> bool:
    if not _redis_available or jwt_redis_blocklist is None:
        return False  # graceful degradation — tokens are not blocklisted without Redis
    jti = jwt_payload["jti"]
    try:
        return jwt_redis_blocklist.get(jti) is not None
    except Exception:
        return False
