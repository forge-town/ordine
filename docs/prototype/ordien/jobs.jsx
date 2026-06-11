/* ——— jobs.jsx · Monitor » Jobs — a console for concurrent work orders.
       List = operate the fleet (pause / stop / rerun / review), no step-by-step noise.
       Calendar = week view: past runs + upcoming routine occurrences on one grid. ——— */
const { useState, useMemo } = React;
const { Icon, StatusPill, Dot, PageHeader, Btn } = window;

/* ------------------------------- time helpers ------------------------------- */
const DAY_MS = 864e5;
function monday(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; }
function hhmm(d) { return d.toTimeString().slice(0, 5); }
const NOW = new Date();
function todayAt(h, m) { const d = new Date(NOW); d.setHours(h, m, 0, 0); return d; }

/* --------------------------- the live fleet (today) --------------------------- */
const OPS = [
  { id: "job_8f2a", pipe: "Textbook → Notion Quiz", status: "running", t: new Date(Date.now() - 14600), step: 3, total: 5, stepName: "Generate Vocab Quiz", agent: "Codex", dur: "14.6s", cost: "$0.14", tok: "31k", by: "user" },
  { id: "job_7d10", pipe: "Lead Research Brief", status: "running", t: new Date(Date.now() - 62000), step: 2, total: 4, stepName: "Research (3 parallel)", agent: "Claude Code ×3", dur: "1m02s", cost: "$0.62", tok: "180k", by: "user" },
  { id: "job_7c93", pipe: "Contract Risk Review", status: "waitingForUser", t: new Date(Date.now() - 24 * 60000), step: 3, total: 4, stepName: "Reviewer sign-off", agent: "—", dur: "paused", cost: "$0.21", tok: "64k", by: "user" },
  { id: "job_7b41", pipe: "Support Ticket Triage", status: "queued", t: null, step: 0, total: 3, stepName: "Queued", agent: "—", dur: "—", cost: "—", tok: "—", by: "routine" },
  { id: "job_69f7", pipe: "Textbook → Notion Quiz", status: "completed", t: todayAt(9, 42), step: 5, total: 5, stepName: "Exported 20 questions", agent: "Codex", dur: "41.3s", cost: "$0.31", tok: "88k", by: "user" },
  { id: "job_6a08", pipe: "Repo → Changelog", status: "completed", t: todayAt(6, 0), step: 4, total: 4, stepName: "Exported changelog.md", agent: "Codex", dur: "21.7s", cost: "$0.08", tok: "22k", by: "routine" },
  { id: "job_64b2", pipe: "Lead Research Brief", status: "failed", t: todayAt(8, 15), step: 2, total: 4, stepName: "Research source timeout", agent: "Claude Code", dur: "34.0s", cost: "$0.18", tok: "51k", by: "routine" },
];

/* standing routines — drive future calendar occurrences + the live strip */
const ROUTINES0 = [
  { id: "r1", pipe: "Repo → Changelog", trigger: "cron", cron: "0 6 * * *", h: 6, m: 0 },
  { id: "r2", pipe: "Support Ticket Triage", trigger: "event", event: "ticket.created" },
];

/* shared routine store — the Pipelines page (Schedule chip) and the Jobs page (Calendar,
   New Routine) read & write the SAME list, so a schedule set anywhere shows everywhere. */
const RoutineStore = {
  list: ROUTINES0.slice(),
  subs: new Set(),
  get() { return this.list; },
  set(next) { this.list = typeof next === "function" ? next(this.list) : next; this.subs.forEach((f) => f(this.list)); },
  subscribe(f) { this.subs.add(f); return () => this.subs.delete(f); },
};
window.useOrdRoutines = function useOrdRoutines() {
  const [list, setList] = React.useState(RoutineStore.get());
  React.useEffect(() => RoutineStore.subscribe(setList), []);
  return [list, (next) => RoutineStore.set(next)];
};

