/**
 * Team members — single source of truth for "invited" members who can be
 * assigned to test cards on the Kanban board.
 *
 * Mock-backed today; swap `teamMembers` for an API call later without changing
 * consumers. Set to an empty array to exercise the "no team members" state.
 */

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Member";
  /** Two-letter avatar initials. */
  avatar: string;
}

export const teamMembers: TeamMember[] = [
  { id: "1", name: "Jane Doe",   email: "jane@acme.com", role: "Admin",  avatar: "JD" },
  { id: "2", name: "Alex Smith", email: "alex@acme.com", role: "Member", avatar: "AS" },
  { id: "3", name: "Sam Rivera", email: "sam@acme.com",  role: "Member", avatar: "SR" },
];

export function memberById(id: string): TeamMember | undefined {
  return teamMembers.find((m) => m.id === id);
}
