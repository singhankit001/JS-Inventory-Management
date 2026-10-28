// Remounts on every navigation, so the page-enter sequence in globals.css replays per route.
// The wrapper itself never animates: transforms/filters here would break fixed and sticky descendants.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
