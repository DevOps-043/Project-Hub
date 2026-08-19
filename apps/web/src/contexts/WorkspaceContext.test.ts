import { describe, expect, it } from 'vitest';
import { getPanelPathForRole, getPermissionsForRole, WorkspaceRole } from './WorkspaceContext';

describe('getPermissionsForRole', () => {
  // Matrix documented in CLAUDE.md "Permisos por rol". Any change here is a
  // real authorization change, not a refactor — this test exists so that
  // changing it requires a deliberate edit to this file too.
  it('grants owner every permission', () => {
    expect(getPermissionsForRole('owner')).toEqual({
      manageWorkspace: true,
      manageMembers: true,
      manageRoles: true,
      manageProjects: true,
      manageTeams: true,
      viewAnalytics: true,
      viewReports: true,
      viewAllMembers: true,
    });
  });

  it('grants admin everything except manageWorkspace', () => {
    const permissions = getPermissionsForRole('admin');
    expect(permissions.manageWorkspace).toBe(false);
    expect(permissions.manageMembers).toBe(true);
    expect(permissions.manageRoles).toBe(true);
    expect(permissions.manageProjects).toBe(true);
    expect(permissions.manageTeams).toBe(true);
    expect(permissions.viewAnalytics).toBe(true);
    expect(permissions.viewReports).toBe(true);
    expect(permissions.viewAllMembers).toBe(true);
  });

  it('grants manager only project and team management', () => {
    expect(getPermissionsForRole('manager')).toEqual({
      manageWorkspace: false,
      manageMembers: false,
      manageRoles: false,
      manageProjects: true,
      manageTeams: true,
      viewAnalytics: false,
      viewReports: false,
      viewAllMembers: false,
    });
  });

  it('grants leader only project management, not team management', () => {
    expect(getPermissionsForRole('leader')).toEqual({
      manageWorkspace: false,
      manageMembers: false,
      manageRoles: false,
      manageProjects: true,
      manageTeams: false,
      viewAnalytics: false,
      viewReports: false,
      viewAllMembers: false,
    });
  });

  it('grants member no management or elevated view permissions', () => {
    expect(getPermissionsForRole('member')).toEqual({
      manageWorkspace: false,
      manageMembers: false,
      manageRoles: false,
      manageProjects: false,
      manageTeams: false,
      viewAnalytics: false,
      viewReports: false,
      viewAllMembers: false,
    });
  });

  // Security invariant: an unrecognized role (e.g. bad data from a stale
  // client or a future role not yet wired here) must fail closed to the
  // least-privileged permission set, never fail open to elevated access.
  it('falls back to member-level permissions for an unrecognized role', () => {
    const unknownRole = 'superuser' as WorkspaceRole;
    expect(getPermissionsForRole(unknownRole)).toEqual(getPermissionsForRole('member'));
  });
});

describe('getPanelPathForRole', () => {
  it('routes owner and admin to the /admin panel', () => {
    expect(getPanelPathForRole('acme', 'owner')).toBe('/acme/admin');
    expect(getPanelPathForRole('acme', 'admin')).toBe('/acme/admin');
  });

  it('routes manager, leader, and member to the plain workspace panel', () => {
    expect(getPanelPathForRole('acme', 'manager')).toBe('/acme');
    expect(getPanelPathForRole('acme', 'leader')).toBe('/acme');
    expect(getPanelPathForRole('acme', 'member')).toBe('/acme');
  });

  // Security invariant mirrored from getPermissionsForRole: only the two
  // roles that actually hold admin permissions may ever resolve to the
  // /admin path. A regression here would route a low-privilege role into
  // admin-only screens.
  it('never routes a non-admin role to the /admin panel', () => {
    for (const role of ['manager', 'leader', 'member'] as WorkspaceRole[]) {
      expect(getPanelPathForRole('acme', role)).not.toContain('/admin');
    }
  });

  it('falls back to the plain workspace panel for an unrecognized role', () => {
    const unknownRole = 'superuser' as WorkspaceRole;
    expect(getPanelPathForRole('acme', unknownRole)).toBe('/acme');
  });
});
