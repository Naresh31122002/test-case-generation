import requests
import time

BASE = 'http://localhost:5000'
s = requests.Session()
results = []

def test(name, method, path, **kwargs):
    try:
        r = getattr(s, method)(BASE + path, **kwargs)
        body = ''
        try:
            body = str(r.json())[:120]
        except Exception:
            body = r.text[:120]
        icon = 'OK  ' if r.status_code < 400 else 'FAIL'
        results.append('[%s] %s %s | %s' % (icon, r.status_code, name, body))
    except Exception as e:
        results.append('[ERR] %s | %s' % (name, e))

# 1. Register
test('register', 'post', '/api/auth/register',
     json={'email': 'audit3@testsurge.com', 'password': 'Test@1234'})

# 2. Login
r = s.post(BASE + '/api/auth/login',
           json={'email': 'audit3@testsurge.com', 'password': 'Test@1234'})
ws_id = ''
if r.ok:
    ws_id = (r.json().get('current_workspace') or {}).get('id', '')
icon = 'OK  ' if r.ok else 'FAIL'
results.append('[%s] %s login | ws=%s' % (icon, r.status_code, ws_id[:8]))

h = {'X-Workspace-Id': ws_id} if ws_id else {}

# 3. /auth/me
test('GET /auth/me', 'get', '/api/auth/me')

# 4. /stories/projects
test('GET /stories/projects', 'get', '/api/stories/projects', headers=h)

# 5. /stories/ list
test('GET /stories/', 'get', '/api/stories/?page=1&per_page=5', headers=h)

# 6. /workspaces
test('GET /workspaces', 'get', '/api/workspaces', headers=h)

# 7. Upload story
test('POST /stories/upload', 'post', '/api/stories/upload', headers=h,
     data={
         'project_id': 'audit_proj',
         'story_id': 'AUD-TEST-001',
         'content': 'As a user I want to audit endpoints so I can verify the system works.',
         'source': 'manual'
     })

time.sleep(2)

# 8. Get single story
test('GET /stories/AUD-TEST-001', 'get', '/api/stories/AUD-TEST-001', headers=h)

# 9. Patch status
test('PATCH /stories/AUD-TEST-001/status', 'patch', '/api/stories/AUD-TEST-001/status',
     headers=h, json={'status': 'in_progress'})

# 10. Story quality
test('GET /stories/AUD-TEST-001/quality', 'get', '/api/stories/AUD-TEST-001/quality', headers=h)

# 11. Impacts for story
test('GET /stories/impacts/AUD-TEST-001', 'get', '/api/stories/impacts/AUD-TEST-001', headers=h)

# 12. Generate from requirements
test('POST /stories/generate-from-requirements', 'post', '/api/stories/generate-from-requirements',
     headers=h,
     data={'text': 'Users should be able to login with email and password. Password reset via email.'})

# 13. Logout
test('POST /auth/logout', 'post', '/api/auth/logout')

print('\n=== ENDPOINT AUDIT RESULTS ===')
for line in results:
    print(line)
print('\nTotal: %d | Pass: %d | Fail: %d' % (
    len(results),
    sum(1 for r in results if r.startswith('[OK')),
    sum(1 for r in results if not r.startswith('[OK'))
))
