"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { KeuanganDashboardMetrics } from "@/server/actions/statistics";

type FinancePaymentTrendChartProps = {
  data: KeuanganDashboardMetrics["monthlyTrend"];
};

function formatCompactCurrency(value: number) {
  if (value >= 1_000_000_000)
    return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  if (value >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1)} jt`;
  if (value >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`;
  return `Rp ${value}`;
}

export function FinancePaymentTrendChart({
  data,
}: FinancePaymentTrendChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%" minHeight={1}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id="financePaidGradient"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor="#059669" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="month" className="text-xs" tickLine={false} />
          <YAxis
            className="text-xs"
            tickFormatter={formatCompactCurrency}
            tickLine={false}
            width={72}
          />
          <Tooltip
            formatter={(value, name) => [
              name === "amount"
                ? formatCompactCurrency(Number(value))
                : `${value} batch`,
              name === "amount" ? "Nominal" : "Batch",
            ]}
            labelFormatter={(label) => `Bulan ${label}`}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
          />
          <Area
            type="monotone"
            dataKey="amount"
            name="Nominal"
            stroke="#059669"
            strokeWidth={2}
            fill="url(#financePaidGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
