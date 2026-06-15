import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Forward auth cookies from browser to Flask so JWT is validated
    const cookieHeader = request.headers.get('cookie') || '';

    const backendResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"}/api/stories/upload`, {
      method: 'POST',
      headers: { cookie: cookieHeader },
      body: formData
    });

    const result = await backendResponse.json();

    if (backendResponse.ok) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: result.error || 'Upload failed' },
        { status: backendResponse.status }
      );
    }
  } catch (error) {
    console.error('Upload API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}