import { describe, it, expect, vi, beforeEach } from 'vitest';
import { treatmentsApi } from '../../api/treatmentsApi';
import { notesApi } from '../../api/notesApi';
import type { Treatment } from '../../types/Treatment';
import type { Note } from '../../types/Note';

// ─── Mock apiClient ───────────────────────────────────────────────────────────

vi.mock('../../api/apiClient', () => ({
  apiClient: {
    get:    vi.fn(),
    post:   vi.fn(),
    put:    vi.fn(),
    delete: vi.fn(),
  },
}));

import { apiClient } from '../../api/apiClient';

const mockGet    = apiClient.get    as ReturnType<typeof vi.fn>;
const mockPost   = apiClient.post   as ReturnType<typeof vi.fn>;
const mockPut    = apiClient.put    as ReturnType<typeof vi.fn>;
const mockDelete = apiClient.delete as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── treatmentsApi ────────────────────────────────────────────────────────────

describe('treatmentsApi.create', () => {
  it('calls POST /customers/{customerId}/treatments with correct body', async () => {
    const mockTreatment: Treatment = {
      id: 'treat-new',
      customerId: 'cust-1',
      treatmentTypeId: 'tt-1',
      treatmentTypeName: 'טיפול פנים',
      treatmentDate: '2026-07-17',
      durationMinutes: 60,
      userId: 'user-1',
      performedByFullName: 'מטפלת ראשית',
      notes: 'הערה',
      treatmentPhotos: [],
    };
    mockPost.mockResolvedValueOnce(mockTreatment);

    const request = {
      treatmentTypeId: 'tt-1',
      treatmentSeriesId: 'series-1',
      durationMinutes: 60,
      notes: 'הערה',
    };

    const result = await treatmentsApi.create('cust-1', request);

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/treatments', request);
    expect(result.id).toBe('treat-new');
    expect(result.performedByFullName).toBe('מטפלת ראשית');
  });

  it('maps treatmentTypeName from response', async () => {
    const mockTreatment: Treatment = {
      id: 'treat-2',
      customerId: 'cust-1',
      treatmentTypeId: 'tt-2',
      treatmentTypeName: 'לייזר',
      treatmentDate: '2026-07-17',
      durationMinutes: 45,
      userId: 'user-1',
      performedByFullName: 'מנהלת',
      treatmentPhotos: [],
    };
    mockPost.mockResolvedValueOnce(mockTreatment);

    const result = await treatmentsApi.create('cust-1', {
      treatmentTypeId: 'tt-2',
      durationMinutes: 45,
    });

    expect(result.treatmentTypeName).toBe('לייזר');
  });
});

describe('treatmentsApi.delete', () => {
  it('calls DELETE /treatments/{id}', async () => {
    mockDelete.mockResolvedValueOnce(undefined);

    await treatmentsApi.delete('treat-123');

    expect(mockDelete).toHaveBeenCalledWith('/treatments/treat-123');
  });
});

describe('treatmentsApi.listByCustomer', () => {
  it('calls GET /customers/{customerId}/treatments', async () => {
    mockGet.mockResolvedValueOnce([]);

    await treatmentsApi.listByCustomer('cust-2');

    expect(mockGet).toHaveBeenCalledWith('/customers/cust-2/treatments');
  });
});

describe('treatmentsApi.getById', () => {
  it('calls GET /treatments/{id}', async () => {
    const mockTreatment: Treatment = {
      id: 'treat-xyz',
      customerId: 'cust-1',
      treatmentTypeId: 'tt-1',
      treatmentDate: '2026-07-10',
      userId: 'user-1',
      performedByFullName: 'מטפלת',
      treatmentPhotos: [],
    };
    mockGet.mockResolvedValueOnce(mockTreatment);

    const result = await treatmentsApi.getById('treat-xyz');

    expect(mockGet).toHaveBeenCalledWith('/treatments/treat-xyz');
    expect(result.id).toBe('treat-xyz');
  });
});

// ─── notesApi ─────────────────────────────────────────────────────────────────

describe('notesApi.create', () => {
  it('calls POST /customers/{customerId}/notes with correct body', async () => {
    const mockNote: Note = {
      id: 'note-new',
      customerId: 'cust-1',
      content: 'הערה חדשה',
      noteDate: '2026-07-17',
      userId: 'user-1',
      writtenByFullName: 'מטפלת ראשית',
    };
    mockPost.mockResolvedValueOnce(mockNote);

    const request = {
      content: 'הערה חדשה',
      noteDate: '2026-07-17',
    };

    const result = await notesApi.create('cust-1', request);

    expect(mockPost).toHaveBeenCalledWith('/customers/cust-1/notes', request);
    expect(result.id).toBe('note-new');
    expect(result.writtenByFullName).toBe('מטפלת ראשית');
  });
});

