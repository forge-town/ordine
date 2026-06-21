/* ——— pages.jsx · Assembly / Monitor / Capabilities pages ——— */
const { useState: useStateP } = React;
const useState = useStateP;
const { Icon, StatusPill, Dot, PageHeader, Btn, SearchInput, Chip, Stat, Tag } = window;

/* --------------------------- shared scaffolding --------------------------- */
function Page({ children }) {
  return <div className="flex h-full flex-col overflow-hidden">{children}</div>;
}
function Body({ children, className = "" }) {
  return <div className={`min-h-0 flex-1 overflow-y-auto px-7 pb-8 ${className}`}>{children}</div>;
}
function Toolbar({ children }) {
  return <div className="flex items-center gap-2 px-7 pb-3.5">{children}</div>;
}

/* controlled chip row */
function ChipRow({ items, active, onChange }) {
  return (
    <div className="flex items-center gap-0.5">
      {items.map((it) => (
        <Chip
          key={it.label}
          active={active === it.label}
          count={it.count}
          onClick={() => onChange(it.label)}
        >
          {it.label}
        </Chip>
      ))}
    </div>
  );
}
/* controlled search */
function Search({ value, onChange, placeholder }) {
  return (
    <div className="relative">
      <Icon
        name="Search"
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-surface-2 py-1.5 pr-7 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border-strong"
        style={{ paddingLeft: "2.1rem" }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"
        >
          <Icon name="X" size={12} />
        </button>
      )}
    </div>
  );
}
function Empty({ q }) {
  return (
    <div className="grid place-items-center rounded-2xl bg-surface-2/50 py-16 text-center">
      <Icon name="SearchX" size={22} className="text-muted-foreground/60" />
      <div className="mt-2 text-[13px] font-medium">No results{q ? ` for “${q}”` : ""}</div>
      <div className="mt-0.5 text-[11.5px] text-muted-foreground">
        Try a different filter or search term.
      </div>
    </div>
  );
}
function Mono({ children }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-[12px] font-bold tracking-tight">
      {children}
    </span>
  );
}
function MiniChain({ steps }) {
  return (
    <div className="flex items-center gap-0.5">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-[7px] ${s.compound ? "bg-foreground/8 ring-1 ring-border-strong" : "bg-surface-2"}`}
          >
            <Icon name={s.icon} size={11} className="text-foreground/70" />
          </span>
          {i < steps.length - 1 && <span className="h-px w-2.5 bg-border-strong" />}
        </React.Fragment>
      ))}
    </div>
  );
}
function BarRow({ label, value, pct, sub, tone }) {
  const c = tone === "fg" ? "bg-foreground/80" : "bg-foreground/35";
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-40 shrink-0 truncate text-[12.5px] font-medium">{label}</div>
      <div className="flex-1 overflow-hidden rounded-full bg-surface-2" style={{ height: 8 }}>
        <div className={`rounded-full ${c}`} style={{ width: pct + "%", height: 8 }} />
      </div>
      <div className="w-28 shrink-0 text-right text-[12px] tabular-nums text-muted-foreground">
        {value}
      </div>
      {sub && (
        <div className="w-14 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground/70">
          {sub}
        </div>
      )}
    </div>
  );
}
/* small dropdown */
function Dropdown({ label, icon, items, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-1.5 text-[12.5px] font-medium ring-1 ring-border hover:ring-border-strong hover:bg-accent/40"
      >
        {icon && <Icon name={icon} size={14} />} {label}{" "}
        <Icon
          name="ChevronDown"
          size={13}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded-xl bg-surface p-1.5 shadow-float ring-1 ring-border-strong fade-rise">
          {items.map((it) => (
            <button
              key={it}
              onMouseDown={() => {
                onPick(it);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-accent/60"
            >
              {it}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================ ASSEMBLY · PIPELINES ============================ */
const PIPES = [
  {
    name: "Textbook → Notion Quiz",
    desc: "Parse PDFs → vocab/grammar → quiz → adversarial verify → Notion.",
    tag: "Saved Skill",
    hero: true,
    steps: [
      { icon: "FolderOpen" },
      { icon: "FileText" },
      { icon: "Sparkles" },
      { icon: "ShieldCheck", compound: true },
      { icon: "Boxes" },
    ],
    runs: 47,
    success: 98,
    avg: "41s",
    slots: 2,
    badges: ["Verify"],
  },
  {
    name: "Repo → Changelog",
    desc: "Diff a GitHub repo since last tag and write a clean changelog.",
    tag: "Saved Skill",
    schedule: "Daily · 06:00",
    steps: [{ icon: "Github" }, { icon: "GitBranch" }, { icon: "FileText" }, { icon: "Boxes" }],
    runs: 120,
    success: 99,
    avg: "22s",
    slots: 1,
    badges: [],
  },
  {
    name: "Contract Risk Review",
    desc: "Extract clauses, flag risk, council debate, reviewer sign-off.",
    tag: "Saved Skill",
    steps: [
      { icon: "FileText" },
      { icon: "ShieldCheck", compound: true },
      { icon: "Users", compound: true },
      { icon: "Boxes" },
    ],
    runs: 31,
    success: 94,
    avg: "1m12s",
    slots: 1,
    badges: ["Verify", "Council"],
  },
  {
    name: "Lead Research Brief",
    desc: "Split prospects, research in parallel, merge into one brief.",
    tag: "Saved Skill",
    steps: [
      { icon: "Split", compound: true },
      { icon: "Globe" },
      { icon: "FileText" },
      { icon: "Boxes" },
    ],
    runs: 88,
    success: 96,
    avg: "2m4s",
    slots: 3,
    badges: ["Delegation"],
  },
  {
    name: "Support Ticket Triage",
    desc: "Classify inbound tickets and route, on every new ticket.",
    tag: "Saved Skill",
    schedule: "On event · ticket.created",
    steps: [{ icon: "Inbox" }, { icon: "Sparkles" }, { icon: "GitBranch" }],
    runs: 540,
    success: 97,
    avg: "6s",
    slots: 0,
    badges: [],
  },
  {
    name: "Untitled pipeline",
    desc: "Draft — only a conversation so far, no nodes applied yet.",
    tag: "Draft",
    draft: true,
    steps: [{ icon: "MessageSquare" }],
    runs: 0,
    success: null,
    avg: "—",
    slots: 0,
    badges: [],
  },
];
function PipelineCard({ p, onOpen, onSchedule }) {
  return (
    <button
      onClick={onOpen}
      className="group flex flex-col rounded-2xl bg-surface p-4 text-left ring-1 ring-border shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-float hover:ring-border-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-primary-foreground">
          <Icon name={p.draft ? "MessageSquare" : "Workflow"} size={16} />
        </div>
        <div className="flex items-center gap-1.5">
          {!p.draft && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onSchedule && onSchedule(p);
              }}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors ${p.schedule ? "bg-foreground text-primary-foreground" : "bg-surface-2 text-muted-foreground hover:bg-accent"}`}
            >
              <Icon name="Clock" size={10} /> {p.schedule ? "Routine" : "Schedule"}
            </span>
          )}
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.draft ? "status-wash-muted" : "bg-accent text-foreground/80"}`}
          >
            {p.tag}
          </span>
        </div>
      </div>
      <div className="mt-3 text-[14px] font-semibold tracking-tightish">{p.name}</div>
      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
        {p.desc}
      </p>
      <div className="mt-3.5">
        <MiniChain steps={p.steps} />
      </div>
      {p.badges.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {p.badges.map((b) => (
            <span
              key={b}
              className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {b}
            </span>
          ))}
          {p.slots > 0 && (
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {p.slots} input slot{p.slots > 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
      <div className="mt-4 flex items-center gap-4 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Icon name="Play" size={11} /> {p.runs} runs
        </span>
        {p.success != null ? (
          <span className="inline-flex items-center gap-1">
            <Dot tone="success" /> {p.success}%
          </span>
        ) : (
          <span className="inline-flex items-center gap-1">
            <Dot tone="muted" /> new
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <Icon name="Timer" size={11} /> {p.avg}
        </span>
        <span className="ml-auto opacity-0 transition-opacity group-hover:opacity-100">
          <Icon name="ArrowRight" size={14} />
        </span>
      </div>
    </button>
  );
}
function PipelinesPage({ onOpen, onOpenPipeline, onNewPipeline, notify }) {
  const openOne = onOpenPipeline || onOpen;
  const newOne = onNewPipeline || onOpen;
  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const [sched, setSched] = useState(null);
  const ScheduleEditor = window.ScheduleEditor;
  const ql = q.trim().toLowerCase();
  const filtered = PIPES.filter((p) => {
    const okTab =
      tab === "All" ||
      (tab === "Saved Skills" && p.tag === "Saved Skill") ||
      (tab === "Drafts" && p.draft) ||
      (tab === "Scheduled" && p.schedule);
    const okQ = !ql || p.name.toLowerCase().includes(ql) || p.desc.toLowerCase().includes(ql);
    return okTab && okQ;
  });
  return (
    <Page>
      <PageHeader
        eyebrow="Assembly"
        title="Pipelines"
        sub="Reusable production lines. Each one that runs clean is distilled into a Pipeline Skill you can re-run with new input."
        actions={
          <Btn variant="solid" icon="Plus" onClick={newOne}>
            New Pipeline
          </Btn>
        }
      />
      <Toolbar>
        <ChipRow
          active={tab}
          onChange={setTab}
          items={[
            { label: "All", count: PIPES.length },
            { label: "Saved Skills", count: PIPES.filter((p) => p.tag === "Saved Skill").length },
            { label: "Drafts", count: PIPES.filter((p) => p.draft).length },
            { label: "Scheduled", count: PIPES.filter((p) => p.schedule).length },
          ]}
        />
        <div className="ml-auto w-60">
          <Search value={q} onChange={setQ} placeholder="Search pipelines…" />
        </div>
      </Toolbar>
      <Body>
        {filtered.length ? (
          <div className="grid grid-cols-3 gap-3.5">
            {filtered.map((p) => (
              <PipelineCard
                key={p.name}
                p={p}
                onOpen={() => (p.draft ? newOne() : openOne(p.name))}
                onSchedule={setSched}
              />
            ))}
          </div>
        ) : (
          <Empty q={q} />
        )}
      </Body>
      {sched && ScheduleEditor && (
        <ScheduleEditor
          pipe={sched}
          onSave={() => {}}
          onClose={() => setSched(null)}
          notify={notify}
        />
      )}
    </Page>
  );
}

/* =========================== ASSEMBLY · COMPONENTS =========================== */
const COMPONENTS = {
  "Input Objects": {
    icon: "Download",
    items: [
      {
        name: "Folder",
        io: "→ files[]",
        meta: "~/study",
        used: 9,
        config: { source: "~/study", format: "any files", out: "files[]" },
      },
      {
        name: "File",
        io: "→ file",
        meta: "~/file.pdf",
        used: 6,
        config: { source: "~/file.pdf", format: "any", out: "file" },
      },
      {
        name: "GitHub Project",
        io: "→ repo",
        meta: "owner/repo",
        used: 4,
        config: { source: "owner/repo", format: "git repo", out: "repo" },
      },
      {
        name: "Prompt",
        io: "→ text",
        meta: "inline instruction",
        used: 23,
        config: { source: "(inline text)", format: "text", out: "text" },
      },
    ],
  },
  Operations: {
    icon: "Cpu",
    items: [
      {
        name: "Parse & Extract PDF",
        io: "files[] → { vocabulary, grammar, blocks }",
        meta: "Claude Code · parser.skill",
        used: 7,
        config: {
          prompt:
            "Extract every vocabulary term, grammar point, and clean text block from each document. Return strict JSON.",
          agent: "Claude Code",
          via: "skill",
          skill: "parser.skill",
          checkpoint: false,
        },
        lastRun: { tokens: "3.1k", cost: "$0.04", dur: "8.2s", at: "in last run" },
      },
      {
        name: "Summarize",
        io: "text → summary",
        meta: "Codex · summarize.skill",
        used: 14,
        config: {
          prompt: "Summarize the input faithfully with length control. Keep key facts.",
          agent: "Codex",
          via: "skill",
          skill: "summarize.skill",
          checkpoint: false,
        },
      },
      {
        name: "Vocab Quiz Gen",
        io: "vocabulary → quiz[]",
        meta: "Codex · quiz-gen.skill",
        used: 3,
        config: {
          prompt: "Generate multiple-choice questions from the vocabulary list.",
          agent: "Codex",
          via: "skill",
          skill: "quiz-gen.skill",
          checkpoint: false,
        },
      },
      {
        name: "Extract Entities",
        io: "text → entities[]",
        meta: "Hermes · ner.skill",
        used: 8,
        config: {
          prompt: "Named-entity recognition tuned for contracts and resumes.",
          agent: "Hermes",
          via: "skill",
          skill: "ner.skill",
          checkpoint: false,
        },
      },
      {
        name: "SEO Pass",
        io: "draft → optimized",
        meta: "Codex · seo.skill",
        used: 5,
        config: {
          prompt: "Rewrite the draft for target keywords without losing voice.",
          agent: "Codex",
          via: "skill",
          skill: "seo.skill",
          checkpoint: false,
        },
      },
    ],
  },
  Output: {
    icon: "Upload",
    items: [
      {
        name: "Local Path",
        io: "any → file",
        meta: "local-fs · Write file",
        used: 11,
        config: { dest: "~/out", connector: "local-fs", mode: "Write file" },
      },
      {
        name: "Notion DB",
        io: "rows[] → notion",
        meta: "notion-mcp · Append rows",
        used: 6,
        config: { dest: "Notion · Database", connector: "notion-mcp", mode: "Append rows" },
      },
      {
        name: "Project Path",
        io: "any → project",
        meta: "workspace · Write file",
        used: 9,
        config: { dest: "workspace artifact", connector: "workspace", mode: "Write file" },
      },
    ],
  },
  "Pipeline Skill": {
    icon: "Workflow",
    items: [
      {
        name: "Textbook → Notion Quiz",
        io: "folder → notion DB",
        meta: "5 nodes · Verify",
        used: 2,
        compound: true,
      },
      { name: "Repo → Changelog", io: "repo → markdown", meta: "4 nodes", used: 5, compound: true },
    ],
  },
};
const KIND_OF = { "Input Objects": "Input Object", Operations: "Operation", Output: "Output" };
function blankFor(cat) {
  if (cat === "Input Objects")
    return {
      name: "Untitled input",
      io: "→ output",
      meta: "new input",
      used: 0,
      config: { source: "~/", format: "any", out: "output" },
    };
  if (cat === "Operations")
    return {
      name: "Untitled operation",
      io: "input → output",
      meta: "new operation",
      used: 0,
      config: {
        prompt: "Describe what this operation should do…",
        agent: "Claude Code",
        via: "skill",
        skill: "new.skill",
        checkpoint: false,
      },
    };
  return {
    name: "Untitled output",
    io: "input → dest",
    meta: "new output",
    used: 0,
    config: { dest: "~/out", connector: "local-fs", mode: "Write file" },
  };
}
function deriveMeta(cat, d) {
  const c = d.config || {};
  if (cat === "Operations") return `${c.agent} · ${c.via === "mcp" ? c.mcp : c.skill}`;
  if (cat === "Input Objects") return c.source || "input";
  return `${c.connector} · ${c.mode}`;
}
function deriveIO(cat, d, prev) {
  const c = d.config || {};
  if (cat === "Input Objects") return `→ ${c.out}`;
  if (cat === "Output") return `→ ${c.dest}`;
  return prev;
}

/* edit a component by reusing the canvas NodeConfig sheet */
function ComponentEditor({ cat, icon, item, onCommit, onClose }) {
  const NodeConfig = window.NodeConfig;
  const [draft, setDraft] = useState(() => ({
    id: item._id,
    title: item.name,
    kind: KIND_OF[cat],
    icon,
    config: JSON.parse(JSON.stringify(item.config || {})),
    lastRun: item.lastRun,
  }));
  const snap = React.useRef(JSON.stringify({ title: item.name, config: item.config || {} }));
  const dirty = JSON.stringify({ title: draft.title, config: draft.config }) !== snap.current;
  const banner = (
    <div className="flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground ring-1 ring-border">
      <Icon name="GitBranch" size={12} className="mt-0.5 shrink-0" />
      <div>
        Used in{" "}
        <span className="font-medium text-foreground">
          {item.used} pipeline{item.used !== 1 ? "s" : ""}
        </span>
        . Edits apply to <span className="text-foreground">new runs</span>; existing pipelines keep
        their saved copy until re-applied.
      </div>
    </div>
  );
  return (
    <NodeConfig
      node={draft}
      banner={banner}
      dirty={dirty}
      onConfig={(p) => setDraft((d) => ({ ...d, config: { ...d.config, ...p } }))}
      onTitle={(_id, t) => setDraft((d) => ({ ...d, title: t }))}
      onReset={() => {
        const s = JSON.parse(snap.current);
        setDraft((d) => ({ ...d, title: s.title, config: JSON.parse(JSON.stringify(s.config)) }));
      }}
      onClose={() => {
        onCommit(draft);
        onClose();
      }}
    />
  );
}

function ConfirmDialog({ title, body, confirmLabel, onConfirm, onClose }) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center p-6" onClick={onClose}>
      <div className="absolute inset-0 node-config-bg" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="node-config-card relative w-[340px] rounded-2xl bg-surface p-4 shadow-win ring-1 ring-border-strong"
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ background: "color-mix(in oklab, var(--c-destructive) 12%, transparent)" }}
        >
          <Icon name="Trash2" size={16} style={{ color: "var(--c-destructive)" }} />
        </div>
        <div className="mt-2.5 text-[14px] font-semibold tracking-tightish">{title}</div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-3.5 flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-surface py-2 text-[12.5px] ring-1 ring-border hover:bg-accent/60"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 rounded-xl py-2 text-[12.5px] font-medium text-primary-foreground hover:opacity-90"
            style={{ background: "var(--c-destructive)" }}
          >
            {confirmLabel || "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ComponentsPage({ notify, onOpen }) {
  const [comps, setComps] = useState(() => {
    const o = {};
    let i = 0;
    for (const cat of Object.keys(COMPONENTS))
      o[cat] = {
        icon: COMPONENTS[cat].icon,
        items: COMPONENTS[cat].items.map((it) => ({ ...it, _id: "c" + i++ })),
      };
    return o;
  });
  const cats = Object.keys(comps);
  const total = cats.reduce((n, c) => n + comps[c].items.length, 0);
  const [active, setActive] = useState("All");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null); // { cat, id }
  const [confirm, setConfirm] = useState(null); // { cat, id, name, used }
  const [picker, setPicker] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const ql = q.trim().toLowerCase();
  const shown = active === "All" ? cats : [active];
  const sections = shown
    .map((cat) => ({
      cat,
      items: comps[cat].items.filter(
        (it) => !ql || it.name.toLowerCase().includes(ql) || it.meta.toLowerCase().includes(ql),
      ),
    }))
    .filter((s) => s.items.length);

  const editItem = (cat, it) => {
    if (cat === "Pipeline Skill") {
      notify && notify(`Opening “${it.name}” in canvas…`);
      onOpen && onOpen();
      return;
    }
    setEditing({ cat, id: it._id });
  };
  const commit = (cat, id, draft) =>
    setComps((cs) => ({
      ...cs,
      [cat]: {
        ...cs[cat],
        items: cs[cat].items.map((it) =>
          it._id === id
            ? {
                ...it,
                name: draft.title.trim() || it.name,
                config: draft.config,
                meta: deriveMeta(cat, draft),
                io: deriveIO(cat, draft, it.io),
              }
            : it,
        ),
      },
    }));
  const del = () => {
    const { cat, id } = confirm;
    setComps((cs) => ({
      ...cs,
      [cat]: { ...cs[cat], items: cs[cat].items.filter((it) => it._id !== id) },
    }));
    setConfirm(null);
    notify && notify("Component deleted");
  };
  const create = (cat) => {
    const id = "c" + Date.now();
    const b = blankFor(cat);
    setComps((cs) => ({
      ...cs,
      [cat]: { ...cs[cat], items: [{ ...b, _id: id }, ...cs[cat].items] },
    }));
    setActive(cat);
    setPicker(false);
    setEditing({ cat, id });
  };

  const editingItem = editing ? comps[editing.cat].items.find((it) => it._id === editing.id) : null;

  return (
    <Page>
      <PageHeader
        eyebrow="Assembly"
        title="Components"
        sub="Your asset library — the flywheel. When the Agent builds a pipeline it reuses these before making anything new."
        actions={
          <>
            <Btn variant="ghost" icon="Search" onClick={() => setFindOpen(true)}>
              Find for me
            </Btn>
            <div className="relative">
              <Btn variant="solid" icon="Plus" onClick={() => setPicker((v) => !v)}>
                New Component
              </Btn>
              {picker && (
                <div
                  className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl bg-surface p-1.5 shadow-float ring-1 ring-border-strong fade-rise"
                  onMouseLeave={() => setPicker(false)}
                >
                  <div className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    New component
                  </div>
                  {[
                    ["Input Objects", "Download"],
                    ["Operations", "Cpu"],
                    ["Output", "Upload"],
                  ].map(([c, ic]) => (
                    <button
                      key={c}
                      onClick={() => create(c)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-accent/60"
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-2">
                        <Icon name={ic} size={12} />
                      </span>{" "}
                      {KIND_OF[c]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        }
      />
      <Toolbar>
        <div className="flex items-center gap-0.5">
          <Chip active={active === "All"} onClick={() => setActive("All")} count={total}>
            All
          </Chip>
          {cats.map((c) => (
            <Chip
              key={c}
              active={active === c}
              onClick={() => setActive(c)}
              count={comps[c].items.length}
            >
              {c}
            </Chip>
          ))}
        </div>
        <div className="ml-auto w-60">
          <Search value={q} onChange={setQ} placeholder="Search components…" />
        </div>
      </Toolbar>
      <Body className="space-y-6">
        {sections.length ? (
          sections.map(({ cat, items }) => (
            <section key={cat}>
              <div className="mb-2.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                <Icon name={comps[cat].icon} size={13} /> {cat}
                <span className="rounded-full bg-surface-2 px-1.5 text-[10px]">{items.length}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {items.map((it) => (
                  <div
                    key={it._id}
                    className="group flex flex-col rounded-2xl bg-surface p-3.5 ring-1 ring-border shadow-soft transition-all hover:shadow-float hover:ring-border-strong"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${it.compound ? "bg-foreground text-primary-foreground" : "bg-surface-2"}`}
                      >
                        <Icon
                          name={comps[cat].icon}
                          size={14}
                          className={it.compound ? "" : "text-foreground/75"}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold tracking-tightish">
                          {it.name}
                        </div>
                        <div className="truncate text-[10.5px] text-muted-foreground">
                          {it.meta}
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => editItem(cat, it)}
                          title={cat === "Pipeline Skill" ? "Open in canvas" : "Edit"}
                          className="rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Icon
                            name={cat === "Pipeline Skill" ? "Maximize2" : "Pencil"}
                            size={13}
                          />
                        </button>
                        <button
                          onClick={() =>
                            setConfirm({ cat, id: it._id, name: it.name, used: it.used })
                          }
                          title="Delete"
                          className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Icon name="Trash2" size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="mt-2.5 truncate rounded-lg bg-surface-2 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                      {it.io}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 whitespace-nowrap text-[10.5px] text-muted-foreground">
                      <Icon name="GitBranch" size={11} /> used in {it.used} pipeline
                      {it.used !== 1 ? "s" : ""}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <Empty q={q} />
        )}
      </Body>

      {editingItem && window.NodeConfig && (
        <ComponentEditor
          cat={editing.cat}
          icon={comps[editing.cat].icon}
          item={editingItem}
          onCommit={(draft) => commit(editing.cat, editing.id, draft)}
          onClose={() => setEditing(null)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={`Delete “${confirm.name}”?`}
          body={
            confirm.used > 0
              ? `This component is used in ${confirm.used} pipeline${confirm.used !== 1 ? "s" : ""}. They’ll keep their saved copy, but it won’t be reusable from the library anymore.`
              : "This component isn’t used in any pipeline yet."
          }
          onConfirm={del}
          onClose={() => setConfirm(null)}
        />
      )}
      {findOpen && window.FindForMeModal && (
        <window.FindForMeModal
          items={cats
            .filter((c) => c !== "Pipeline Skill")
            .flatMap((cat) => comps[cat].items.map((it) => ({ ...it, _cat: cat })))}
          onPick={(it) => {
            setActive(it._cat);
            setEditing({ cat: it._cat, id: it._id });
          }}
          onClose={() => setFindOpen(false)}
        />
      )}
    </Page>
  );
}

