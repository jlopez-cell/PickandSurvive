export default function WorldCupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-theme="world-cup" className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}
