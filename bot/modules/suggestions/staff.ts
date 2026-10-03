/** Staff = Manage Server, or any role listed in the module's `staffRoleIds`. */
export function isStaff(
  member: { manageGuild: boolean; roleIds: readonly string[] },
  staffRoleIds: readonly string[],
): boolean {
  if (member.manageGuild) return true;
  return member.roleIds.some((id) => staffRoleIds.includes(id));
}
