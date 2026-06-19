import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:5000'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path)
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path)
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path)
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path)
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path)
}
export async function OPTIONS(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path)
}

async function proxy(req: NextRequest, pathSegments: string[]) {
  try {
    const path = pathSegments.join('/')
    const search = req.nextUrl.search ?? ''
    const url = `${BACKEND}/api/${path}${search}`

    // Build forwarded headers — keep everything except host
    const headers = new Headers()
    req.headers.forEach((value, key) => {
      const k = key.toLowerCase()
      if (k !== 'host') headers.set(key, value)
    })

    // Read body — pass raw bytes for all body types to avoid re-serialization issues
    let body: BodyInit | null = null
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      body = await req.arrayBuffer()
    }

    const backendRes = await fetch(url, {
      method: req.method,
      headers,
      body,
    })

    // Forward all response headers including Set-Cookie
    const resHeaders = new Headers()
    backendRes.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') {
        resHeaders.append(key, value)
      }
    })

    const resBody = await backendRes.arrayBuffer()

    return new NextResponse(resBody, {
      status: backendRes.status,
      headers: resHeaders,
    })
  } catch (err) {
    console.error('[proxy] error:', err)
    return NextResponse.json({ error: 'Proxy error', detail: String(err) }, { status: 502 })
  }
}
