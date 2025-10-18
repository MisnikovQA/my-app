// components/ui/card.tsx
import * as React from "react";

export function Card({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`rounded-2xl border border-slate-700 bg-slate-900 text-slate-50 shadow ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`p-4 border-b border-slate-700 ${className}`}>{children}</div>;
}

export function CardTitle({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <h3 className={`text-xl font-semibold ${className}`}>{children}</h3>;
}

export function CardContent({ className = "", children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}