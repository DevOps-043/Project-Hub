import { describe, expect, it } from 'vitest';
import { mapPermissionToRole } from './roles';

describe('mapPermissionToRole', () => {
  it('maps super_admin and admin to admin', () => {
    expect(mapPermissionToRole('super_admin')).toBe('admin');
    expect(mapPermissionToRole('admin')).toBe('admin');
  });

  it('maps manager and user to user', () => {
    expect(mapPermissionToRole('manager')).toBe('user');
    expect(mapPermissionToRole('user')).toBe('user');
  });

  // Security invariant: an unrecognized permission_level must fall back to
  // the least-privileged role, never silently become admin.
  it('defaults any other value (viewer, guest, unknown) to guest', () => {
    expect(mapPermissionToRole('viewer')).toBe('guest');
    expect(mapPermissionToRole('guest')).toBe('guest');
    expect(mapPermissionToRole('some-future-level')).toBe('guest');
  });
});
