/* ——— runtime.jsx · live-run engine data + runtime UI: RunConsole, CheckpointDialog,
       StateLegend. Drives the full 9-state NodeRunStatus machine on the canvas. ——— */
const { useState: useStateR, useEffect: useEffectR, useRef: useRefR } = React;
const { Icon: RIcon } = window;

/* ---- the run plan: ordered nodes + per-step trace lines (streamed by the engine) ---- */
const RUN_PLAN = [
  { id: "n1", name: "Source · Textbook PDFs", dur: "0.4s", tok: "—",
    lines: [
      ["start", "reading ~/study/textbooks"],
      ["info", "found 12 files · 38 MB (PDF, EPUB)"],
      ["ok", "staged 12 documents → files[]"],
    ] },
  { id: "n2", name: "Parse & Extract", retry: true, dur: "8.2s", tok: "3.1k",
    lines: [
      ["start", "parser.skill on Claude Code · chunk 8k"],
      ["info", "parsing 1..12"],
      ["warn", "file 3: context overflow at 8k chunk"],
      ["retry", "round 2 · re-chunk at 4k tokens"],
      ["ok", "parsed 12/12 → { vocabulary:218, grammar_points:34, text_blocks:96 }"],
    ] },
  { id: "n3", name: "Generate Vocab Quiz", checkpoint: true, dur: "12.4s", tok: "12.4k",
    lines: [
      ["start", "quiz-gen.skill on Codex"],
      ["info", "drafting 20 questions from 218 terms"],
      ["ok", "20 questions drafted · 4 options each"],
    ],
    after: [
      ["info", "checkpoint approved — continuing to verify"],
    ] },
  { id: "n4", name: "Adversarial Verify", dur: "9.7s", tok: "18.0k",
    lines: [
      ["start", "Generator ↔ Critic loop · max 3 rounds"],
      ["info", "round 1 · critic flagged 3 ambiguous distractors"],
      ["info", "round 2 · regenerated · critic passed"],
      ["ok", "verified_quiz (20) + verify_report"],
    ] },
  { id: "n5", name: "Export to Notion", fail: true, dur: "0.3s", tok: "0.2k",
    lines: [
      ["start", "notion-mcp · append rows → Study Materials"],
      ["err", "connector not authorized (401) — Notion token missing"],
      ["err", "halted · downstream waiting on a fix"],
    ] },
];

/* marker glyph + tone per line type */
const LINE_STYLE = {
  start: { mk: "▸", cls: "text-foreground/80" },
  info:  { mk: " ", cls: "text-muted-foreground" },
  warn:  { mk: "!", cls: "" , warn: true },
  retry: { mk: "↻", cls: "", warn: true },
  ok:    { mk: "✓", cls: "", ok: true },
  done:  { mk: "■", cls: "text-foreground/70" },
  err:   { mk: "✕", cls: "", err: true },
  sys:   { mk: "·", cls: "text-muted-foreground/70" },
};

