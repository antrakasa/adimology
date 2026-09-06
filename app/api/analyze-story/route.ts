import { NextRequest, NextResponse } from 'next/server';
import { createAgentStory, getAgentStoriesByEmiten, updateAgentStory } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const emiten = searchParams.get('emiten')?.toUpperCase();

  if (!emiten) {
    return NextResponse.json({ error: 'Missing emiten parameter' }, { status: 400 });
  }

  try {
    const stories = await getAgentStoriesByEmiten(emiten);
    
    if (!stories || stories.length === 0) {
      return NextResponse.json({ 
        success: true, 
        data: null,
        message: 'No analysis found'
      });
    }

    return NextResponse.json({ 
      success: true, 
      data: stories 
    });
  } catch (error) {
    console.error('Error fetching agent story:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch analysis' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const emiten = body.emiten?.toUpperCase();
    const keyStats = body.keyStats;

    if (!emiten) {
      return NextResponse.json({ error: 'Missing emiten parameter' }, { status: 400 });
    }

    // Create pending record
    const story = await createAgentStory(emiten);

    // Trigger background function
    const host = request.headers.get('host');
    const baseUrl = host?.includes('localhost') 
      ? 'http://localhost:8888' 
      : `https://${host}`;

    const functionUrl = baseUrl.includes('/.netlify/functions') 
      ? baseUrl 
      : `${baseUrl.replace(/\/$/, '')}/.netlify/functions`;


    console.log(`[Agent Story] Triggering background function at: ${functionUrl}/analyze-story-background`);

    // Await the invocation itself (Netlify background functions still return
    // immediately - this does NOT wait for the analysis to finish). This avoids
    // leaving the row stuck at 'pending' forever if the trigger request never
    // makes it out (e.g. the execution context freezes right after we respond).
    try {
      await fetch(`${functionUrl}/analyze-story-background?emiten=${emiten}&id=${story.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyStats })
      });
    } catch (triggerError) {
      console.error('Failed to trigger background function:', triggerError);
      await updateAgentStory(story.id, {
        status: 'error',
        error_message: 'Gagal memulai proses analisis'
      });
      return NextResponse.json({
        success: false,
        error: 'Failed to trigger background analysis'
      }, { status: 502 });
    }

    return NextResponse.json({
      success: true, 
      data: story,
      message: 'Analysis started'
    });
  } catch (error) {
    console.error('Error starting agent story:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to start analysis' 
    }, { status: 500 });
  }
}
