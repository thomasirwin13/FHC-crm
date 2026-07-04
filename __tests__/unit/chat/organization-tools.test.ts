/**
 * Unit Tests: Organization CRUD Chat Tools
 *
 * Tests the tool input/output contracts and confirmation action logic
 * for organization management via the chat interface.
 * Run with: pnpm test __tests__/unit/chat/organization-tools.test.ts
 */

import { revalidatePath } from 'next/cache';

// Mock supabase-queries
const mockGetUser = jest.fn();
const mockGetTeamForUser = jest.fn();
const mockCreateOrganization = jest.fn();
const mockUpdateOrganization = jest.fn();
const mockDeleteOrganization = jest.fn();
const mockLogActivity = jest.fn();

jest.mock('@/lib/db/supabase-queries', () => ({
  getUser: (...args: any[]) => mockGetUser(...args),
  getTeamForUser: (...args: any[]) => mockGetTeamForUser(...args),
  createOrganization: (...args: any[]) => mockCreateOrganization(...args),
  updateOrganization: (...args: any[]) => mockUpdateOrganization(...args),
  deleteOrganization: (...args: any[]) => mockDeleteOrganization(...args),
  logActivity: (...args: any[]) => mockLogActivity(...args),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(),
}));

jest.mock('@/lib/ai/embeddings', () => ({
  generateFeatureEmbedding: jest.fn(),
}));

jest.mock('@/lib/db/schema', () => ({
  ActivityType: {
    CREATE_ORGANIZATION: 'CREATE_ORGANIZATION',
    UPDATE_ORGANIZATION: 'UPDATE_ORGANIZATION',
    DELETE_ORGANIZATION: 'DELETE_ORGANIZATION',
  },
}));

// Import after mocks are set up
import {
  confirmAddOrganization,
  confirmEditOrganization,
  confirmDeleteOrganization,
} from '@/app/app/chat/actions';

const mockUser = { id: 1, name: 'Test User', email: 'test@test.com' };
const mockTeam = { id: 10, name: 'Test Team' };

