/**
 * Chat API Endpoint
 *
 * Handles chat requests for bill analysis
 */

import { NextRequest, NextResponse } from 'next/server';
import { processChat, generateSummary, compareBillVersions, createSession, type ChatSession, type BillContext } from '@/lib/ai/chat-handler';
import { promises as fs } from 'fs';
import path from 'path';

// In-memory session store (would use Redis/DB in production)
const sessions = new Map<string, ChatSession>();

// Rate limiting (simple in-memory, use Redis in production)
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests per day per session
const RATE_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check rate limit
 */
function checkRateLimit(sessionId: string): boolean {
  const now = Date.now();
  const limit = rateLimits.get(sessionId);

  if (!limit || now > limit.resetAt) {
    rateLimits.set(sessionId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (limit.count >= RATE_LIMIT) {
    return false;
  }

  limit.count++;
  return true;
}

/**
 * Load bill context from database
 */
async function loadBillContext(billId: string): Promise<BillContext | null> {
  try {
    const graphPath = path.join(process.cwd(), 'db', 'graph.json');
    const data = await fs.readFile(graphPath, 'utf-8');
    const graph = JSON.parse(data);

    const bill = graph.nodes.bills[billId];
    if (!bill) {
      return null;
    }

    // Find bill version with extracted text
    const versionEdges = (graph.edges.HAS_VERSION || []).filter(
      (e: { from: string }) => e.from === billId
    );

    let extractedText = '';
    let textHash = '';

    for (const edge of versionEdges) {
      const version = graph.nodes.bill_versions[edge.to];
      if (version?.extractedText) {
        extractedText = version.extractedText;
        textHash = version.textHash || '';
        break;
      }
    }

    // If no extracted text, use title/description as fallback
    if (!extractedText) {
      extractedText = `Title: ${bill.title}\n\nDescription: ${bill.briefDescription || 'No description available.'}`;
      textHash = '';
    }

    return {
      billNumber: bill.billNumber,
      billTitle: bill.title,
      extractedText,
      textHash,
    };
  } catch (error) {
    console.error('Failed to load bill context:', error);
    return null;
  }
}

/**
 * POST /api/chat
 *
 * Send a message to the chat
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { billId, message, sessionId, action } = body;

    if (!billId) {
      return NextResponse.json({ error: 'billId is required' }, { status: 400 });
    }

    // Handle different actions
    if (action === 'summary') {
      return handleSummary(billId);
    }

    if (action === 'compare') {
      return handleCompare(billId, body.version1, body.version2);
    }

    // Regular chat message
    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Get or create session
    let session = sessionId ? sessions.get(sessionId) : null;
    if (!session) {
      session = createSession(billId);
      sessions.set(session.id, session);
    }

    // Check rate limit
    if (!checkRateLimit(session.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    // Load bill context
    const billContext = await loadBillContext(billId);
    if (!billContext) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Process chat
    const { response, updatedSession } = await processChat(
      session,
      message,
      billContext
    );

    // Update session store
    sessions.set(updatedSession.id, updatedSession);

    return NextResponse.json({
      response,
      sessionId: updatedSession.id,
      usage: updatedSession.tokenUsage,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}

/**
 * Handle summary generation
 */
async function handleSummary(billId: string) {
  const billContext = await loadBillContext(billId);
  if (!billContext) {
    return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
  }

  const summary = await generateSummary(billContext);

  return NextResponse.json({ summary });
}

/**
 * Handle version comparison
 */
async function handleCompare(
  billId: string,
  version1Id?: string,
  version2Id?: string
) {
  try {
    const graphPath = path.join(process.cwd(), 'db', 'graph.json');
    const data = await fs.readFile(graphPath, 'utf-8');
    const graph = JSON.parse(data);

    const bill = graph.nodes.bills[billId];
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Get versions
    const versionEdges = (graph.edges.HAS_VERSION || [])
      .filter((e: { from: string }) => e.from === billId);

    const versions: Array<{ id: string; label: string; text: string }> = [];

    for (const edge of versionEdges) {
      const version = graph.nodes.bill_versions[edge.to];
      if (version?.extractedText) {
        versions.push({
          id: edge.to,
          label: version.versionLabel || version.versionCode,
          text: version.extractedText,
        });
      }
    }

    if (versions.length < 2) {
      return NextResponse.json(
        { error: 'Not enough versions to compare' },
        { status: 400 }
      );
    }

    // Use specified versions or default to first two
    const v1 = versions.find(v => v.id === version1Id) || versions[0];
    const v2 = versions.find(v => v.id === version2Id) || versions[1];

    const comparison = await compareBillVersions(bill.billNumber, v1, v2);

    return NextResponse.json({
      comparison,
      versions: versions.map(v => ({ id: v.id, label: v.label })),
    });
  } catch (error) {
    console.error('Compare error:', error);
    return NextResponse.json(
      { error: 'Failed to compare versions' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chat
 *
 * Get session info
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    sessionId: session.id,
    billId: session.billId,
    messageCount: session.messages.length,
    usage: session.tokenUsage,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
}

/**
 * DELETE /api/chat
 *
 * Clear session
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  sessions.delete(sessionId);
  return NextResponse.json({ success: true });
}
