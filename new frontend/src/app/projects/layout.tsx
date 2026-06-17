export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  // No sidebar on the Project Picker — this screen exists before workspace context applies.
  return <>{children}</>;
}