/* ============================== MONITOR · JOBS ============================== */
const ROUTINES0 = [
  { name: "Repo → Changelog", trigger: "Daily · 06:00", next: "in 4h 12m", on: true },
  { name: "Support Ticket Triage", trigger: "On event · ticket.created", next: "live", on: true },
];
const JOBS = [
  {
    id: "job_8f2a",
    pipe: "Textbook → Notion Quiz",
    status: "running",
    step: 3,
    total: 5,
    stepName: "Generate Vocab Quiz",
    agent: "Codex",
    dur: "14.6s",
    cost: "$0.14",
    tok: "31k",
    by: "user",
  },
  {
    id: "job_7d10",
    pipe: "Lead Research Brief",
    status: "running",
    step: 2,
    total: 4,
    stepName: "Research (3 parallel)",
    agent: "Claude Code ×3",
    dur: "1m02s",
    cost: "$0.62",
    tok: "180k",
    by: "user",
  },
  {
    id: "job_7c93",
    pipe: "Contract Risk Review",
    status: "waitingForUser",
    step: 3,
    total: 4,
    stepName: "Reviewer sign-off",
    agent: "—",
    dur: "paused",
    cost: "$0.21",
    tok: "64k",
    by: "user",
  },
  {
    id: "job_7b41",
    pipe: "Support Ticket Triage",
    status: "queued",
    step: 0,
    total: 3,
    stepName: "Queued",
    agent: "—",
    dur: "—",
    cost: "—",
    tok: "—",
    by: "routine",
  },
  {
    id: "job_6a08",
    pipe: "Repo → Changelog",
    status: "completed",
    step: 4,
    total: 4,
    stepName: "Exported changelog.md",
    agent: "Codex",
    dur: "21.7s",
    cost: "$0.08",
    tok: "22k",
    by: "routine",
  },
  {
    id: "job_69f7",
    pipe: "Textbook → Notion Quiz",
    status: "completed",
    step: 5,
    total: 5,
    stepName: "Exported 20 questions",
    agent: "Codex",
    dur: "41.3s",
    cost: "$0.31",
    tok: "88k",
    by: "user",
  },
  {
    id: "job_64b2",
    pipe: "Lead Research Brief",
    status: "failed",
    step: 2,
    total: 4,
    stepName: "Research source timeout",
    agent: "Claude Code",
    dur: "34.0s",
    cost: "$0.18",
    tok: "51k",
    by: "routine",
  },
];
function StepBar({ step, total, status }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const done = i < step,
          cur = i === step && status === "running";
        return (
          <span
            key={i}
            className={`h-1.5 w-5 rounded-full ${done ? "bg-foreground/70" : cur ? "bg-foreground/40 edge-flow" : "bg-surface-3"}`}
            style={cur ? { background: "var(--c-fg)", opacity: 0.4 } : {}}
          />
        );
      })}
    </div>
  );
}
function JobRow({ j, onOpen }) {
  const tone = j.status === "completed" ? "success" : j.status === "failed" ? "error" : "muted";
  const wash =
    j.status === "failed"
      ? "ring-destructive/25 bg-destructive/[0.03]"
      : j.status === "waitingForUser"
        ? "ring-border-strong bg-surface-2/40"
        : "ring-border";
  return (
    <button
      onClick={onOpen}
      className={`grid w-full grid-cols-[200px_1fr_120px_90px_120px_28px] items-center gap-3 rounded-xl bg-surface px-3.5 py-3 text-left ring-1 shadow-soft transition-all hover:shadow-float ${wash}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Dot tone={tone} ping={j.status === "running"} />
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold tracking-tightish">{j.pipe}</div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {j.id}
            {j.by === "routine" && " · routine"}
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-1.5">
          <StepBar step={j.step} total={j.total} status={j.status} />
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {j.step >= 0 && j.status !== "queued"
            ? `Step ${Math.min(j.step + (j.status === "completed" ? 0 : 1), j.total)}/${j.total} · `
            : ""}
          {j.stepName}
        </div>
      </div>
      <div className="truncate text-[11.5px] text-muted-foreground">{j.agent}</div>
      <div className="text-[11.5px] tabular-nums text-muted-foreground">{j.dur}</div>
      <div className="text-[11.5px] tabular-nums text-muted-foreground">
        {j.cost} · {j.tok}
      </div>
      <div className="flex justify-end">
        <StatusPill status={j.status} />
      </div>
    </button>
  );
}
function JobsPage({ onOpen, notify }) {
  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const [routines, setRoutines] = useState(ROUTINES0);
  const [detail, setDetail] = useState(null); // job row open in drawer
  const [sched, setSched] = useState(null); // routine open in schedule editor
  const ql = q.trim().toLowerCase();
  const map = {
    Running: "running",
    Waiting: "waitingForUser",
    Completed: "completed",
    Failed: "failed",
  };
  const filtered = JOBS.filter(
    (j) =>
      (tab === "All" || j.status === map[tab]) &&
      (!ql || j.pipe.toLowerCase().includes(ql) || j.id.includes(ql)),
  );
  const JobDetailDrawer = window.JobDetailDrawer,
    ScheduleEditor = window.ScheduleEditor;
  return (
    <Page>
      <PageHeader
        eyebrow="Monitor"
        title="Jobs"
        sub="Work orders — every pipeline run, concurrent and live. Launch on demand or on a Routine."
        actions={
          <>
            <Btn
              variant="ghost"
              icon="Clock"
              onClick={() => setSched({ name: "New routine", trigger: "Daily · 06:00" })}
            >
              Routines
            </Btn>
            <Btn variant="solid" icon="Play" onClick={onOpen}>
              New Run
            </Btn>
          </>
        }
      />
      <Body className="space-y-5 pt-1">
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Running" value="2" sub="job_8f2a · job_7d10" />
          <Stat label="Queued / Waiting" value="2" sub="1 awaiting you" />
          <Stat label="Completed today" value="24" sub="98% success" tone="success" />
          <Stat label="Failed today" value="1" sub="source timeout" tone="error" />
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            <Icon name="Clock" size={13} /> Routines
          </div>
          <div className="grid grid-cols-2 gap-3">
            {routines.map((r, idx) => (
              <div
                key={r.name}
                className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 ring-1 ring-border shadow-soft"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2">
                  <Icon name="CalendarClock" size={16} className="text-foreground/70" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold tracking-tightish">
                    {r.name}
                  </div>
                  <div className="truncate font-mono text-[10.5px] text-muted-foreground">
                    {r.trigger}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">next</div>
                  <div className="text-[11.5px] font-medium">{r.on ? r.next : "paused"}</div>
                </div>
                <button
                  onClick={() => setSched(r)}
                  title="Edit schedule"
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <Icon name="Pencil" size={13} />
                </button>
                <button
                  onClick={() => {
                    setRoutines((rs) => rs.map((x, i) => (i === idx ? { ...x, on: !x.on } : x)));
                    notify && notify(`${r.name} ${r.on ? "paused" : "resumed"}`);
                  }}
                  className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${r.on ? "bg-foreground" : "bg-surface-3"}`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-primary-foreground transition-transform ${r.on ? "translate-x-4" : ""}`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <ChipRow
              active={tab}
              onChange={setTab}
              items={[
                { label: "All", count: JOBS.length },
                { label: "Running", count: 2 },
                { label: "Waiting", count: 1 },
                { label: "Completed", count: 2 },
                { label: "Failed", count: 1 },
              ]}
            />
            <div className="w-56">
              <Search value={q} onChange={setQ} placeholder="Search jobs…" />
            </div>
          </div>
          {filtered.length ? (
            <div className="space-y-2">
              {filtered.map((j) => (
                <JobRow key={j.id} j={j} onOpen={() => setDetail(j)} />
              ))}
            </div>
          ) : (
            <Empty q={q} />
          )}
        </div>
      </Body>
      {detail && JobDetailDrawer && (
        <JobDetailDrawer
          job={detail}
          onOpenCanvas={() => {
            setDetail(null);
            onOpen && onOpen();
          }}
          onClose={() => setDetail(null)}
          notify={notify}
        />
      )}
      {sched && ScheduleEditor && (
        <ScheduleEditor
          pipe={{ name: sched.name, schedule: sched.trigger }}
          onSave={() => {}}
          onClose={() => setSched(null)}
          notify={notify}
        />
      )}
    </Page>
  );
}

/* ============================== MONITOR · USAGE ============================== */
const SPARK = [28, 34, 22, 41, 38, 52, 47, 61, 44, 58, 72, 66, 81, 74];
function UsagePage({ notify }) {
  const [range, setRange] = useState("This month");
  const [run, setRun] = useState(null);
  const max = Math.max(...SPARK);
  const UsageRunModal = window.UsageRunModal,
    JOB_DETAIL = window.JOB_DETAIL || {};
  const runs = Object.keys(JOB_DETAIL).map((id) => {
    const d = JOB_DETAIL[id];
    const tok = d.steps.reduce((n, s) => n + (s.tok || 0), 0);
    const cost = d.steps.reduce((n, s) => n + (s.cost || 0), 0);
    return { id, pipe: d.pipe, by: d.by, steps: d.steps, tok, cost };
  });
  return (
    <Page>
      <PageHeader
        eyebrow="Monitor"
        title="Usage"
        sub="Token & cost across this project — by run, by pipeline, by agent."
        actions={
          <Dropdown
            label={range}
            icon="Calendar"
            items={["Today", "This week", "This month", "This quarter", "All time"]}
            onPick={(v) => {
              setRange(v);
              notify && notify(`Showing ${v.toLowerCase()}`);
            }}
          />
        }
      />
      <Body className="space-y-5 pt-1">
        <div className="grid grid-cols-4 gap-3">
          <Stat label="Total tokens" value="4.18M" sub="↑ 12% vs last month" />
          <Stat label="Total cost" value="$62.40" sub="↑ 9% vs last month" />
          <Stat label="Runs" value="212" sub="across 9 pipelines" />
          <Stat label="Avg / run" value="$0.29" sub="↓ 4% — cheaper" tone="success" />
        </div>
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-border shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-[13px] font-semibold tracking-tightish">
              Cost · {range.toLowerCase()}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-foreground/80" /> spend
              </span>
              <span className="font-mono">peak $5.84</span>
            </div>
          </div>
          <div className="flex items-end gap-1.5" style={{ height: 130 }}>
            {SPARK.map((v, i) => (
              <div
                key={i}
                className="group flex flex-1 flex-col justify-end"
                title={`Day ${i + 1}: $${((v / max) * 5.84).toFixed(2)}`}
              >
                <div
                  className="w-full rounded-t-[4px] bg-foreground/15 transition-colors group-hover:bg-foreground/45"
                  style={{ height: Math.round((v / max) * 122) }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>May 26</span>
            <span>Jun 8</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-border shadow-soft">
            <div className="mb-2 text-[13px] font-semibold tracking-tightish">By pipeline</div>
            <BarRow label="Lead Research Brief" value="1.62M tok" sub="$24.1" pct={100} tone="fg" />
            <BarRow label="Contract Risk Review" value="0.94M tok" sub="$14.0" pct={62} />
            <BarRow label="Textbook → Quiz" value="0.71M tok" sub="$10.6" pct={47} />
            <BarRow label="Support Triage" value="0.58M tok" sub="$8.7" pct={38} />
            <BarRow label="Repo → Changelog" value="0.33M tok" sub="$5.0" pct={21} />
          </div>
          <div className="rounded-2xl bg-surface p-5 ring-1 ring-border shadow-soft">
            <div className="mb-2 text-[13px] font-semibold tracking-tightish">By Local Agent</div>
            <BarRow label="Claude Code" value="2.10M tok" sub="$31.2" pct={100} tone="fg" />
            <BarRow label="Codex" value="1.44M tok" sub="$21.5" pct={68} />
            <BarRow label="Hermes" value="0.64M tok" sub="$9.7" pct={31} />
            <div className="mt-4 rounded-xl bg-surface-2 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
              <Icon name="Info" size={12} className="mr-1 inline" /> Hermes runs locally — its
              tokens are <span className="text-foreground">free of API cost</span>, shown for
              capacity only.
            </div>
          </div>
        </div>
        <div className="rounded-2xl bg-surface p-5 ring-1 ring-border shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[13px] font-semibold tracking-tightish">By run</div>
            <div className="text-[11px] text-muted-foreground">
              drill into a single job → per-step token &amp; cost
            </div>
          </div>
          <div className="space-y-1">
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => setRun(r)}
                className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-accent/50"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
                  <Icon name="Workflow" size={14} className="text-foreground/70" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-medium">{r.pipe}</div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {r.id} · {r.by} · {r.steps.length} steps
                  </div>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {(r.tok / 1000).toFixed(1)}k
                </span>
                <span className="w-14 text-right font-mono text-[11px] font-medium tabular-nums">
                  ${r.cost.toFixed(2)}
                </span>
                <Icon
                  name="ChevronRight"
                  size={14}
                  className="text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"
                />
              </button>
            ))}
          </div>
        </div>
      </Body>
      {run && UsageRunModal && <UsageRunModal run={run} onClose={() => setRun(null)} />}
    </Page>
  );
}
/* ========================= CAPABILITIES · LOCAL AGENTS ========================= */
const AGENTS = [
  {
    name: "Claude Code",
    mono: "CC",
    status: "connected",
    ver: "v1.8.2",
    models: "Sonnet 4.6 · Opus 4.1",
    skills: 9,
    caps: ["File edit", "Shell", "Web"],
    last: "2s ago",
  },
  {
    name: "Codex",
    mono: "Cx",
    status: "connected",
    ver: "v0.41",
    models: "gpt-5.1-codex",
    skills: 6,
    caps: ["File edit", "Shell"],
    last: "14s ago",
  },
  {
    name: "Hermes",
    mono: "He",
    status: "connected",
    ver: "local",
    models: "hermes-4 · 70B (Ollama)",
    skills: 3,
    caps: ["Local", "No API cost"],
    last: "1m ago",
  },
  {
    name: "Cursor Agent",
    mono: "Ca",
    status: "error",
    ver: "—",
    models: "not detected",
    skills: 0,
    caps: ["Offline"],
    last: "—",
  },
];
function AgentsPage({ notify }) {
  const [scanning, setScanning] = useState(false);
  const [config, setConfig] = useState(null);
  const rescan = () => {
    setScanning(true);
    notify && notify("Re-scanning localhost…");
    window.setTimeout(() => {
      setScanning(false);
      notify && notify("Scan complete · 3 of 4 detected");
    }, 1400);
  };
  return (
    <Page>
      <PageHeader
        eyebrow="Capabilities"
        title="Local Agents"
        sub="Workers detected on this machine — who Agent Bar can assemble into an executor right now. Not a roster."
        actions={
          <Btn
            variant="ghost"
            icon="RefreshCw"
            onClick={rescan}
            className={scanning ? "opacity-60" : ""}
          >
            {scanning ? "Scanning…" : "Re-scan"}
          </Btn>
        }
      />
      <Body className="pt-1">
        <div className="grid grid-cols-2 gap-3">
          {AGENTS.map((a) => {
            const off = a.status === "error";
            return (
              <div
                key={a.name}
                className={`flex flex-col rounded-2xl bg-surface p-4 ring-1 shadow-soft ring-border ${off ? "opacity-75" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl text-[14px] font-bold ${off ? "bg-surface-2 text-muted-foreground" : "bg-foreground text-primary-foreground"}`}
                  >
                    {a.mono}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold tracking-tightish">{a.name}</span>
                      <span className="font-mono text-[10.5px] text-muted-foreground">{a.ver}</span>
                    </div>
                    <div className="truncate text-[11.5px] text-muted-foreground">{a.models}</div>
                  </div>
                  <StatusPill status={off ? "error" : "connected"} />
                </div>
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {a.caps.map((c) => (
                    <span
                      key={c}
                      className="whitespace-nowrap rounded-full bg-surface-2 px-2 py-0.5 text-[10.5px] text-muted-foreground"
                    >
                      {c}
                    </span>
                  ))}
                </div>
                <div className="mt-3.5 flex items-center gap-4 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Icon name="Sparkles" size={11} /> {a.skills} skills
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Icon name="Clock" size={11} /> {off ? "not running" : `used ${a.last}`}
                  </span>
                  {off ? (
                    <button
                      onClick={rescan}
                      className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-foreground hover:underline"
                    >
                      Detect <Icon name="RefreshCw" size={11} />
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfig(a)}
                      className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-foreground/80 hover:text-foreground"
                    >
                      Configure <Icon name="ChevronRight" size={12} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[11.5px] text-muted-foreground">
          <Icon name="Radar" size={14} /> Auto-detected 3 of 4 agents on{" "}
          <span className="font-mono">localhost</span>. Executors are assembled per-operation by the
          Agent Bar — there’s no executor to manage here.
        </div>
      </Body>
      {config && window.ConfigureAgentDrawer && (
        <window.ConfigureAgentDrawer
          agent={config}
          notify={notify}
          onClose={() => setConfig(null)}
        />
      )}
    </Page>
  );
}

/* ============================ CAPABILITIES · SKILLS ============================ */
const SKILLS = [
  {
    name: "parser.skill",
    src: "Claude Code",
    desc: "Parse PDF/EPUB into structured vocab, grammar & text blocks.",
    op: "Parse & Extract PDF",
    io: "files[] → struct",
    used: 7,
  },
  {
    name: "quiz-gen.skill",
    src: "Codex",
    desc: "Generate multiple-choice questions from a vocabulary list.",
    op: "Vocab Quiz Gen",
    io: "vocab → quiz[]",
    used: 3,
  },
  {
    name: "summarize.skill",
    src: "Codex",
    desc: "Faithful extractive + abstractive summary with length control.",
    op: "Summarize",
    io: "text → summary",
    used: 14,
  },
  {
    name: "ner.skill",
    src: "Hermes",
    desc: "Named-entity recognition tuned for contracts & resumes.",
    op: "Extract Entities",
    io: "text → entities[]",
    used: 8,
  },
  {
    name: "seo.skill",
    src: "Codex",
    desc: "Rewrite a draft for target keywords without losing voice.",
    op: "SEO Pass",
    io: "draft → optimized",
    used: 5,
  },
  {
    name: "critic.skill",
    src: "Claude Code",
    desc: "Adversarial reviewer — finds ambiguous or wrong answers.",
    op: "Adversarial Verify",
    io: "draft → report",
    used: 4,
  },
  {
    name: "diff-notes.skill",
    src: "Claude Code",
    desc: "Summarize a git diff into human changelog entries.",
    op: "Repo → Changelog",
    io: "diff → notes",
    used: 5,
  },
  {
    name: "classify.skill",
    src: "Hermes",
    desc: "Few-shot text classifier for routing & triage.",
    op: "Support Triage",
    io: "text → label",
    used: 12,
  },
];
function SkillsPage({ notify }) {
  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const [skills, setSkills] = useState(SKILLS);
  const [importOpen, setImportOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const delSkill = (s) => {
    setSkills((cur) => cur.filter((x) => x.name !== s.name));
    setConfirm(null);
    setDetail(null);
    notify && notify(`Deleted ${s.name}`);
  };
  const ql = q.trim().toLowerCase();
  const filtered = skills.filter(
    (s) =>
      (tab === "All" || s.src === tab) &&
      (!ql || s.name.toLowerCase().includes(ql) || s.desc.toLowerCase().includes(ql)),
  );
  const importSkills = (src, names) =>
    setSkills((cur) => [
      ...names
        .filter((n) => !cur.some((s) => s.name === n))
        .map((n) => ({
          name: n,
          src,
          desc: "Imported skill · ready to assemble onto an operation.",
          op: "Unassigned",
          io: "in → out",
          used: 0,
        })),
      ...cur,
    ]);
  return (
    <Page>
      <PageHeader
        eyebrow="Capabilities"
        title="Skills"
        sub="Worker skills imported from Codex & Claude Code. A skill is assembled onto an agent to run one Operation."
        actions={
          <Btn variant="solid" icon="Download" onClick={() => setImportOpen(true)}>
            Import Skill
          </Btn>
        }
      />
      <Toolbar>
        <ChipRow
          active={tab}
          onChange={setTab}
          items={[
            { label: "All", count: skills.length },
            { label: "Claude Code", count: skills.filter((s) => s.src === "Claude Code").length },
            { label: "Codex", count: skills.filter((s) => s.src === "Codex").length },
            { label: "Hermes", count: skills.filter((s) => s.src === "Hermes").length },
          ]}
        />
        <div className="ml-auto w-60">
          <Search value={q} onChange={setQ} placeholder="Search skills…" />
        </div>
      </Toolbar>
      <Body>
        {filtered.length ? (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((s) => (
              <div
                key={s.name}
                role="button"
                tabIndex={0}
                onClick={() => setDetail(s)}
                className="group relative flex cursor-pointer flex-col rounded-2xl bg-surface p-4 ring-1 ring-border shadow-soft transition-all hover:shadow-float hover:ring-border-strong"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
                    <Icon name="Sparkles" size={14} className="text-foreground/75" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[12.5px] font-semibold">{s.name}</div>
                    <div className="text-[10.5px] text-muted-foreground">imported from {s.src}</div>
                  </div>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-foreground/80 transition-opacity group-hover:opacity-0">
                    {s.src}
                  </span>
                  <div className="absolute right-3.5 top-3.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetail(s);
                      }}
                      title="Edit"
                      className="rounded-lg bg-surface p-1 text-muted-foreground ring-1 ring-border hover:bg-accent hover:text-foreground"
                    >
                      <Icon name="Pencil" size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirm(s);
                      }}
                      title="Delete"
                      className="rounded-lg bg-surface p-1 text-muted-foreground ring-1 ring-border hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Icon name="Trash2" size={13} />
                    </button>
                  </div>
                </div>
                <p className="mt-2.5 text-[12px] leading-relaxed text-muted-foreground">{s.desc}</p>
                <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
                  <Icon name="Cpu" size={12} /> powers{" "}
                  <span className="font-medium text-foreground/80">{s.op}</span>
                  <span className="ml-auto font-mono text-[10.5px]">{s.io}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty q={q} />
        )}
      </Body>
      {importOpen && window.ImportSkillWizard && (
        <window.ImportSkillWizard
          onImport={importSkills}
          onClose={() => setImportOpen(false)}
          notify={notify}
        />
      )}
      {detail && window.SkillDetailDrawer && (
        <window.SkillDetailDrawer
          skill={detail}
          notify={notify}
          onClose={() => setDetail(null)}
          onDelete={(s) => setConfirm(s)}
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={`Delete “${confirm.name}”?`}
          body={
            confirm.used > 0
              ? `This skill powers ${confirm.op} and is used in ${confirm.used} pipeline${confirm.used !== 1 ? "s" : ""}. Those keep their saved copy, but it won’t be importable from here anymore.`
              : "This skill isn’t assigned to any operation yet."
          }
          onConfirm={() => delSkill(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </Page>
  );
}

/* ========================== CAPABILITIES · CONNECTORS ========================== */
const CONNECTORS0 = [
  {
    name: "GitHub",
    mono: "GH",
    method: "MCP",
    status: "connected",
    scopes: "repo · read/write",
    sync: "live",
    need: false,
  },
  {
    name: "Notion",
    mono: "No",
    method: "MCP",
    status: "error",
    scopes: "needs token",
    sync: "—",
    need: true,
  },
  {
    name: "Feishu / Lark",
    mono: "Fs",
    method: "Built-in",
    status: "connected",
    scopes: "docs · im · bitable",
    sync: "2m ago",
    need: false,
  },
  {
    name: "Local Folder",
    mono: "Fd",
    method: "Built-in",
    status: "connected",
    scopes: "~/study · read/write",
    sync: "live",
    need: false,
  },
  {
    name: "Postgres",
    mono: "Pg",
    method: "Direct API",
    status: "connected",
    scopes: "study_db · read",
    sync: "30s ago",
    need: false,
  },
  {
    name: "Slack",
    mono: "Sl",
    method: "MCP",
    status: "error",
    scopes: "not authorized",
    sync: "—",
    need: true,
  },
];
function ConnectorsPage({ notify }) {
  const [tab, setTab] = useState("All");
  const [q, setQ] = useState("");
  const [conns, setConns] = useState(CONNECTORS0);
  const [addOpen, setAddOpen] = useState(false);
  const [manage, setManage] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const removeConn = (c) => {
    setConns((cs) => cs.filter((x) => x.name !== c.name));
    setConfirm(null);
    setManage(null);
    notify && notify(`Removed ${c.name}`);
  };
  const ql = q.trim().toLowerCase();
  const filtered = conns.filter(
    (c) =>
      (tab === "All" ||
        (tab === "Connected" && !c.need) ||
        (tab === "Needs setup" && c.need) ||
        (tab === "via MCP" && c.method === "MCP")) &&
      (!ql || c.name.toLowerCase().includes(ql)),
  );
  const connect = (name) => {
    setConns((cs) =>
      cs.map((c) =>
        c.name === name
          ? {
              ...c,
              need: false,
              status: "connected",
              scopes: c.scopes
                .replace("needs token", "connected")
                .replace("not authorized", "authorized"),
              sync: "just now",
            }
          : c,
      ),
    );
    notify && notify(`${name} connected`);
  };
  return (
    <Page>
      <PageHeader
        eyebrow="Capabilities"
        title="Connectors"
        sub="External tools & services Agent Bar can reach. MCP is one connection method, tucked inside — alongside built-ins and direct APIs."
        actions={
          <Btn variant="solid" icon="Plus" onClick={() => setAddOpen(true)}>
            Add Connector
          </Btn>
        }
      />
      <Toolbar>
        <ChipRow
          active={tab}
          onChange={setTab}
          items={[
            { label: "All", count: conns.length },
            { label: "Connected", count: conns.filter((c) => !c.need).length },
            { label: "Needs setup", count: conns.filter((c) => c.need).length },
            { label: "via MCP", count: conns.filter((c) => c.method === "MCP").length },
          ]}
        />
        <div className="ml-auto w-60">
          <Search value={q} onChange={setQ} placeholder="Search connectors…" />
        </div>
      </Toolbar>
      <Body>
        {filtered.length ? (
          <div className="grid grid-cols-3 gap-3">
            {filtered.map((c) => (
              <div
                key={c.name}
                role="button"
                tabIndex={0}
                onClick={() => setManage(c)}
                className={`group relative flex cursor-pointer flex-col rounded-2xl bg-surface p-4 ring-1 shadow-soft transition-all hover:shadow-float ${c.need ? "ring-destructive/25" : "ring-border hover:ring-border-strong"}`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-[13px] font-bold">
                    {c.mono}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-semibold tracking-tightish">
                      {c.name}
                    </div>
                    <div className="flex items-center gap-1 text-[10.5px] text-muted-foreground">
                      <span className="rounded bg-surface-2 px-1 py-0.5 font-medium whitespace-nowrap">
                        {c.method}
                      </span>
                    </div>
                  </div>
                  <Dot tone={c.need ? "error" : "success"} />
                  <div className="absolute right-3.5 top-3.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setManage(c);
                      }}
                      title="Edit"
                      className="rounded-lg bg-surface p-1 text-muted-foreground ring-1 ring-border hover:bg-accent hover:text-foreground"
                    >
                      <Icon name="Pencil" size={13} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirm(c);
                      }}
                      title="Delete"
                      className="rounded-lg bg-surface p-1 text-muted-foreground ring-1 ring-border hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Icon name="Trash2" size={13} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 truncate rounded-lg bg-surface-2 px-2 py-1.5 text-[11px] text-muted-foreground">
                  {c.scopes}
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
                  {c.need ? (
                    <>
                      <Icon name="TriangleAlert" size={12} className="text-destructive" /> needs
                      setup
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          connect(c.name);
                        }}
                        className="ml-auto rounded-lg bg-foreground px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:opacity-90"
                      >
                        Connect
                      </button>
                    </>
                  ) : (
                    <>
                      <Icon name="RefreshCw" size={11} /> synced {c.sync}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty q={q} />
        )}
      </Body>
      {addOpen && window.AddConnectorWizard && (
        <window.AddConnectorWizard
          notify={notify}
          onClose={() => setAddOpen(false)}
          onAdd={(c) => setConns((cs) => [c, ...cs])}
        />
      )}
      {manage && window.ManageConnectorDrawer && (
        <window.ManageConnectorDrawer
          conn={manage}
          notify={notify}
          onClose={() => setManage(null)}
          onDisconnect={(name) =>
            setConns((cs) =>
              cs.map((x) =>
                x.name === name
                  ? { ...x, need: true, status: "error", scopes: "disconnected", sync: "—" }
                  : x,
              ),
            )
          }
        />
      )}
      {confirm && (
        <ConfirmDialog
          title={`Delete “${confirm.name}”?`}
          body={`This removes the ${confirm.name} connector and revokes its access. Pipelines that rely on it will need a new connector to run.`}
          onConfirm={() => removeConn(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </Page>
  );
}

window.Pages = {
  pipelines: PipelinesPage,
  components: ComponentsPage,
  jobs: JobsPage,
  usage: UsagePage,
  agents: AgentsPage,
  skills: SkillsPage,
  connectors: ConnectorsPage,
};
window.ConfirmDialog = ConfirmDialog;
window.SEARCH = {
  pipes: PIPES,
  comps: COMPONENTS,
  skills: SKILLS,
  conns: CONNECTORS0,
  agents: AGENTS,
  jobs: JOBS,
};
