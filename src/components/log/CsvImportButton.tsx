import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { importMetabolicCsv, type ImportResult } from "@/lib/csv-import";

export function CsvImportButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const text = await file.text();
      const r = await importMetabolicCsv(text);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card py-2.5 text-sm text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground disabled:opacity-60"
      >
        <Upload className="h-4 w-4" />
        {loading ? "Importing…" : "Import CSV (Keto-Mojo, Lumen, etc.)"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFile}
      />
      {result && (
        <div className="rounded-md border border-ember/30 bg-ember/5 px-3 py-2 text-xs text-muted-foreground">
          <span className="text-foreground">Imported {result.added}</span>
          {result.skipped > 0 && <> · skipped {result.skipped} duplicate{result.skipped === 1 ? "" : "s"}</>}
          {result.failed > 0 && <> · {result.failed} failed</>}
          {" "}({result.total} reading{result.total === 1 ? "" : "s"} total)
        </div>
      )}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
