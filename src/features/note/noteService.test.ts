import { describe, it, expect } from 'vitest';
import { buildNote } from './noteService';
import { DomainError } from '../../domain/errors';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const testDeps = {
  newId: () => 'test-note-id',
  today: () => '2026-07-14',
};

// ─── buildNote ────────────────────────────────────────────────────────────────

describe('buildNote', () => {
  it('creates a Note with correct fields', () => {
    const note = buildNote('cust-1', 'הערה לדוגמה', 'user-1', testDeps);
    expect(note.id).toBe('test-note-id');
    expect(note.customerId).toBe('cust-1');
    expect(note.text).toBe('הערה לדוגמה');
    expect(note.authorUserId).toBe('user-1');
    expect(note.createdDate).toBe('2026-07-14');
  });

  it('does not set treatmentTypeId by default', () => {
    const note = buildNote('cust-1', 'text', 'user-1', testDeps);
    expect(note.treatmentTypeId).toBeUndefined();
  });

  it('uses injected newId', () => {
    const deps = { ...testDeps, newId: () => 'custom-note-id' };
    const note = buildNote('cust-1', 'text', 'user-1', deps);
    expect(note.id).toBe('custom-note-id');
  });

  it('uses injected today for createdDate', () => {
    const deps = { ...testDeps, today: () => '2025-06-01' };
    const note = buildNote('cust-1', 'text', 'user-1', deps);
    expect(note.createdDate).toBe('2025-06-01');
  });

  it('stores customerId correctly', () => {
    const note = buildNote('cust-xyz', 'text', 'user-1', testDeps);
    expect(note.customerId).toBe('cust-xyz');
  });

  it('stores authorUserId correctly', () => {
    const note = buildNote('cust-1', 'text', 'user-manager-1', testDeps);
    expect(note.authorUserId).toBe('user-manager-1');
  });

  it('stores text as-is (trimming is caller responsibility)', () => {
    const note = buildNote('cust-1', '  טקסט עם רווחים  ', 'user-1', testDeps);
    expect(note.text).toBe('  טקסט עם רווחים  ');
  });

  // FIX-6: empty-text guard
  it('throws DomainError when text is empty', () => {
    expect(() => buildNote('c1', '', 'u1', testDeps)).toThrow(DomainError);
  });

  it('throws DomainError when text is whitespace-only', () => {
    expect(() => buildNote('c1', '   ', 'u1', testDeps)).toThrow(DomainError);
  });

  it('uses real newId when deps not provided', () => {
    const note = buildNote('cust-1', 'text', 'user-1');
    expect(note.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('uses real today when deps not provided', () => {
    const today = new Date().toISOString().slice(0, 10);
    const note = buildNote('cust-1', 'text', 'user-1');
    expect(note.createdDate).toBe(today);
  });
});
