/* ——— panels.jsx · Monitor drawers & dialogs: Job runtime + controls, Schedule editor,
       Usage per-job step drill-in. Exported to window for pages.jsx. ——— */
const { useState: useStatePN, useEffect: useEffectPN, useRef: useRefPN } = React;
const { Icon: PIcon, StatusPill: PStatusPill, Dot: PDot } = window;

/* per-job runtime detail: ordered steps with trace + token/cost split (Usage drill-in reads this too) */
const JOB_DETAIL = {
  job_8f2a: {
    pipe: "Textbook → Notion Quiz",
    started: "14:32:06",
    by: "Wei Chen",
    steps: [
      {
        name: "Source · Textbook PDFs",
        agent: "local-fs",
        status: "done",
        dur: "0.4s",
        tok: 120,
        cost: 0.0,
        lines: [
          ["start", "reading ~/study/textbooks"],
          ["ok", "staged 12 documents → files[]"],
        ],
      },
      {
        name: "Parse & Extract",
        agent: "Claude Code",
        status: "done",
        dur: "8.2s",
        tok: 9800,
        cost: 0.04,
        lines: [
          ["start", "parser.skill · chunk 8k"],
          ["warn", "file 3 overflow → re-chunk 4k"],
          ["retry", "round 2"],
          ["ok", "parsed 12/12"],
        ],
      },
      {
        name: "Generate Vocab Quiz",
        agent: "Codex",
        status: "running",
        dur: "5.9s",
        tok: 12400,
        cost: 0.09,
        lines: [
          ["start", "quiz-gen.skill"],
          ["info", "drafting question 9 / 20…"],
        ],
      },
      {
        name: "Adversarial Verify",
        agent: "Generator ↔ Critic",
        status: "queued",
        dur: "—",
        tok: 0,
        cost: 0,
        lines: [],
      },
      {
        name: "Export to Notion",
        agent: "notion-mcp",
        status: "queued",
        dur: "—",
        tok: 0,
        cost: 0,
        lines: [],
      },
    ],
  },
  job_7c93: {
    pipe: "Contract Risk Review",
    started: "13:58:41",
    by: "Wei Chen",
    steps: [
      {
        name: "Extract clauses",
        agent: "Hermes",
        status: "done",
        dur: "11.2s",
        tok: 18400,
        cost: 0.0,
        lines: [
          ["start", "ner.skill"],
          ["ok", "42 clauses → entities[]"],
        ],
      },
      {
        name: "Council · risk debate",
        agent: "3 roles",
        status: "done",
        dur: "38.5s",
        tok: 41200,
        cost: 0.18,
        lines: [
          ["start", "council.skill · 3 rounds"],
          ["ok", "converged · 6 flagged clauses"],
        ],
      },
      {
        name: "Reviewer sign-off",
        agent: "—",
        status: "waitingForUser",
        dur: "paused",
        tok: 0,
        cost: 0,
        lines: [["info", "checkpoint · waiting for human sign-off"]],
      },
      {
        name: "Export report",
        agent: "local-fs",
        status: "queued",
        dur: "—",
        tok: 0,
        cost: 0,
        lines: [],
      },
    ],
  },
  job_64b2: {
    pipe: "Lead Research Brief",
    started: "06:00:02",
    by: "Routine",
    steps: [
      {
        name: "Split prospects",
        agent: "Claude Code",
        status: "done",
        dur: "3.1s",
        tok: 4200,
        cost: 0.02,
        lines: [
          ["start", "planner.skill"],
          ["ok", "12 prospects → 3 batches"],
        ],
      },
      {
        name: "Research (3 parallel)",
        agent: "Claude Code ×3",
        status: "failed",
        dur: "34.0s",
        tok: 46800,
        cost: 0.16,
        lines: [
          ["start", "3 isolated workers"],
          ["info", "worker A, B ok"],
          ["err", "worker C · source timeout (30s)"],
          ["err", "halted · merge needs all batches"],
        ],
      },
      {
        name: "Merge brief",
        agent: "Claude Code",
        status: "skipped",
        dur: "—",
        tok: 0,
        cost: 0,
        lines: [["info", "skipped · upstream failed"]],
      },
      {
        name: "Export",
        agent: "workspace",
        status: "skipped",
        dur: "—",
        tok: 0,
        cost: 0,
        lines: [],
      },
    ],
  },
};
function detailFor(job) {
  if (JOB_DETAIL[job.id]) return JOB_DETAIL[job.id];
  // synthesize a plausible detail from the row
  const n = job.total;
  const steps = Array.from({ length: n }).map((_, i) => ({
    name: i === job.step ? job.stepName : `Step ${i + 1}`,
    agent: job.agent,
    status:
      i < job.step
        ? "done"
        : i === job.step
          ? job.status === "completed"
            ? "done"
            : job.status
          : job.status === "completed"
            ? "done"
            : "queued",
    dur: i <= job.step ? "—" : "—",
    tok: i <= job.step ? 8000 : 0,
    cost: i <= job.step ? 0.05 : 0,
    lines: i === job.step ? [["start", job.stepName]] : [],
  }));
  return { pipe: job.pipe, started: "—", by: job.by === "routine" ? "Routine" : "Wei Chen", steps };
}

