import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { formatTag, parseTagInput } from "@/lib/tags";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
}

export function TagInput({ value, onChange, suggestions }: Props) {
  const [input, setInput] = useState("");

  function commit(raw: string) {
    const parsed = parseTagInput(raw);
    if (parsed.length === 0) {
      setInput("");
      return;
    }
    const next = Array.from(new Set([...value, ...parsed]));
    onChange(next);
    setInput("");
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      commit(input);
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  function remove(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  const available = (suggestions ?? []).filter((s) => !value.includes(s));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 focus-within:border-ember">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-ember/15 px-2 py-0.5 text-xs font-medium text-ember">
            {formatTag(t)}
            <button
              type="button"
              onClick={() => remove(t)}
              aria-label={`Remove ${t}`}
              className="hover:text-ember-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          onBlur={() => commit(input)}
          placeholder={value.length === 0 ? "morning, post-workout" : ""}
          className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.slice(0, 8).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => commit(t)}
              className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground hover:border-ember/50 hover:text-foreground"
            >
              {formatTag(t)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
