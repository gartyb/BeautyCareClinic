import { apiClient } from './apiClient';
import type { Note } from '../types/Note';

export interface CreateNoteRequest {
  treatmentTypeId?: string;
  noteDate?: string;
  content: string;
}

export interface UpdateNoteRequest {
  treatmentTypeId?: string;
  noteDate?: string;
  content: string;
}

export const notesApi = {
  listByCustomer: (customerId: string) =>
    apiClient.get<Note[]>(`/customers/${customerId}/notes`),

  getById: (id: string) =>
    apiClient.get<Note>(`/notes/${id}`),

  create: (customerId: string, data: CreateNoteRequest) =>
    apiClient.post<Note>(`/customers/${customerId}/notes`, data),

  update: (id: string, data: UpdateNoteRequest) =>
    apiClient.put<Note>(`/notes/${id}`, data),

  delete: (id: string) =>
    apiClient.delete<void>(`/notes/${id}`),
};
