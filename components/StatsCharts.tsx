"use client";

import type { AnimeStats, Distribution, FieldCount } from "@/lib/types";
import { Card } from "@/components/ui/card";

function BarChart({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number }[];
}) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-28 shrink-0 text-right truncate">
              {item.label}
            </span>
            <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${(item.value / max) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-14 shrink-0">
              {item.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PercentileTable({
  percentiles,
}: {
  percentiles: AnimeStats["percentiles"];
}) {
  const keys = Object.keys(percentiles);
  if (keys.length === 0) return null;

  const fields = Object.keys(percentiles[keys[0]]);

  return (
    <Card className="p-4 overflow-x-auto">
      <h3 className="text-sm font-semibold text-foreground mb-3">Percentiles</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b border-border">
            <th className="text-left py-1 pr-4">Metric</th>
            {fields.map((f) => (
              <th key={f} className="text-right py-1 px-2">
                {f}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key} className="border-b border-border/50">
              <td className="py-1 pr-4 text-foreground font-medium">{key}</td>
              {fields.map((f) => (
                <td key={f} className="text-right py-1 px-2 text-muted-foreground">
                  {Number(
                    (percentiles[key] as unknown as Record<string, number>)[f]
                  ).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function distributionToItems(data: Distribution[]) {
  return data.map((d) => ({ label: d.range, value: d.count }));
}

function fieldCountToItems(data: FieldCount[]) {
  return data.map((d) => ({ label: d.field, value: d.count }));
}

export default function StatsCharts({
  stats,
  totalLabel = "Total anime",
}: {
  stats: AnimeStats;
  totalLabel?: string;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {totalLabel}: {stats.totalAnime.toLocaleString()}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChart
          title="Score Distribution"
          items={distributionToItems(stats.scoreDistribution)}
        />
        <BarChart
          title="Members Distribution"
          items={distributionToItems(stats.membersDistribution)}
        />
        <BarChart
          title="Year Distribution"
          items={distributionToItems(stats.yearDistribution)}
        />
        <BarChart
          title="Favorites Distribution"
          items={distributionToItems(stats.favoritesDistribution)}
        />
        <BarChart
          title="Type Distribution"
          items={stats.typeDistribution.map((t) => ({
            label: t.type,
            value: t.count,
          }))}
        />
        <BarChart
          title="Genre Counts"
          items={fieldCountToItems(stats.genreCounts)}
        />
        <BarChart
          title="Theme Counts"
          items={fieldCountToItems(stats.themeCounts)}
        />
        <BarChart
          title="Demographic Counts"
          items={fieldCountToItems(stats.demographicCounts)}
        />
      </div>

      <PercentileTable percentiles={stats.percentiles} />
    </div>
  );
}
