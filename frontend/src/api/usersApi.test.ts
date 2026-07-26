import { describe, it, expect, vi } from 'vitest';
import { getUsers, getUser, createUser, updateUser, deactivateUser, deleteUser } from './usersApi';
import { apiClient } from './apiClient';

vi.mock('./apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('usersApi (Phase 012 additions)', () => {
  it('getUsers with no args calls GET /users', () => {
    getUsers();
    expect(apiClient.get).toHaveBeenCalledWith('/users');
  });

  it('getUsers(role) calls GET /users?role=', () => {
    getUsers('Therapist');
    expect(apiClient.get).toHaveBeenCalledWith('/users?role=Therapist');
  });

  it('getUsers(role, true) includes includeInactive=true', () => {
    getUsers('Therapist', true);
    expect(apiClient.get).toHaveBeenCalledWith('/users?role=Therapist&includeInactive=true');
  });

  it('getUsers(undefined, true) includes includeInactive=true with no role param', () => {
    getUsers(undefined, true);
    expect(apiClient.get).toHaveBeenCalledWith('/users?includeInactive=true');
  });

  it('getUser calls GET /users/{id}', () => {
    getUser('user-1');
    expect(apiClient.get).toHaveBeenCalledWith('/users/user-1');
  });

  it('createUser calls POST /users with fullName/email/password/phone (RC-6 shape)', () => {
    const body = { fullName: 'שם', email: 'a@b.com', password: 'Pass@1234', phone: '0501234567' };
    createUser(body);
    expect(apiClient.post).toHaveBeenCalledWith('/users', body);
  });

  it('updateUser calls PUT /users/{id} with fullName/email/phone', () => {
    const body = { fullName: 'שם', email: 'a@b.com', phone: '0501234567' };
    updateUser('user-1', body);
    expect(apiClient.put).toHaveBeenCalledWith('/users/user-1', body);
  });

  it('deactivateUser calls PUT /users/{id}/deactivate', () => {
    deactivateUser('user-1');
    expect(apiClient.put).toHaveBeenCalledWith('/users/user-1/deactivate', {});
  });

  it('deleteUser calls DELETE /users/{id}', () => {
    deleteUser('user-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/users/user-1');
  });
});
