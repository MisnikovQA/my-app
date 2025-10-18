// app/page.tsx
import SystemDashboard from "@/components/SystemDashboard";

export default function Page() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <h1 className="text-3xl font-bold mb-6 text-foreground">Gigabyte NUC</h1>
      <SystemDashboard />
    </main>
  );
}