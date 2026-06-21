export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

export const teamMembers: TeamMember[] = [
  { id: "me", name: "You", email: "you@example.com", role: "Admin", avatar: "ME" },
  { id: "qa", name: "QA Lead", email: "qa@example.com", role: "Reviewer", avatar: "QA" },
  { id: "dev", name: "Developer", email: "dev@example.com", role: "Contributor", avatar: "DV" },
];

export function memberById(id: string): TeamMember | undefined {
  return teamMembers.find((member) => member.id === id);
}
