import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseSync } from 'node:sqlite';

export interface SavedPropertyRow {
  id: string;
  user_id: string;
  property_id: string;
  canonical_name: string;
  created_at: string;
}

export interface ViewingBookingRow {
  id: string;
  user_id: string;
  property_id: string;
  canonical_name: string;
  buyer_name: string;
  buyer_contact: string;
  preferred_date: string;
  notes: string;
  status: string;
  created_at: string;
}

export interface ChatTurnRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  trace_id: string | null;
  top_property_id: string | null;
  created_at: string;
}

export interface AuditTraceRow {
  trace_id: string;
  session_id: string;
  query: string;
  model_used: string;
  latency_ms: number;
  cost_usd: number;
  faithfulness: number;
  self_healed: number;
  created_at: string;
}

/**
 * Real SQLite Persistence Layer (WAL mode via Node 22+ native node:sqlite).
 * Persists:
 *   - User Saved Homes Shortlist (saved_properties)
 *   - Buyer Private Viewing Bookings & Paid Forensic Dossier Orders (viewing_bookings)
 *   - Multi-Turn Conversational Advisor History (chat_turns)
 *   - Production Langfuse / MLOps Trace History & Funnel Events (audit_traces, funnel_events)
 */
@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly db: DatabaseSync;

  constructor() {
    const dataDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'estatetruth.sqlite');

    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.initSchema();
    this.logger.log(`SQLite WAL persistence ready at ${dbPath}`);
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS saved_properties (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        property_id TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, property_id)
      );

      CREATE TABLE IF NOT EXISTS viewing_bookings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        property_id TEXT NOT NULL,
        canonical_name TEXT NOT NULL,
        buyer_name TEXT NOT NULL,
        buyer_contact TEXT NOT NULL,
        preferred_date TEXT NOT NULL,
        notes TEXT DEFAULT '',
        status TEXT NOT NULL DEFAULT 'CONFIRMED_CONCIERGE',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS unlocked_dossiers (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        property_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, property_id)
      );

      CREATE TABLE IF NOT EXISTS chat_turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        trace_id TEXT,
        top_property_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_traces (
        trace_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        query TEXT NOT NULL,
        model_used TEXT NOT NULL,
        latency_ms INTEGER NOT NULL,
        cost_usd REAL NOT NULL,
        faithfulness REAL NOT NULL,
        self_healed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS funnel_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        session_id TEXT NOT NULL,
        trace_id TEXT,
        property_id TEXT,
        created_at TEXT NOT NULL
      );
    `);
  }

  // --- Saved Shortlist ---
  toggleSavedProperty(userId: string, propertyId: string, canonicalName: string): { saved: boolean } {
    const existing = this.db
      .prepare('SELECT id FROM saved_properties WHERE user_id = ? AND property_id = ?')
      .get(userId, propertyId) as { id: string } | undefined;

    if (existing) {
      this.db.prepare('DELETE FROM saved_properties WHERE id = ?').run(existing.id);
      return { saved: false };
    }

    const id = `sav_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db
      .prepare('INSERT INTO saved_properties (id, user_id, property_id, canonical_name, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, userId, propertyId, canonicalName, new Date().toISOString());
    return { saved: true };
  }

  listSavedProperties(userId: string): SavedPropertyRow[] {
    return this.db
      .prepare('SELECT * FROM saved_properties WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as SavedPropertyRow[];
  }

  // --- Paid Forensic Dossiers ---
  unlockDossier(userId: string, propertyId: string) {
    const id = `dos_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db
      .prepare('INSERT OR IGNORE INTO unlocked_dossiers (id, user_id, property_id, created_at) VALUES (?, ?, ?, ?)')
      .run(id, userId, propertyId, new Date().toISOString());
    return { unlocked: true, propertyId };
  }

  listUnlockedDossiers(userId: string): string[] {
    const rows = this.db
      .prepare('SELECT property_id FROM unlocked_dossiers WHERE user_id = ?')
      .all(userId) as unknown as Array<{ property_id: string }>;
    return rows.map((r) => r.property_id);
  }

  // --- Private Viewing Bookings ---
  createBooking(input: {
    userId: string;
    propertyId: string;
    canonicalName: string;
    buyerName: string;
    buyerContact: string;
    preferredDate: string;
    notes?: string;
  }): ViewingBookingRow {
    const id = `bk_${Date.now().toString(36).toUpperCase()}`;
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO viewing_bookings (id, user_id, property_id, canonical_name, buyer_name, buyer_contact, preferred_date, notes, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED_CONCIERGE', ?)`
      )
      .run(
        id,
        input.userId,
        input.propertyId,
        input.canonicalName,
        input.buyerName,
        input.buyerContact,
        input.preferredDate,
        input.notes || '',
        createdAt
      );

    return {
      id,
      user_id: input.userId,
      property_id: input.propertyId,
      canonical_name: input.canonicalName,
      buyer_name: input.buyerName,
      buyer_contact: input.buyerContact,
      preferred_date: input.preferredDate,
      notes: input.notes || '',
      status: 'CONFIRMED_CONCIERGE',
      created_at: createdAt,
    };
  }

  listBookings(userId: string): ViewingBookingRow[] {
    return this.db
      .prepare('SELECT * FROM viewing_bookings WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as unknown as ViewingBookingRow[];
  }

  // --- Multi-Turn Chat Memory ---
  appendChatTurn(turn: {
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    traceId?: string;
    topPropertyId?: string;
  }) {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db
      .prepare(
        'INSERT INTO chat_turns (id, session_id, role, content, trace_id, top_property_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(
        id,
        turn.sessionId,
        turn.role,
        turn.content,
        turn.traceId || null,
        turn.topPropertyId || null,
        new Date().toISOString()
      );
  }

  getChatHistory(sessionId: string, limit = 10): ChatTurnRow[] {
    const rows = this.db
      .prepare('SELECT * FROM chat_turns WHERE session_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(sessionId, limit) as unknown as ChatTurnRow[];
    return rows.reverse();
  }

  // --- Audit Traces & Funnel Events ---
  saveTrace(row: Omit<AuditTraceRow, 'created_at'>) {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO audit_traces (trace_id, session_id, query, model_used, latency_ms, cost_usd, faithfulness, self_healed, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        row.trace_id,
        row.session_id,
        row.query,
        row.model_used,
        row.latency_ms,
        row.cost_usd,
        row.faithfulness,
        row.self_healed,
        new Date().toISOString()
      );
  }

  getRecentTraces(limit = 25): AuditTraceRow[] {
    return this.db
      .prepare('SELECT * FROM audit_traces ORDER BY created_at DESC LIMIT ?')
      .all(limit) as unknown as AuditTraceRow[];
  }

  recordFunnelEvent(eventType: string, sessionId: string, traceId?: string, propertyId?: string) {
    const id = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.db
      .prepare(
        'INSERT INTO funnel_events (id, event_type, session_id, trace_id, property_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, eventType, sessionId, traceId || null, propertyId || null, new Date().toISOString());
  }

  getFunnelCounts(): Record<string, number> {
    const rows = this.db
      .prepare('SELECT event_type, COUNT(*) as cnt FROM funnel_events GROUP BY event_type')
      .all() as unknown as Array<{ event_type: string; cnt: number }>;
    const map: Record<string, number> = {};
    for (const r of rows) map[r.event_type] = Number(r.cnt);
    return map;
  }
}
