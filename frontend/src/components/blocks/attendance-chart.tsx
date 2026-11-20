import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { format, parseISO } from "date-fns"
import { id } from "date-fns/locale"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import type { AttendanceSummary } from "@/types"

const chartConfig = {
  onTime: { label: "Tepat waktu", color: "var(--chart-1)" },
  late: { label: "Terlambat", color: "var(--chart-2)" },
} satisfies ChartConfig

/** Check-in 7 hari terakhir, dipisah tepat waktu vs terlambat */
export function AttendanceChart({ data, loading }: { data?: AttendanceSummary["trend"]; loading?: boolean }) {
  const total = data?.reduce((n, d) => n + d.checkIn, 0) ?? 0
  const late = data?.reduce((n, d) => n + d.late, 0) ?? 0
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Check-in 7 hari terakhir</CardTitle>
        <CardDescription>
          {data ? `${total} check-in · ${total ? Math.round((late / total) * 100) : 0}% terlambat` : "Memuat…"}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-5">
        {loading || !data ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
            <BarChart data={data} margin={{ left: -24, right: 4, top: 4 }} barCategoryGap="28%">
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(v: string) => format(parseISO(v), "EEE d", { locale: id })}
              />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
              <ChartTooltip
                cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                content={<ChartTooltipContent labelFormatter={(v) => format(parseISO(String(v)), "EEEE, d MMM", { locale: id })} />}
              />
              <Bar dataKey="onTime" stackId="a" fill="var(--color-onTime)" radius={0} />
              <Bar dataKey="late" stackId="a" fill="var(--color-late)" radius={[3, 3, 0, 0]} />
              <ChartLegend content={<ChartLegendContent />} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
