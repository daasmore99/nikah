"use client";

import { useState, useTransition } from "react";
import { updateRow } from "@/app/actions";

/** Satu to-do yang bisa dicentang langsung dari Ringkasan. */
export function NextTodo({ id, judul }: { id: string; judul: string }) {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <label className="flex cursor-pointer items-start gap-1">
        <span className="-ml-3 grid size-11 flex-none place-items-center">
          <input type="checkbox" className="check" checked={done} disabled={pending}
            onChange={(e) => {
              const v = e.target.checked;
              setDone(v);
              setErr(null);
              start(async () => {
                const res = await updateRow("todo", id, { selesai: v }, true);
                if (!res.ok) {
                  setDone(!v);
                  setErr(res.message);
                }
              });
            }} />
        </span>
        <span className={`display pt-2 text-[1.55rem] leading-[1.15] transition-colors duration-300 ${done ? "text-ink-3 line-through decoration-1" : ""}`}>
          {judul}
        </span>
      </label>
      {err && <p role="status" className="mt-1 text-[13px] text-clay">{err}</p>}
    </div>
  );
}
