import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  database: string;
};

type StatusState = "loading" | "ok" | "error";

export function ApiStatus() {
  const [state, setState] = useState<StatusState>("loading");
  const [label, setLabel] = useState("Checking API…");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const response = await fetch("/api/health");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = (await response.json()) as HealthResponse;
        if (cancelled) return;
        setState("ok");
        setLabel(`API ${data.status} · DB ${data.database}`);
      } catch {
        if (cancelled) return;
        setState("error");
        setLabel("API offline");
      }
    }

    void check();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="api-status" data-state={state}>
      {label}
    </div>
  );
}
