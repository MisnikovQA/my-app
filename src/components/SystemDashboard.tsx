// components/SystemDashboard.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { SystemDetails } from "@/app/lib/system";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProgressProps = { value: number; className?: string };
function Progress({ value, className = "" }: ProgressProps) {
  const pct = Math.max(0, Math.min(100, Number(value)));
  return (
    <div className={`w-full bg-muted rounded ${className}`} style={{ height: "0.5rem" }}>
      <div
        className="h-full bg-primary rounded"
        style={{ width: `${pct}%` }}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        role="progressbar"
      />
    </div>
  );
}

export default function SystemDashboard() {
  const [data, setData] = useState<SystemDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  async function fetchData(signal?: AbortSignal) {
    try {
      setError(null);
      const res = await fetch("/api/system", { cache: "no-store", signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SystemDetails;
      setData(json);
    } catch (e: any) {
      if (e?.name !== "AbortError") setError(String(e?.message || e));
    }
  }

  useEffect(() => {
    const ctrl = new AbortController();
    fetchData(ctrl.signal);
    timer.current = window.setInterval(() => fetchData(ctrl.signal), 5000);
    return () => {
      ctrl.abort();
      if (timer.current) window.clearInterval(timer.current);
    };
  }, []);

  if (error) {
    return (
      <div className="text-sm text-red-500">
        Failed to load system info: {error}
      </div>
    );
  }

  if (!data) {
    return <div className="text-sm text-muted-foreground">Loading system info…</div>;
  }

  const cpuTemp =
    typeof data.cpuTempC === "number" ? `${data.cpuTempC.toFixed(1)}°C` : "N/A";
  const uptimeH = Math.floor(data.uptimeSec / 3600);
  const uptimeM = Math.floor((data.uptimeSec % 3600) / 60);
  const loadAvg = data.loadAvg.map((n) => n.toFixed(2)).join(" / ");

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>System Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* General */}
        <div className="space-y-2">
          {[
            ["Hostname", data.hostname],
            ["Platform", `${data.platform} ${data.release}`],
            ["Architecture", data.arch],
            ["Uptime", `${uptimeH}h ${uptimeM}m`],
            ["Load Avg (1/5/15)", loadAvg],
            ["CPU Temperature", cpuTemp],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}:</span>
              <span className="text-foreground font-medium">{value}</span>
            </div>
          ))}
        </div>

        {/* CPU */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">CPU Usage</h3>
          {data.cpuUsagePercentPerCore.map((usage, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Core {i}</span>
                <span>{usage}%</span>
              </div>
              <Progress value={parseFloat(usage)} className="h-2" />
            </div>
          ))}
        </div>

        {/* Memory */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Memory Usage</h3>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Used</span>
            <span>
              {data.memoryGB.used.toFixed(2)} / {data.memoryGB.total.toFixed(2)} GB
            </span>
          </div>
          <Progress value={(data.memoryGB.used / data.memoryGB.total) * 100} className="h-2" />

          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Used (no cache)</span>
            <span>
              {data.memoryGBNoCache?.used.toFixed(2)} / {data.memoryGB.total.toFixed(2)} GB
            </span>
          </div>
          <Progress
            value={(data.memoryGBNoCache!.used / data.memoryGB.total) * 100}
            className="h-2"
          />
        </div>

        {/* Disk */}
        {data.rootDisk && (
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-foreground">Disk (/)</h3>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Used</span>
              <span>
                {data.rootDisk.usedGB.toFixed(2)} / {data.rootDisk.totalGB.toFixed(2)} GB
              </span>
            </div>
            <Progress
              value={(data.rootDisk.usedGB / data.rootDisk.totalGB) * 100}
              className="h-2"
            />
          </div>
        )}

        {/* Active Users */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">Active Users</h3>
          {data.activeUsers.length === 0 ? (
            <div className="text-sm text-muted-foreground">None</div>
          ) : (
            <div className="space-y-1">
              {data.activeUsers.map((u, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {u.user}
                    {u.host ? `@${u.host}` : ""} ({u.tty})
                  </span>
                  <span className="text-foreground font-medium">{u.since}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SSH Connections */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">SSH Connections</h3>
          {data.sshConnections.length === 0 ? (
            <div className="text-sm text-muted-foreground">None</div>
          ) : (
            <div className="space-y-1">
              {data.sshConnections.map((c, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{c.remote}</span>
                  <span className="text-foreground font-medium">
                    {c.local} · {c.state}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}