/* deterministic history + future occurrences for any shown week */
function weekEvents(weekStart, routines, ops) {
  const evs = [];
  const isToday = (d) => d.toDateString() === NOW.toDateString();
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart.getTime() + i * DAY_MS);
    const dn = day.getDate();
    const mk = (pipe, h, m, extra) => {
      const t = new Date(day); t.setHours(h, m, 0, 0);
      const past = t.getTime() < Date.now();
      return { id: "job_" + dn.toString(16) + h.toString(16) + pipe.replace(/[^A-Z]/g, "").toLowerCase(), pipe, t, status: past ? "completed" : "scheduled", step: 4, total: 4, stepName: past ? "Completed" : "Scheduled", agent: "Codex", by: "routine", dur: (18 + (dn % 9)) + "." + (dn % 10) + "s", cost: "$0.0" + (6 + (dn % 4)), tok: (18 + dn % 9) + "k", ...extra };
    };
    if (isToday(day)) {
      // today comes from the live fleet
      (ops || OPS).filter((j) => j.t).forEach((j) => evs.push(j));
    } else if (day.getTime() < Date.now()) {
      evs.push(mk("Repo → Changelog", 6, 0));                                  // ran on its routine
      evs.push(mk("Support Ticket Triage", 10, 5, { dur: "6.1s", cost: "$0.01", tok: "3k" }));
      evs.push(mk("Support Ticket Triage", 15, 40, { dur: "5.8s", cost: "$0.01", tok: "3k" }));
      if (dn % 2 === 0) evs.push(mk("Textbook → Notion Quiz", 14, 20, { by: "user", dur: "39.8s", cost: "$0.29", tok: "84k" }));
      if (dn % 3 === 0) evs.push(mk("Lead Research Brief", 11, 0, { by: "user", dur: "2m04s", cost: "$0.58", tok: "171k" }));
      if (dn % 4 === 1) evs.push(mk("Contract Risk Review", 16, 30, { by: "user", dur: "1m12s", cost: "$0.44", tok: "120k" }));
    }
    // future occurrences come from the routine list — add or remove a routine and these follow
    (routines || []).filter((r) => r.trigger === "cron").forEach((r) => {
      const t = new Date(day); t.setHours(r.h, r.m, 0, 0);
      if (t.getTime() > Date.now()) evs.push({ id: "ghost_" + r.id + "_" + t.getTime(), routineId: r.id, pipe: r.pipe, t, status: "scheduled", step: 0, total: 4, stepName: "Scheduled", agent: "—", by: "routine", dur: "—", cost: "—", tok: "—" });
    });
  }
  return evs;
}

