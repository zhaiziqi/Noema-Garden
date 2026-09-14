import { useEffect, useState } from "react";

type HealthResponse = {
  status: string;
  database: string;
};

type StatusState = "loading" | "ok" | "error";

type Props = {
  /** When true, only render if API/DB is unhealthy */
  quiet?: boolean;
};

export function ApiStatus({ quiet = false }: Props) {
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

  if (quiet && state !== "error") return null;

  return (
    <div className="api-status" data-state={state}>
      {label}
    </div>
  );
}
