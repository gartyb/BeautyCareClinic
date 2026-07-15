import type { Note } from '../../types/Note';
import { newId } from '../../domain/id';
import { DomainError } from '../../domain/errors';

// ─── Deps injection ───────────────────────────────────────────────────────────

interface BuildNoteDeps {
  newId?: () => string;
  today?: () => string;
}

// ─── buildNote ────────────────────────────────────────────────────────────────

/**
 * Builds a customer-level Note entity.
 * text must be non-empty after trim — validation is the caller's responsibility.
 * The UI must NOT construct Note entities directly — always use this builder.
 */
export function buildNote(
  customerId: string,
  text: string,
  authorUserId: string,
  deps: BuildNoteDeps = {}
): Note {
  // FIX-6: Enforce non-empty text at the domain level
  if (!text.trim()) {
    throw new DomainError('EMPTY_NOTE_TEXT', 'Note text must not be empty');
  }
  const genId = deps.newId ?? newId;
  const today = deps.today ?? (() => new Date().toISOString().slice(0, 10));
  return {
    id: genId(),
    customerId,
    text,
    authorUserId,
    createdDate: today(),
  };
}