const LINE_TONE = (t) =>
  t === "err"
    ? "var(--c-destructive)"
    : t === "warn" || t === "retry"
      ? "color-mix(in oklab, var(--c-warning) 80%, var(--c-fg))"
      : t === "ok"
        ? "var(--c-success)"
        : undefined;
const MK = { start: "▸", info: " ", warn: "!", retry: "↻", ok: "✓", err: "✕" };

/* ----------------------- Job runtime drawer + controls ----------------------- */
function JobDetailDrawer({ job, onOpenCanvas, onClose, notify }) {
  const base = job ? detailFor(job) : null;
  const [steps, setSteps] = useState(base ? base.steps : []);
  const [status, setStatus] = useState(job ? job.status : "completed");
  const [expanded, setExpanded] = useState(() => {
    const i = (base ? base.steps : []).findIndex(
      (s) => s.status === "running" || s.status === "waitingForUser" || s.status === "failed",
    );
    return i < 0 ? null : i;
  });
  useEffect(() => {
    if (!job) return;
    const b = detailFor(job);
    setSteps(b.steps);
    setStatus(job.status);
    const i = b.steps.findIndex(
      (s) => s.status === "running" || s.status === "waitingForUser" || s.status === "failed",
    );
    setExpanded(i < 0 ? b.steps.length - 1 : i);
  }, [job && job.id]);
  if (!job) return null;

  const totalTok = steps.reduce((n, s) => n + (s.tok || 0), 0);
  const totalCost = steps.reduce((n, s) => n + (s.cost || 0), 0);
  const runningIdx = steps.findIndex((s) => s.status === "running");

  const setStep = (i, st) =>
    setSteps((ss) => ss.map((s, j) => (j === i ? { ...s, status: st } : s)));
  const act = (kind) => {
    if (kind === "pause") {
      setStatus("waitingForUser");
      if (runningIdx >= 0) setStep(runningIdx, "waitingForUser");
      notify && notify(`${job.id} paused`);
    }
    if (kind === "resume") {
      setStatus("running");
      const i = steps.findIndex((s) => s.status === "waitingForUser");
      if (i >= 0) setStep(i, "running");
      notify && notify(`${job.id} resumed`);
    }
    if (kind === "stop") {
      setStatus("cancelled");
      setSteps((ss) => {
        let hit = false;
        return ss.map((s) => {
          if (s.status === "done" || s.status === "failed") return s;
          if (
            !hit &&
            (s.status === "running" || s.status === "waitingForUser" || s.status === "queued")
          ) {
            hit = true;
            return { ...s, status: "cancelled" };
          }
          return { ...s, status: "skipped" };
        });
      });
      notify && notify(`${job.id} stopped`);
    }
    if (kind === "rerun") {
      setStatus("running");
      setSteps((ss) => ss.map((s, i) => ({ ...s, status: i === 0 ? "running" : "queued" })));
      setExpanded(0);
      notify && notify(`Re-running ${job.id}`);
    }
  };

  const live = status === "running" || status === "waitingForUser";
  const tone =
    status === "completed"
      ? "success"
      : status === "failed" || status === "cancelled"
        ? "error"
        : "muted";

  return (
    <div className="absolute inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="absolute inset-0"
        style={{ background: "color-mix(in oklab, var(--c-fg) 14%, transparent)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="drawer-in relative flex h-full w-[460px] flex-col bg-background shadow-win ring-1 ring-border-strong"
      >
        {/* header */}
        <div className="flex items-start gap-3 border-b border-border/70 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-primary-foreground">
            <PIcon name="Workflow" size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold tracking-tightish">{base.pipe}</div>
            <div className="flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
              {job.id} · {base.by} · started {base.started}
            </div>
          </div>
          <PStatusPill status={status} />
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            <PIcon name="X" size={16} />
          </button>
        </div>

        {/* controls */}
        <div className="flex items-center gap-1.5 border-b border-border/70 px-5 py-3">
          {status === "running" && (
            <CtrlBtn icon="Pause" label="Pause" onClick={() => act("pause")} />
          )}
          {status === "waitingForUser" && (
            <CtrlBtn icon="Play" label="Resume" solid onClick={() => act("resume")} />
          )}
          {live && <CtrlBtn icon="Square" label="Stop" danger onClick={() => act("stop")} />}
          {!live && <CtrlBtn icon="RotateCcw" label="Re-run" solid onClick={() => act("rerun")} />}
          <div className="ml-auto flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
            <span>{(totalTok / 1000).toFixed(1)}k tok</span>
            <span className="font-medium text-foreground/80">${totalCost.toFixed(2)}</span>
          </div>
        </div>

        {/* steps */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Runtime · {steps.length} steps
          </div>
          <div className="space-y-1.5">
            {steps.map((s, i) => {
              const open = expanded === i;
              const dotTone =
                s.status === "done" ? "success" : s.status === "failed" ? "error" : "muted";
              return (
                <div
                  key={i}
                  className={`overflow-hidden rounded-xl ring-1 ${s.status === "failed" ? "ring-destructive/25 bg-destructive/[0.03]" : s.status === "running" || s.status === "waitingForUser" ? "ring-border-strong bg-surface-2/40" : "ring-border bg-surface"}`}
                >
                  <button
                    onClick={() => setExpanded(open ? null : i)}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left"
                  >
                    <span className="flex h-5 w-5 items-center justify-center font-mono text-[10px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <PDot tone={dotTone} ping={s.status === "running"} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium">{s.name}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{s.agent}</div>
                    </div>
                    <RunBadge status={s.status} />
                    <span className="w-12 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {s.dur}
                    </span>
                    <PIcon
                      name={open ? "ChevronDown" : "ChevronRight"}
                      size={13}
                      className="text-muted-foreground"
                    />
                  </button>
                  {open && (
                    <div className="border-t border-border/70 px-3 py-2.5">
                      <div className="mb-2 flex items-center gap-3 text-[10px] tabular-nums text-muted-foreground">
                        <span className="rounded bg-surface-2 px-1.5 py-0.5">
                          {(s.tok / 1000).toFixed(1)}k tok
                        </span>
                        <span className="rounded bg-surface-2 px-1.5 py-0.5">
                          ${s.cost.toFixed(2)}
                        </span>
                      </div>
                      {s.lines.length ? (
                        <div className="space-y-0.5 font-mono text-[10px] leading-relaxed">
                          {s.lines.map((ln, k) => (
                            <div key={k} className="flex gap-2">
                              <span
                                className="w-3 shrink-0 text-center"
                                style={{ color: LINE_TONE(ln[0]) }}
                              >
                                {MK[ln[0]] || "·"}
                              </span>
                              <span
                                style={{ color: LINE_TONE(ln[0]) }}
                                className={LINE_TONE(ln[0]) ? "" : "text-muted-foreground"}
                              >
                                {ln[1]}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="font-mono text-[10px] text-muted-foreground/60">
                          no trace yet
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border/70 px-5 py-3">
          <button
            onClick={onOpenCanvas}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface py-2 text-[12.5px] font-medium ring-1 ring-border hover:bg-accent/60"
          >
            <PIcon name="Workflow" size={14} /> Open pipeline on canvas
          </button>
        </div>
      </div>
    </div>
  );
}
function CtrlBtn({ icon, label, onClick, solid, danger }) {
  const cls = danger
    ? "ring-1 ring-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:ring-destructive/30"
    : solid
      ? "bg-foreground text-primary-foreground hover:opacity-90"
      : "bg-surface ring-1 ring-border hover:bg-accent/60";
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12px] font-medium ${cls}`}
    >
      <PIcon name={icon} size={13} className={solid && icon === "Play" ? "fill-current" : ""} />{" "}
      {label}
    </button>
  );
}
function RunBadge({ status }) {
  const M = {
    done: ["done", "var(--c-success)"],
    running: ["running", "var(--c-fg)"],
    retrying: ["retrying", "var(--c-warning)"],
    waitingForUser: ["awaiting", "var(--c-warning)"],
    failed: ["failed", "var(--c-destructive)"],
    skipped: ["skipped", "var(--c-muted-fg)"],
    cancelled: ["cancelled", "var(--c-muted-fg)"],
    queued: ["queued", "var(--c-muted-fg)"],
  };
  const m = M[status] || M.queued;
  const soft = status === "queued" || status === "skipped" || status === "cancelled";
  return (
    <span
      className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
      style={{
        background: `color-mix(in oklab, ${m[1]} ${soft ? 10 : 15}%, transparent)`,
        color: soft ? "var(--c-muted-fg)" : `color-mix(in oklab, ${m[1]} 78%, var(--c-fg))`,
      }}
    >
      {m[0]}
    </span>
  );
}

Object.assign(window, { JobDetailDrawer, JOB_DETAIL, detailFor });

/* ----------------------------- Schedule editor ----------------------------- */
const CRON_PRESETS = [
  { label: "Every hour", cron: "0 * * * *", human: "at minute 0 of every hour" },
  { label: "Daily 06:00", cron: "0 6 * * *", human: "every day at 06:00" },
  { label: "Weekdays 09:00", cron: "0 9 * * 1-5", human: "Mon–Fri at 09:00" },
  { label: "Weekly Mon", cron: "0 9 * * 1", human: "every Monday at 09:00" },
];
const EVENTS = ["ticket.created", "file.added", "pr.opened", "row.inserted", "email.received"];
const INPUT_SRC = [
  ["FolderOpen", "Local folder", "~/study/textbooks"],
  ["Github", "GitHub repo", "owner/repo"],
  ["Inbox", "Webhook payload", "event body"],
  ["Database", "Postgres query", "study_db"],
];
const OUTPUT_CH = [
  ["Boxes", "Notion DB", "Study Materials"],
  ["FileText", "Local file", "~/out"],
  ["MessageSquare", "Slack channel", "#ops"],
  ["Mail", "Email", "me@team.co"],
];

function Seg({ options, value, onChange }) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${value === o.v ? "bg-surface text-foreground shadow-soft ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}
        >
          <PIcon name={o.icon} size={13} /> {o.label}
        </button>
      ))}
    </div>
  );
}
function Picker({ rows, value, onPick }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {rows.map(([ic, label, hint]) => (
        <button
          key={label}
          onClick={() => onPick(label)}
          className={`flex items-center gap-2 rounded-xl px-2.5 py-2 text-left ring-1 transition-colors ${value === label ? "bg-accent ring-border-strong" : "bg-surface ring-border hover:bg-accent/50"}`}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2">
            <PIcon name={ic} size={13} className="text-foreground/70" />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-medium">{label}</div>
            <div className="truncate font-mono text-[9.5px] text-muted-foreground">{hint}</div>
          </div>
          {value === label && <PIcon name="Check" size={13} className="ml-auto shrink-0" />}
        </button>
      ))}
    </div>
  );
}

function ScheduleEditor({ pipe, initial, onSave, onClose, notify }) {
  const seed = initial || {};
  const [trigger, setTrigger] = useState(
    seed.trigger ||
      (pipe && pipe.schedule ? (pipe.schedule.includes("event") ? "event" : "cron") : "manual"),
  );
  const [cron, setCron] = useState(seed.cron || "0 6 * * *");
  const [event, setEvent] = useState(seed.event || EVENTS[0]);
  const [src, setSrc] = useState(seed.src || INPUT_SRC[0][1]);
  const [out, setOut] = useState(seed.out || OUTPUT_CH[0][1]);
  const [enabled, setEnabled] = useState(seed.enabled !== false);
  const preset = CRON_PRESETS.find((p) => p.cron === cron);
  const parts = cron.split(" ");
  const setPart = (i, v) => {
    const p = [...parts];
    p[i] = v || "*";
    setCron(p.join(" "));
  };
  const summary =
    trigger === "manual"
      ? "Runs only when you press Run"
      : trigger === "cron"
        ? `Runs ${preset ? preset.human : "on cron " + cron}`
        : `Runs on every ${event}`;

  return (
    <div className="absolute inset-0 z-50 grid place-items-center p-6" onClick={onClose}>
      <div className="absolute inset-0 node-config-bg" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="node-config-card relative flex max-h-[88%] w-[480px] flex-col overflow-hidden rounded-2xl bg-surface shadow-win ring-1 ring-border-strong"
      >
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
            <PIcon name="CalendarClock" size={15} className="text-foreground/75" />
          </span>
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold tracking-tightish">Schedule</div>
            <div className="text-[10.5px] text-muted-foreground">
              {pipe ? pipe.name : "Pipeline"}
            </div>
          </div>
          <button
            onClick={() => setEnabled((v) => !v)}
            title={enabled ? "Enabled" : "Disabled"}
            className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${enabled ? "bg-foreground" : "bg-surface-3"}`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-primary-foreground transition-transform ${enabled ? "translate-x-4" : ""}`}
            />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            <PIcon name="X" size={15} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <Label>Trigger</Label>
            <Seg
              value={trigger}
              onChange={setTrigger}
              options={[
                { v: "manual", label: "Manual", icon: "Hand" },
                { v: "cron", label: "Schedule", icon: "Clock" },
                { v: "event", label: "On event", icon: "Zap" },
              ]}
            />
          </div>

          {trigger === "cron" && (
            <div className="space-y-2.5">
              <div>
                <Label>Presets</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CRON_PRESETS.map((p) => (
                    <button
                      key={p.cron}
                      onClick={() => setCron(p.cron)}
                      className={`rounded-full px-2.5 py-1 text-[11.5px] ring-1 transition-colors ${cron === p.cron ? "bg-foreground text-primary-foreground ring-foreground" : "bg-surface ring-border hover:bg-accent/60"}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label>Cron expression</Label>
                <div className="flex items-center gap-1.5">
                  {["min", "hour", "day", "month", "wday"].map((lbl, i) => (
                    <div key={lbl} className="flex-1">
                      <input
                        value={parts[i]}
                        onChange={(e) => setPart(i, e.target.value.trim())}
                        className="w-full rounded-lg bg-surface-2 px-2 py-1.5 text-center font-mono text-[12px] focus:outline-none focus:ring-1 focus:ring-border-strong"
                      />
                      <div className="mt-1 text-center text-[9px] uppercase tracking-wide text-muted-foreground">
                        {lbl}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {trigger === "event" && (
            <div>
              <Label>Event</Label>
              <div className="flex flex-wrap gap-1.5">
                {EVENTS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setEvent(e)}
                    className={`rounded-full px-2.5 py-1 font-mono text-[11px] ring-1 transition-colors ${event === e ? "bg-foreground text-primary-foreground ring-foreground" : "bg-surface ring-border hover:bg-accent/60"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="h-px bg-border" />
          <div>
            <Label>Input source</Label>
            <Picker rows={INPUT_SRC} value={src} onPick={setSrc} />
          </div>
          <div>
            <Label>Output channel</Label>
            <Picker rows={OUTPUT_CH} value={out} onPick={setOut} />
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <PIcon name="Info" size={12} /> {summary}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl bg-surface px-3 py-1.5 text-[12.5px] ring-1 ring-border hover:bg-accent/60"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave && onSave({ trigger, cron, event, src, out, enabled });
                notify && notify("Schedule saved");
                onClose();
              }}
              className="rounded-xl bg-foreground px-3.5 py-1.5 text-[12.5px] font-medium text-primary-foreground hover:opacity-90"
            >
              Save schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function Label({ children }) {
  return (
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </div>
  );
}

/* --------------------- Usage · per-run step drill-in --------------------- */
function UsageRunModal({ run, onClose }) {
  if (!run) return null;
  const steps = run.steps;
  const totalTok = steps.reduce((n, s) => n + (s.tok || 0), 0) || 1;
  const totalCost = steps.reduce((n, s) => n + (s.cost || 0), 0);
  const maxTok = Math.max(...steps.map((s) => s.tok || 0), 1);
  return (
    <div className="absolute inset-0 z-50 grid place-items-center p-6" onClick={onClose}>
      <div className="absolute inset-0 node-config-bg" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="node-config-card relative w-[460px] overflow-hidden rounded-2xl bg-surface shadow-win ring-1 ring-border-strong"
      >
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
            <PIcon name="Gauge" size={15} className="text-foreground/75" />
          </span>
          <div className="flex-1">
            <div className="text-[13.5px] font-semibold tracking-tightish">{run.pipe}</div>
            <div className="font-mono text-[10.5px] text-muted-foreground">
              {run.id} · per-step consumption
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            <PIcon name="X" size={15} />
          </button>
        </div>
        <div className="px-4 py-3.5">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex-1 rounded-xl bg-surface-2 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Tokens
              </div>
              <div className="text-[15px] font-semibold tabular-nums">
                {(totalTok / 1000).toFixed(1)}k
              </div>
            </div>
            <div className="flex-1 rounded-xl bg-surface-2 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cost</div>
              <div className="text-[15px] font-semibold tabular-nums">${totalCost.toFixed(2)}</div>
            </div>
            <div className="flex-1 rounded-xl bg-surface-2 px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Steps</div>
              <div className="text-[15px] font-semibold tabular-nums">{steps.length}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3 py-1">
                <span className="w-5 font-mono text-[10px] text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="w-36 shrink-0 truncate text-[12px] font-medium">{s.name}</div>
                <div
                  className="flex-1 overflow-hidden rounded-full bg-surface-2"
                  style={{ height: 7 }}
                >
                  <div
                    className="rounded-full bg-foreground/70"
                    style={{ width: Math.max(2, (s.tok / maxTok) * 100) + "%", height: 7 }}
                  />
                </div>
                <span className="w-14 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
                  {(s.tok / 1000).toFixed(1)}k
                </span>
                <span className="w-12 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground">
                  ${s.cost.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { JobDetailDrawer, JOB_DETAIL, detailFor, ScheduleEditor, UsageRunModal });