/* ------------------------------ small controls ------------------------------ */
function Seg({ value, onChange, options }) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${value === o.v ? "bg-surface text-foreground shadow-soft ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}>
          {o.icon && <Icon name={o.icon} size={13} />} {o.label}
        </button>
      ))}
    </div>
  );
}
function JSearch({ value, onChange }) {
  return (
    <div className="relative">
      <Icon name="Search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Search jobs…"
        className="w-full rounded-xl bg-surface-2 py-1.5 pr-7 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border-strong" style={{ paddingLeft: "2.1rem" }} />
      {value && <button onClick={() => onChange("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"><Icon name="X" size={12} /></button>}
    </div>
  );
}
function Act({ icon, label, onClick, solid }) {
  return (
    <button title={label} onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={solid
        ? "inline-flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
        : "rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100"}>
      <Icon name={icon} size={solid ? 11 : 13} />{solid ? label : null}
    </button>
  );
}

/* ----------------------------------- list ----------------------------------- */
function opsActions(j) {
  if (j.status === "running") return [["Pause", "Pause"], ["Square", "Stop"]];
  if (j.status === "paused") return [["Play", "Resume"], ["Square", "Stop"]];
  if (j.status === "queued") return [["X", "Cancel"]];
  if (j.status === "failed" || j.status === "completed" || j.status === "cancelled") return [["RefreshCw", "Rerun"]];
  return [];
}
function TableView({ jobs, onOpen, onAct }) {
  const cols = "grid-cols-[minmax(0,1fr)_110px_88px_72px_72px_84px]";
  return (
    <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border shadow-soft">
      <div className={`grid ${cols} items-center gap-3 border-b border-border/70 bg-surface-2/50 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground`}>
        <span>Job</span><span>Status</span><span>Started</span><span className="text-right">Duration</span><span className="text-right">Cost</span><span className="text-right">Actions</span>
      </div>
      <div className="divide-y divide-border/60">
        {jobs.map((j) => (
          <div key={j.id} onClick={() => onOpen(j)} className={`group grid ${cols} cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/30`}>
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="truncate text-[12.5px] font-medium tracking-tightish">{j.pipe}</span>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{j.id}{j.by === "routine" ? " · routine" : ""}</span>
            </div>
            <div><StatusPill status={j.status} /></div>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{j.t ? hhmm(j.t) : "—"}</span>
            <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">{j.dur}</span>
            <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">{j.cost}</span>
            <div className="flex items-center justify-end gap-0.5">
              {j.status === "waitingForUser"
                ? <Act icon="ArrowRight" label="Review" solid onClick={() => onOpen(j)} />
                : opsActions(j).map(([ic, lb]) => <Act key={lb} icon={ic} label={lb} onClick={() => onAct(lb, j)} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------- calendar --------------------------------- */
const CAL_START = 5, CAL_END = 21, HOUR_H = 34;
function evStyle(ev) {
  if (ev.status === "scheduled") return "border border-dashed border-border-strong bg-transparent text-muted-foreground";
  if (ev.status === "running") return "bg-foreground text-primary-foreground";
  if (ev.status === "failed") return "bg-destructive/[0.08] text-foreground ring-1 ring-destructive/30";
  if (ev.status === "waitingForUser" || ev.status === "paused") return "bg-surface-2 text-foreground ring-1 ring-border-strong";
  if (ev.status === "cancelled") return "bg-surface-2/60 text-muted-foreground ring-1 ring-border";
  return "bg-surface text-foreground ring-1 ring-border shadow-soft";
}
function CalendarView({ weekOff, setWeekOff, routines, ops, onOpenJob, onNewRoutine, onEditRoutine, notify }) {
  const weekStart = useMemo(() => new Date(monday(NOW).getTime() + weekOff * 7 * DAY_MS), [weekOff]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * DAY_MS)), [weekStart]);
  const events = useMemo(() => weekEvents(weekStart, routines, ops), [weekStart, routines, ops]);
  const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " + days[6].toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const nowTop = (NOW.getHours() + NOW.getMinutes() / 60 - CAL_START) * HOUR_H;
  const gridH = (CAL_END - CAL_START) * HOUR_H;
  return (
    <div className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border shadow-soft">
      {/* controls */}
      <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
        <span className="text-[13px] font-semibold tracking-tightish">{label}</span>
        <span className="text-[10.5px] text-muted-foreground">{weekOff === 0 ? "this week" : weekOff > 0 ? `+${weekOff}w` : `${weekOff}w`}</span>
        <div className="ml-auto flex items-center gap-1">
          <span className="mr-2 hidden items-center gap-3 text-[10px] text-muted-foreground lg:flex">
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-surface ring-1 ring-border" /> ran</span>
            <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm border border-dashed border-border-strong" /> scheduled</span>
          </span>
          <button onClick={() => setWeekOff(weekOff - 1)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Icon name="ChevronLeft" size={14} /></button>
          <button onClick={() => setWeekOff(0)} className="rounded-lg px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground">Today</button>
          <button onClick={() => setWeekOff(weekOff + 1)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"><Icon name="ChevronRight" size={14} /></button>
          <div className="mx-1 h-4 w-px bg-border" />
          <button onClick={onNewRoutine} className="inline-flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1.5 text-[11px] font-medium text-primary-foreground hover:opacity-90">
            <Icon name="Plus" size={12} /> Schedule
          </button>
        </div>
      </div>
      {/* day headers */}
      <div className="grid border-b border-border/70" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        <div />
        {days.map((d, i) => {
          const today = d.toDateString() === NOW.toDateString();
          return (
            <div key={i} className="flex items-center justify-center gap-1.5 border-l border-border/50 py-2">
              <span className={`text-[10px] uppercase tracking-[0.08em] ${today ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{d.toLocaleDateString("en-US", { weekday: "short" })}</span>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums ${today ? "bg-foreground font-semibold text-primary-foreground" : "text-foreground/80"}`}>{d.getDate()}</span>
            </div>
          );
        })}
      </div>
      {/* event-triggered routines (no fixed time) */}
      <div className="flex items-center gap-2 border-b border-border/70 bg-surface-2/40 px-3.5 py-1.5">
        <span className="w-[36px] shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">live</span>
        {routines.filter((r) => r.trigger === "event").map((r) => (
          <button key={r.id} onClick={() => onEditRoutine(r.id)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-[10.5px] font-medium ring-1 ring-border hover:ring-border-strong">
            <Dot tone="muted" ping /> {r.pipe} <span className="font-mono text-[9.5px] text-muted-foreground">on {r.event}</span>
          </button>
        ))}
        {!routines.some((r) => r.trigger === "event") && <span className="text-[10px] text-muted-foreground">no event-triggered routines</span>}
      </div>
      {/* week grid */}
      <div className="relative grid" style={{ gridTemplateColumns: "48px repeat(7, 1fr)", height: gridH }}>
        {/* hour labels + lines */}
        <div className="relative">
          {Array.from({ length: CAL_END - CAL_START }, (_, i) => (
            <div key={i} className="absolute right-2 -translate-y-1/2 font-mono text-[9px] text-muted-foreground/80" style={{ top: i * HOUR_H || 8 }}>{i === 0 ? "" : String(CAL_START + i).padStart(2, "0") + ":00"}</div>
          ))}
        </div>
        {days.map((d, di) => {
          const today = d.toDateString() === NOW.toDateString();
          const dayEvs = events.filter((e) => e.t && e.t.toDateString() === d.toDateString())
            .map((ev) => ({ ev, top: Math.max(0, (ev.t.getHours() + ev.t.getMinutes() / 60 - CAL_START) * HOUR_H) }))
            .sort((a, b) => a.top - b.top);
          /* split side-by-side when blocks would overlap (within one chip height) */
          dayEvs.forEach((p, i) => {
            const cluster = dayEvs.filter((q) => Math.abs(q.top - p.top) < 22);
            p.cols = cluster.length; p.col = cluster.indexOf(p);
          });
          return (
            <div key={di} className={`relative border-l border-border/50 ${today ? "bg-accent/25" : ""}`}>
              {Array.from({ length: CAL_END - CAL_START }, (_, i) => (
                <div key={i} className="absolute inset-x-0 border-t border-border/40" style={{ top: i * HOUR_H }} />
              ))}
              {dayEvs.map(({ ev, top, col, cols }) => {
                const ghost = ev.status === "scheduled";
                const w = 100 / cols;
                return (
                  <button key={ev.id + ev.t.getTime()}
                    onClick={() => ghost ? onEditRoutine(ev.routineId) : onOpenJob(ev)}
                    className={`absolute z-10 flex items-center gap-1 truncate rounded-md px-1.5 text-left text-[9.5px] font-medium leading-none transition-all hover:z-20 hover:shadow-float ${evStyle(ev)}`}
                    style={{ top: top + 1, height: 20, left: `calc(${col * w}% + 4px)`, width: `calc(${w}% - 8px)` }}
                    title={`${ev.pipe} · ${hhmm(ev.t)}${ghost ? " · scheduled" : ""}`}>
                    {ev.status === "running" && <span className="h-1 w-1 shrink-0 animate-pulse rounded-full bg-primary-foreground" />}
                    {ev.status === "failed" && <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--c-destructive)" }} />}
                    {ev.status === "completed" && <span className="h-1 w-1 shrink-0 rounded-full" style={{ background: "var(--c-success)" }} />}
                    <span className="truncate">{ev.pipe}</span>
                    {cols === 1 && <span className={`ml-auto shrink-0 font-mono text-[8.5px] ${ev.status === "running" ? "opacity-70" : "text-muted-foreground"}`}>{hhmm(ev.t)}</span>}
                  </button>
                );
              })}
              {/* now line */}
              {today && nowTop > 0 && nowTop < gridH && (
                <div className="pointer-events-none absolute inset-x-0 z-20" style={{ top: nowTop }}>
                  <div className="h-px w-full" style={{ background: "color-mix(in oklab, var(--c-destructive) 75%, transparent)" }} />
                  <div className="absolute -left-0.5 -top-[2.5px] h-[5px] w-[5px] rounded-full" style={{ background: "var(--c-destructive)" }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------- page ----------------------------------- */
function JobsPage({ onOpen, notify }) {
  const [view, setView] = useState("list");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [ops, setOps] = useState(OPS);
  const [routines, setRoutines] = window.useOrdRoutines();
  const [sched, setSched] = useState(null);   // { mode: "new" } | { mode: "edit", routine }
  const [weekOff, setWeekOff] = useState(0);
  /* optimistic local transitions — the real engine confirms these over IPC later */
  const act = (lb, j) => {
    const patch =
      lb === "Pause" ? { status: "paused", dur: j.dur } :
      lb === "Resume" ? { status: "running" } :
      lb === "Stop" || lb === "Cancel" ? { status: "cancelled" } :
      lb === "Rerun" ? { status: "running", t: new Date(), dur: "0.2s", cost: "$0.00", tok: "—" } : null;
    if (patch) setOps((os) => os.map((x) => x.id === j.id ? { ...x, ...patch } : x));
    notify && notify(`${lb} · ${j.id}`);
  };
  const saveRoutine = (cfg) => {
    setRoutines((rs) => {
      let next = sched && sched.mode === "edit" ? rs.filter((r) => r.id !== sched.routine.id) : rs.slice();
      const id = sched && sched.mode === "edit" ? sched.routine.id : "r" + Date.now();
      if (cfg.trigger === "cron") {
        const p = (cfg.cron || "0 6 * * *").split(" ");
        next.push({ id, pipe: cfg.pipeName, trigger: "cron", cron: cfg.cron, h: parseInt(p[1], 10) || 0, m: parseInt(p[0], 10) || 0 });
      } else if (cfg.trigger === "event") {
        next.push({ id, pipe: cfg.pipeName, trigger: "event", event: cfg.event });
      }
      return next;   // "manual" = no standing routine
    });
  };
  const removeRoutine = (id) => setRoutines((rs) => rs.filter((r) => r.id !== id));
  const editRoutine = (id) => { const r = routines.find((x) => x.id === id); if (r) setSched({ mode: "edit", routine: r }); };
  const ql = q.trim().toLowerCase();
  const jobs = ops.filter((j) => !ql || j.pipe.toLowerCase().includes(ql) || j.id.includes(ql));
  const counts = {
    running: ops.filter((j) => j.status === "running").length,
    waiting: ops.filter((j) => j.status === "waitingForUser").length,
    queued: ops.filter((j) => j.status === "queued").length,
    failed: ops.filter((j) => j.status === "failed").length,
  };
  const JobDetailDrawer = window.JobDetailDrawer, ScheduleEditor = window.ScheduleEditor;
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader eyebrow="Monitor" title="Jobs"
        sub="Concurrent work orders. Operate the fleet — pause, rerun, step in. The how lives on the canvas."
        actions={<><Btn variant="ghost" icon="Clock" onClick={() => setSched({ mode: "new" })}>New Routine</Btn><Btn variant="solid" icon="Play" onClick={onOpen}>New Run</Btn></>} />
      <div className="flex items-center gap-3 px-7 pb-3.5">
        <Seg value={view} onChange={setView} options={[{ v: "list", label: "List", icon: "Rows3" }, { v: "calendar", label: "Calendar", icon: "CalendarDays" }]} />
        {view === "list" && (
          <span className="text-[11px] text-muted-foreground">
            {counts.running} running · {counts.queued} queued · {counts.waiting} waiting on you · {counts.failed} failed today
          </span>
        )}
        {view === "list" && <div className="ml-auto w-56"><JSearch value={q} onChange={setQ} /></div>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-8 pt-0.5">
        {view === "list"
          ? (jobs.length
              ? <TableView jobs={jobs} onOpen={setDetail} onAct={act} />
              : <div className="grid place-items-center rounded-2xl bg-surface-2/50 py-16 text-center">
                  <Icon name="SearchX" size={22} className="text-muted-foreground/60" />
                  <div className="mt-2 text-[13px] font-medium">No jobs match “{q}”</div>
                </div>)
          : <CalendarView weekOff={weekOff} setWeekOff={setWeekOff} routines={routines} ops={ops} onOpenJob={setDetail} onNewRoutine={() => setSched({ mode: "new" })} onEditRoutine={editRoutine} notify={notify} />}
      </div>
      {detail && JobDetailDrawer && <JobDetailDrawer job={detail} onOpenCanvas={() => { setDetail(null); onOpen && onOpen(); }} onClose={() => setDetail(null)} notify={notify} />}
      {sched && ScheduleEditor && (
        <ScheduleEditor
          pipe={sched.mode === "new" ? { pickable: true } : { name: sched.routine.pipe, schedule: sched.routine.trigger === "event" ? "On event" : "Daily" }}
          initial={sched.mode === "edit" ? { trigger: sched.routine.trigger, cron: sched.routine.cron, event: sched.routine.event } : undefined}
          onDelete={sched.mode === "edit" ? () => removeRoutine(sched.routine.id) : undefined}
          onSave={saveRoutine}
          onClose={() => setSched(null)} notify={notify} />
      )}
    </div>
  );
}

window.Pages = window.Pages || {};
window.Pages.jobs = JobsPage;
if (window.SEARCH) window.SEARCH.jobs = OPS;