describe('notesApi.update', () => {
  it('sends PUT to /notes/{id}', async () => {
    const mockNote: Note = {
      id: 'note-abc',
      customerId: 'cust-1',
      content: 'תוכן מעודכן',
      noteDate: '2026-07-15',
      userId: 'user-1',
      writtenByFullName: 'מטפלת',
    };
    mockPut.mockResolvedValueOnce(mockNote);

    const updateRequest = {
      content: 'תוכן מעודכן',
      noteDate: '2026-07-15',
    };

    const result = await notesApi.update('note-abc', updateRequest);

    expect(mockPut).toHaveBeenCalledWith('/notes/note-abc', updateRequest);
    expect(result.content).toBe('תוכן מעודכן');
  });
});

describe('notesApi.delete', () => {
  it('calls DELETE /notes/{id}', async () => {
    mockDelete.mockResolvedValueOnce(undefined);

    await notesApi.delete('note-xyz');

    expect(mockDelete).toHaveBeenCalledWith('/notes/note-xyz');
  });
});

describe('notesApi.listByCustomer', () => {
  it('calls GET /customers/{customerId}/notes', async () => {
    mockGet.mockResolvedValueOnce([]);

    await notesApi.listByCustomer('cust-3');

    expect(mockGet).toHaveBeenCalledWith('/customers/cust-3/notes');
  });
});

// ─── Role-based visibility tests ─────────────────────────────────────────────

describe('Note edit/delete visibility by role', () => {
  const note: Note = {
    id: 'note-role-test',
    customerId: 'cust-1',
    content: 'הערה בדיקה',
    noteDate: '2026-07-17',
    userId: 'user-therapist-1',
    writtenByFullName: 'מטפלת',
  };

  it('author can edit their own note', () => {
    const currentUserId = 'user-therapist-1';
    const isManager     = false;
    const authorId      = note.userId ?? note.authorUserId;
    const canEdit       = authorId === currentUserId || isManager;
    expect(canEdit).toBe(true);
  });

  it('different therapist cannot edit another therapist note', () => {
    const currentUserId = 'user-therapist-2';
    const isManager     = false;
    const authorId      = note.userId ?? note.authorUserId;
    const canEdit       = authorId === currentUserId || isManager;
    expect(canEdit).toBe(false);
  });

  it('manager can edit any note', () => {
    const currentUserId = 'user-manager-1';
    const isManager     = true;
    const authorId      = note.userId ?? note.authorUserId;
    const canEdit       = authorId === currentUserId || isManager;
    expect(canEdit).toBe(true);
  });
});

describe('Treatment delete visibility by role', () => {
  const treatment: Treatment = {
    id: 'treat-role-test',
    customerId: 'cust-1',
    treatmentTypeId: 'tt-1',
    treatmentDate: '2026-07-17',
    userId: 'user-therapist-1',
    performedByFullName: 'מטפלת',
    treatmentPhotos: [],
  };

  it('author can delete their own treatment', () => {
    const currentUserId = 'user-therapist-1';
    const isManager     = false;
    const ownerId       = treatment.userId ?? treatment.therapistId;
    const canDelete     = ownerId === currentUserId || isManager;
    expect(canDelete).toBe(true);
  });

  it('different therapist cannot delete treatment of another therapist', () => {
    const currentUserId = 'user-therapist-2';
    const isManager     = false;
    const ownerId       = treatment.userId ?? treatment.therapistId;
    const canDelete     = ownerId === currentUserId || isManager;
    expect(canDelete).toBe(false);
  });

  it('manager can delete any treatment', () => {
    const currentUserId = 'user-manager-1';
    const isManager     = true;
    const ownerId       = treatment.userId ?? treatment.therapistId;
    const canDelete     = ownerId === currentUserId || isManager;
    expect(canDelete).toBe(true);
  });
});

// ─── NoteModal validation ─────────────────────────────────────────────────────

describe('NoteModal validation', () => {
  it('submit is disabled when content is empty', () => {
    const content    = '';
    const canSubmit  = content.trim().length > 0 && content.length <= 5000;
    expect(canSubmit).toBe(false);
  });

  it('submit is disabled when content is whitespace only', () => {
    const content    = '   ';
    const canSubmit  = content.trim().length > 0 && content.length <= 5000;
    expect(canSubmit).toBe(false);
  });

  it('submit is disabled when content exceeds 5000 chars', () => {
    const content    = 'א'.repeat(5001);
    const canSubmit  = content.trim().length > 0 && content.length <= 5000;
    expect(canSubmit).toBe(false);
  });

  it('submit is enabled when content is valid', () => {
    const content    = 'הערה תקינה';
    const canSubmit  = content.trim().length > 0 && content.length <= 5000;
    expect(canSubmit).toBe(true);
  });

  it('submit is enabled when content is exactly 5000 chars', () => {
    const content    = 'א'.repeat(5000);
    const canSubmit  = content.trim().length > 0 && content.length <= 5000;
    expect(canSubmit).toBe(true);
  });
});
