import { clsx } from "clsx";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  variant?: "default" | "green" | "red" | "blue";
}

export function StatCard({ label, value, change, variant = "default" }: StatCardProps) {
  return (
    <div className="card">
      <p className="stat-label">{label}</p>
      <p
        className={clsx(
          "stat-value mt-1",
          variant === "green" && "text-accent-green",
          variant === "red" && "text-accent-red",
          variant === "blue" && "text-accent-blue"
        )}
      >
        {value}
      </p>
      {change && (
        <p
          className={clsx(
            "mt-1 text-xs",
            change.startsWith("+") ? "text-accent-green" : "text-accent-red"
          )}
        >
          {change}
        </p>
      )}
    </div>
  );
}
