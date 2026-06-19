import { CheckCircle2 } from "lucide-react";

const steps = [
  { key: "draft", label: "Draft" },
  { key: "dikirim_ke_keuangan", label: "Dikirim" },
  { key: "diproses_keuangan", label: "Diproses" },
  { key: "dibayar", label: "Dibayar" },
  { key: "locked", label: "Locked" },
];

export function BatchStatusStepper({
  currentStatus,
}: {
  currentStatus: string;
}) {
  const activeIndex = steps.findIndex((step) => step.key === currentStatus);

  return (
    <div className="rounded-lg border border-border/60 bg-card p-5 shadow-sm overflow-hidden">
      <div className="mb-4 text-sm font-medium">Alur Status Batch</div>
      <div className="grid min-w-0 gap-3 grid-cols-2 sm:grid-cols-5">
        {steps.map((step, index) => {
          const isCompleted = index <= activeIndex;
          const isCurrent = index === activeIndex;
          return (
            <div
              key={step.key}
              className={`rounded-lg border p-3 ${
                isCurrent
                  ? "border-primary bg-primary/5"
                  : isCompleted
                    ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-950/30"
                    : "border-border/60 bg-muted/20"
              }`}
            >
              <div
                className={`mb-2 flex h-8 w-8 items-center justify-center rounded-full ${
                  isCompleted
                    ? "bg-emerald-600 text-white"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="text-xs font-medium">{index + 1}</span>
                )}
              </div>
              <p className="text-sm font-medium">{step.label}</p>
              <p className="text-xs text-muted-foreground">
                {isCurrent ? "Aktif" : isCompleted ? "Selesai" : "Menunggu"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