/* ---- bottom-docked run console: streamed, color-coded, grouped-by-node trace ---- */
function RunConsole({ log, open, onToggle, height = 188 }) {
  const ref = useRefR(null);
  useEffectR(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [log, open]);
  const tokTotal = log.filter((l) => l.type === "done").length;
  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-16 z-30">
      <div className="overflow-hidden rounded-2xl bg-surface shadow-win ring-1 ring-border-strong">
        <button onClick={onToggle} className="flex w-full items-center gap-2 border-b border-border/70 px-3.5 py-2 text-left">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-surface-2"><RIcon name="SquareTerminal" size={12} className="text-foreground/75" /></span>
          <span className="text-[11.5px] font-semibold tracking-tightish">Run console</span>
          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground">{log.length} lines</span>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            {tokTotal} step{tokTotal !== 1 ? "s" : ""} logged
            <RIcon name={open ? "ChevronDown" : "ChevronUp"} size={13} />
          </span>
        </button>
        {open && (
          <div ref={ref} className="overflow-y-auto px-3.5 py-2.5 font-mono text-[10.5px] leading-[1.65]" style={{ height }}>
            {log.length === 0 && <div className="text-muted-foreground/70">Waiting for the first step…</div>}
            {log.map((l, i) => {
              const s = LINE_STYLE[l.type] || LINE_STYLE.info;
              const color = s.err ? "var(--c-destructive)" : s.warn ? "color-mix(in oklab, var(--c-warning) 80%, var(--c-fg))" : s.ok ? "var(--c-success)" : undefined;
              const isHead = l.type === "start";
              return (
                <div key={i} className={`flex gap-2 ${isHead ? "mt-1.5 first:mt-0" : ""}`}>
                  <span className="w-3 shrink-0 text-center" style={{ color }}>{s.mk}</span>
                  {isHead ? (
                    <span className="truncate"><span className="text-foreground/45">@@NODE_START</span> <span className="font-semibold text-foreground/90">{l.name}</span></span>
                  ) : l.type === "done" ? (
                    <span className="text-foreground/55">@@NODE_DONE {l.name} · {l.text}</span>
                  ) : (
                    <span className={s.cls} style={color ? { color } : undefined}>{l.text}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---- runtime checkpoint dialog (Spec 3.2.2 · waitingForUser) ---- */
function CheckpointDialog({ node, onApprove, onReject, onEdit }) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center p-6">
      <div className="absolute inset-0 node-config-bg" />
      <div className="node-config-card relative w-[420px] overflow-hidden rounded-2xl bg-surface shadow-win ring-1 ring-border-strong">
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "color-mix(in oklab, var(--c-warning) 18%, transparent)" }}>
            <RIcon name="Flag" size={15} style={{ color: "color-mix(in oklab, var(--c-warning) 72%, var(--c-fg))" }} />
          </span>
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold tracking-tightish">Checkpoint · review before continuing</div>
            <div className="text-[10.5px] text-muted-foreground">Paused after <span className="font-medium text-foreground/80">{node.name}</span> · the run is holding</div>
          </div>
        </div>
        <div className="px-4 py-3.5">
          <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-border">
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Step output · preview</div>
            <div className="space-y-1 text-[11.5px] leading-relaxed text-foreground/85">
              <div className="flex items-center gap-1.5"><RIcon name="Check" size={11} style={{ color: "var(--c-success)" }} /> 20 multiple-choice questions drafted</div>
              <div className="flex items-center gap-1.5"><RIcon name="Check" size={11} style={{ color: "var(--c-success)" }} /> 4 options each · difficulty varied</div>
              <div className="flex items-center gap-1.5 text-muted-foreground"><RIcon name="ArrowRight" size={11} /> next: adversarial verify, then Notion export</div>
            </div>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
            This step is marked as a checkpoint. Approve to let the run continue, or send it back with a note.
          </p>
        </div>
        <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3">
          <button onClick={onApprove} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-foreground py-2 text-[12.5px] font-medium text-primary-foreground hover:opacity-90">
            <RIcon name="Play" size={13} className="fill-current" /> Approve & continue
          </button>
          <button onClick={onEdit} className="rounded-xl bg-surface px-3 py-2 text-[12.5px] ring-1 ring-border hover:bg-accent/60">Edit step</button>
          <button onClick={onReject} className="rounded-xl px-3 py-2 text-[12.5px] text-muted-foreground hover:bg-accent/60">Stop</button>
        </div>
      </div>
    </div>
  );
}

/* ---- 9-state legend (collapsible chip) ---- */
const STATE_DEFS = [
  ["idle", "Idle", "neutral"],
  ["queued", "Queued", "neutral"],
  ["running", "Running", "fg"],
  ["retrying", "Retrying", "warn"],
  ["waitingForUser", "Awaiting you", "warn"],
  ["done", "Done", "ok"],
  ["failed", "Failed", "err"],
  ["skipped", "Skipped", "neutral"],
  ["cancelled", "Cancelled", "neutral"],
];
function StateLegend() {
  const [open, setOpen] = useStateR(false);
  const dotColor = (t) => t === "fg" ? "var(--c-fg)" : t === "warn" ? "var(--c-warning)" : t === "ok" ? "var(--c-success)" : t === "err" ? "var(--c-destructive)" : "transparent";
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] shadow-pill ring-1 transition-colors ${open ? "bg-foreground text-primary-foreground ring-foreground" : "bg-surface ring-border hover:ring-border-strong"}`}>
        <RIcon name="CircleDashed" size={13} /> States
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-[200px] rounded-2xl bg-surface p-2.5 shadow-float ring-1 ring-border-strong fade-rise">
          <div className="px-1 pb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Node run states · 9</div>
          <div className="space-y-0.5">
            {STATE_DEFS.map(([k, label, tone]) => (
              <div key={k} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-[11px]">
                <span className="relative inline-flex h-[9px] w-[9px] items-center justify-center">
                  {tone === "neutral"
                    ? <span className="h-[9px] w-[9px] rounded-full bg-surface" style={{ boxShadow: "inset 0 0 0 1.5px color-mix(in oklab, var(--c-muted-fg) 55%, transparent)" }} />
                    : <span className="h-[9px] w-[9px] rounded-full" style={{ background: dotColor(tone) }} />}
                </span>
                <span className="flex-1">{label}</span>
                <span className="font-mono text-[9px] text-muted-foreground/70">{k}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- pipeline version menu: overwrite current or save as a new version (Spec 3.4) ---- */
function VersionMenu({ version, dirty, runState, onOverwrite, onSaveAsNew }) {
  const [open, setOpen] = useStateR(false);
  const stateLabel = runState === "running" ? "running" : runState === "done" ? "completed" : "draft";
  const versions = [];
  for (let v = version; v >= 1; v--) versions.push(v);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="ml-0.5 flex items-center gap-1 whitespace-nowrap rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent/70">
        <span className="font-mono">v{version}</span>
        {dirty
          ? <span className="flex items-center gap-1 text-foreground/80"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "color-mix(in oklab, var(--c-warning) 80%, var(--c-fg))" }} /> unsaved</span>
          : <span>· {stateLabel} · saved</span>}
        <RIcon name="ChevronDown" size={10} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-40 mt-1.5 w-[208px] rounded-2xl bg-surface p-1.5 shadow-float ring-1 ring-border-strong fade-rise">
            <div className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Save changes</div>
            <button disabled={!dirty} onClick={() => { onOverwrite(); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ${dirty ? "hover:bg-accent/60" : "opacity-40"}`}>
              <RIcon name="Save" size={13} className="text-muted-foreground" /> <span className="flex-1">Overwrite v{version}</span>
            </button>
            <button onClick={() => { onSaveAsNew(); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-accent/60">
              <RIcon name="GitBranch" size={13} className="text-muted-foreground" /> <span className="flex-1">Save as new version</span>
              <span className="font-mono text-[10px] text-muted-foreground">v{version + 1}</span>
            </button>
            <div className="my-1 h-px bg-border" />
            <div className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">History</div>
            <div className="max-h-[132px] overflow-y-auto">
              {versions.map((v) => (
                <div key={v} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px]">
                  <RIcon name={v === version ? "GitCommitHorizontal" : "GitCommit"} size={13} className="text-muted-foreground" />
                  <span className="flex-1 font-mono">v{v}</span>
                  <span className="text-[10px] text-muted-foreground">{v === version ? "current" : v === version - 1 ? "1d ago" : `${version - v}d ago`}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

Object.assign(window, { RUN_PLAN, RunConsole, CheckpointDialog, StateLegend, VersionMenu, LINE_STYLE });
