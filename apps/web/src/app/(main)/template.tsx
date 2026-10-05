/** Re-mounts on every navigation inside the app, giving each page a short fade-up entrance. */
export default function MainTemplate({ children }: { children: React.ReactNode }) {
  return <div className="anim-page">{children}</div>;
}
