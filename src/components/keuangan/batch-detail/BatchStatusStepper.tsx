import { Badge } from "@/components/ui/badge";

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
    <div className="rounded-[28px] border border-border bg-card p-5">
      <div className="mb-4 text-sm font-semibold">Alur Status Batch</div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {steps.map((step, index) => {
          const isCompleted = index <= activeIndex;
          return (
            <div key={step.key} className="flex items-center gap-3">
              <Badge
                variant={isCompleted ? "secondary" : "outline"}
                className="rounded-full px-3 py-1 text-[11px]"
              >
                {index + 1}
              </Badge>
              <div>
                <p className="text-sm font-semibold">{step.label}</p>
                <p className="text-xs text-muted-foreground">
                  {isCompleted ? "Selesai" : "Menunggu"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
