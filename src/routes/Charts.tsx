import { useMemo, useState } from "react";
import { useMetabolicLogs, useSettings } from "@/hooks/useLogs";
import { useFastHistory } from "@/hooks/useFasts";
import {
  computeDigest,
  filterByRange,
  filterByTags,
  toFastBars,
  toGkiSeries,
  toGlucoseKetoneSeries,
} from "@/lib/insights";
import { TimeRangeToggle } from "@/components/charts/TimeRangeToggle";
import { TagFilter } from "@/components/charts/TagFilter";
import { DigestCard } from "@/components/charts/DigestCard";
import { GkiChart } from "@/components/charts/GkiChart";
import { GlucoseKetoneChart } from "@/components/charts/GlucoseKetoneChart";
import { FastDurationChart } from "@/components/charts/FastDurationChart";

export function ChartsRoute() {
  const [days, setDays] = useState(30);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const metabolic = useMetabolicLogs(5000);
  const fasts = useFastHistory(500);
  const settings = useSettings();

  const metabolicInRange = useMemo(
    () => filterByRange(metabolic ?? [], days, (m) => m.timestamp),
    [metabolic, days]
  );
  const metabolicFiltered = useMemo(
    () => filterByTags(metabolicInRange, activeTags),
    [metabolicInRange, activeTags]
  );
  const fastsInRange = useMemo(
    () => filterByRange(fasts ?? [], days, (f) => f.startedAt),
    [fasts, days]
  );

  const digest = useMemo(
    () => computeDigest(metabolicFiltered, fastsInRange),
    [metabolicFiltered, fastsInRange]
  );

  const gkiSeries = useMemo(() => toGkiSeries(metabolicFiltered), [metabolicFiltered]);
  const gkSeries = useMemo(() => toGlucoseKetoneSeries(metabolicFiltered), [metabolicFiltered]);
  const fastBars = useMemo(() => toFastBars(fastsInRange), [fastsInRange]);

  return (
    <div className="mx-auto max-w-md space-y-5 px-6 py-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Charts</h1>
          <p className="text-xs text-muted-foreground">Offline-first, from your local data.</p>
        </div>
        <TimeRangeToggle value={days} onChange={setDays} />
      </header>

      <TagFilter value={activeTags} onChange={setActiveTags} />

      <DigestCard digest={digest} days={days} />
      <GkiChart data={gkiSeries} />
      <GlucoseKetoneChart data={gkSeries} unit={settings.glucoseUnit} />
      {activeTags.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Tag filter applies to metabolic readings. Fasting chart below shows all fasts in range.
        </p>
      )}
      <FastDurationChart data={fastBars} />
    </div>
  );
}