describe('confirmAddOrganization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue(mockUser);
    mockGetTeamForUser.mockResolvedValue(mockTeam);
  });

  it('should return error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const result = await confirmAddOrganization({ name: 'Acme Corp' });

    expect(result).toEqual({ error: 'Unauthorized' });
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it('should return error when user has no team', async () => {
    mockGetTeamForUser.mockResolvedValue(null);

    const result = await confirmAddOrganization({ name: 'Acme Corp' });

    expect(result).toEqual({ error: 'Team not found' });
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it('should create organization with all fields', async () => {
    const mockOrganization = { id: 42, name: 'Acme Corp' };
    mockCreateOrganization.mockResolvedValue(mockOrganization);

    const result = await confirmAddOrganization({
      name: 'Acme Corp',
      description: 'A test organization',
      website: 'https://acme.com',
      type: 'Technology',
      size: '201-1000',
      status: 'Client',
    });

    expect(result).toEqual({ success: true, organization: mockOrganization });
    expect(mockCreateOrganization).toHaveBeenCalledWith({
      name: 'Acme Corp',
      team_id: 10,
      user_id: 1,
      description: 'A test organization',
      website: 'https://acme.com',
      type: 'Technology',
      size: '201-1000',
      status: 'Client',
    });
  });

  it('should default optional fields to null', async () => {
    mockCreateOrganization.mockResolvedValue({ id: 1, name: 'Minimal' });

    await confirmAddOrganization({ name: 'Minimal' });

    expect(mockCreateOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Minimal',
        description: null,
        website: null,
        type: null,
        size: null,
        status: 'Lead',
      })
    );
  });

  it('should log activity after creation', async () => {
    mockCreateOrganization.mockResolvedValue({ id: 1, name: 'Logged' });

    await confirmAddOrganization({ name: 'Logged' });

    expect(mockLogActivity).toHaveBeenCalledWith(10, 1, 'CREATE_ORGANIZATION');
  });

  it('should revalidate organizations path', async () => {
    mockCreateOrganization.mockResolvedValue({ id: 1, name: 'Revalidated' });

    await confirmAddOrganization({ name: 'Revalidated' });

    expect(revalidatePath).toHaveBeenCalledWith('/app/organizations');
  });

  it('should return error when createOrganization throws', async () => {
    mockCreateOrganization.mockRejectedValue(new Error('DB error'));

    const result = await confirmAddOrganization({ name: 'Fail' });

    expect(result).toEqual({ error: 'Failed to create organization' });
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

describe('confirmEditOrganization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue(mockUser);
    mockGetTeamForUser.mockResolvedValue(mockTeam);
  });

  it('should return error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const result = await confirmEditOrganization({ organizationId: 1, name: 'New Name' });

    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should return error when no updates provided', async () => {
    const result = await confirmEditOrganization({ organizationId: 1 });

    expect(result).toEqual({ error: 'No updates provided' });
    expect(mockUpdateOrganization).not.toHaveBeenCalled();
  });

  it('should update organization with provided fields', async () => {
    const updatedOrganization = { id: 5, name: 'Updated Corp' };
    mockUpdateOrganization.mockResolvedValue(updatedOrganization);

    const result = await confirmEditOrganization({
      organizationId: 5,
      name: 'Updated Corp',
      status: 'Client',
      type: 'Finance',
    });

    expect(result).toEqual({ success: true, organization: updatedOrganization });
    expect(mockUpdateOrganization).toHaveBeenCalledWith(5, 10, {
      name: 'Updated Corp',
      status: 'Client',
      type: 'Finance',
    });
  });

  it('should map camelCase fields to snake_case DB columns', async () => {
    mockUpdateOrganization.mockResolvedValue({ id: 1 });

    await confirmEditOrganization({
      organizationId: 1,
      website: 'https://example.com',
    });

    expect(mockUpdateOrganization).toHaveBeenCalledWith(1, 10, {
      website: 'https://example.com',
    });
  });

  it('should log activity and revalidate on success', async () => {
    mockUpdateOrganization.mockResolvedValue({ id: 1 });

    await confirmEditOrganization({ organizationId: 1, name: 'New' });

    expect(mockLogActivity).toHaveBeenCalledWith(10, 1, 'UPDATE_ORGANIZATION');
    expect(revalidatePath).toHaveBeenCalledWith('/app/organizations');
  });

  it('should return error when updateOrganization returns null', async () => {
    mockUpdateOrganization.mockResolvedValue(null);

    const result = await confirmEditOrganization({ organizationId: 99, name: 'Ghost' });

    expect(result).toEqual({ error: 'Failed to update organization' });
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});

describe('confirmDeleteOrganization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser.mockResolvedValue(mockUser);
    mockGetTeamForUser.mockResolvedValue(mockTeam);
  });

  it('should return error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue(null);

    const result = await confirmDeleteOrganization({ organizationId: 1 });

    expect(result).toEqual({ error: 'Unauthorized' });
  });

  it('should delete organization and return success', async () => {
    mockDeleteOrganization.mockResolvedValue({ success: true });

    const result = await confirmDeleteOrganization({ organizationId: 7 });

    expect(result).toEqual({ success: true });
    expect(mockDeleteOrganization).toHaveBeenCalledWith(7, 10);
  });

  it('should log activity and revalidate on success', async () => {
    mockDeleteOrganization.mockResolvedValue({ success: true });

    await confirmDeleteOrganization({ organizationId: 7 });

    expect(mockLogActivity).toHaveBeenCalledWith(10, 1, 'DELETE_ORGANIZATION');
    expect(revalidatePath).toHaveBeenCalledWith('/app/organizations');
  });

  it('should return error when deleteOrganization fails', async () => {
    mockDeleteOrganization.mockResolvedValue({ error: 'Failed to delete organization' });

    const result = await confirmDeleteOrganization({ organizationId: 99 });

    expect(result).toEqual({ error: 'Failed to delete organization' });
    expect(mockLogActivity).not.toHaveBeenCalled();
  });
});
