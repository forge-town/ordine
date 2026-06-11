/* ——— canvas.jsx · the interactive editor: pan/zoom, drag, select, drill-in,
       add nodes, connect handles, edit config, edge contracts, compose, annotate ——— */
const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;
const useState = useStateC,
  useEffect = useEffectC,
  useRef = useRefC;
const { Icon, StatusPill, Dot } = window;

/* ============================ pipeline graph data ============================ */
const NODE_W = 214;
const NODE_H = 92;

const ROOT_NODES = [
  {
    id: "n1",
    title: "Source · Textbook PDFs",
    kind: "Input Object",
    icon: "FolderOpen",
    exec: "Local folder",
    meta: "12 files · 38 MB",
    x: 40,
    y: 230,
    diff: "reuse",
    config: { source: "~/study/textbooks", format: "PDF · EPUB", out: "files[]" },
  },
  {
    id: "n2",
    title: "Parse & Extract",
    kind: "Operation",
    icon: "FileText",
    exec: "Claude Code · parser.skill",
    meta: "8.2s · 3.1k tok",
    x: 320,
    y: 120,
    diff: "reuse",
    out: "{ vocabulary, grammar_points, text_blocks }",
    config: {
      prompt:
        "Extract every vocabulary term, grammar point, and clean text block from each PDF. Return strict JSON: { vocabulary[], grammar_points[], text_blocks[] }.",
      agent: "Claude Code",
      via: "skill",
      skill: "parser.skill",
      checkpoint: false,
    },
    lastRun: { tokens: "3.1k", cost: "$0.04", dur: "8.2s", at: "in this run" },
  },
  {
    id: "n3",
    title: "Generate Vocab Quiz",
    kind: "Operation",
    icon: "Sparkles",
    exec: "Codex · quiz-gen.skill",
    meta: "20 questions",
    x: 320,
    y: 320,
    diff: "new",
    progress: "Drafting question 4 / 20…",
    config: {
      prompt:
        "From {vocabulary} and {grammar_points}, write 20 multiple-choice questions. 4 options each, one correct, 3 plausible distractors. Vary difficulty across the set.",
      agent: "Codex",
      via: "skill",
      skill: "quiz-gen.skill",
      checkpoint: true,
    },
    lastRun: { tokens: "12.4k", cost: "$0.09", dur: "this run", at: "moments ago" },
  },
  {
    id: "n4",
    title: "Adversarial Verify",
    kind: "Compound · Verify",
    icon: "ShieldCheck",
    exec: "Generator ↔ Critic",
    meta: "Loop ≤ 3 rounds",
    x: 600,
    y: 320,
    compound: true,
    diff: "new",
  },
  {
    id: "n5",
    title: "Export to Notion",
    kind: "Output",
    icon: "Boxes",
    exec: "Connector · notion-mcp",
    meta: "DB · Study Materials",
    x: 880,
    y: 230,
    diff: "modified",
    config: { dest: "Notion · Study Materials", connector: "notion-mcp", mode: "Append rows" },
  },
];
const ROOT_EDGES = [
  {
    id: "e1",
    from: "n1",
    to: "n2",
    label: "files[]",
    kind: "contract",
    contract: {
      fromNode: "Source",
      toNode: "Parse & Extract",
      fields: [{ name: "files[]", type: "File[]", to: "documents", on: true }],
    },
  },
  {
    id: "e2",
    from: "n2",
    to: "n3",
    label: "vocabulary, grammar",
    kind: "contract",
    contract: {
      fromNode: "Parse & Extract",
      toNode: "Generate Vocab Quiz",
      fields: [
        { name: "vocabulary", type: "Term[]", to: "source_terms", on: true },
        { name: "grammar_points", type: "string[]", to: "grammar", on: true },
        { name: "text_blocks", type: "Block[]", to: "—", on: false },
      ],
    },
  },
  {
    id: "e3",
    from: "n3",
    to: "n4",
    label: "draft_quiz",
    kind: "gate",
    contract: {
      fromNode: "Generate Vocab Quiz",
      toNode: "Adversarial Verify",
      fields: [{ name: "draft_quiz", type: "Question[]", to: "candidate", on: true }],
    },
  },
  {
    id: "e4",
    from: "n4",
    to: "n5",
    label: "verified_quiz",
    kind: "contract",
    contract: {
      fromNode: "Adversarial Verify",
      toNode: "Export to Notion",
      fields: [
        { name: "verified_quiz", type: "Question[]", to: "rows", on: true },
        { name: "verify_report", type: "Report", to: "—", on: false },
      ],
    },
  },
];

const VERIFY_NODES = [
  {
    id: "v0",
    title: "Input · draft_quiz",
    kind: "Port",
    icon: "LogIn",
    exec: "from upstream",
    x: 40,
    y: 230,
    port: true,
  },
  {
    id: "vg",
    title: "Generator",
    kind: "Operation",
    icon: "PenLine",
    exec: "Codex · quiz-gen.skill",
    meta: "writes / rewrites",
    x: 280,
    y: 120,
    config: {
      prompt:
        "Improve the candidate quiz using the critic's report. Fix ambiguous distractors and factual errors. Keep the question count.",
      agent: "Codex",
      via: "skill",
      skill: "quiz-gen.skill",
      checkpoint: false,
    },
  },
  {
    id: "vc",
    title: "Critic",
    kind: "Operation",
    icon: "ShieldAlert",
    exec: "Claude Code · critic.skill",
    meta: "independent context",
    x: 280,
    y: 330,
    config: {
      prompt:
        "Adversarially review each question. Flag ambiguous, wrong, or trivially-guessable items. Output { passed: bool, issues[] }.",
      agent: "Claude Code",
      via: "skill",
      skill: "critic.skill",
      checkpoint: false,
    },
  },
  {
    id: "vgate",
    title: "Pass gate",
    kind: "Quality Gate",
    icon: "GitFork",
    exec: "no issues → pass",
    meta: "else loop ≤ 3",
    x: 560,
    y: 225,
    gate: true,
  },
  {
    id: "vout",
    title: "Output · verified_quiz",
    kind: "Port",
    icon: "LogOut",
    exec: "to downstream",
    x: 820,
    y: 230,
    port: true,
  },
];
const VERIFY_EDGES = [
  { id: "ve0", from: "v0", to: "vg", label: "candidate", kind: "contract" },
  { id: "ve1", from: "vg", to: "vc", label: "draft", kind: "contract" },
  { id: "ve2", from: "vc", to: "vgate", label: "report", kind: "gate" },
  { id: "ve3", from: "vgate", to: "vg", label: "retry ≤ 3", kind: "loop" },
  { id: "ve4", from: "vgate", to: "vout", label: "passed", kind: "contract" },
];

/* ----- Council inner subgraph: moderator fans roles, they debate, converge ----- */
function councilSeed(cid) {
  return {
    nodes: [
      {
        id: cid + "_in",
        title: "Input · topic",
        kind: "Port",
        icon: "LogIn",
        exec: "from upstream",
        x: 40,
        y: 230,
        port: true,
      },
      {
        id: cid + "_mod",
        title: "Moderator",
        kind: "Operation",
        icon: "Gavel",
        exec: "Claude Code · council.skill",
        meta: "controls rounds",
        x: 270,
        y: 230,
        config: {
          prompt:
            "Moderate a structured debate. Assign roles, run rounds, surface disagreements, and drive toward convergence.",
          agent: "Claude Code",
          via: "skill",
          skill: "council.skill",
          checkpoint: false,
        },
      },
      {
        id: cid + "_r1",
        title: "Optimist",
        kind: "Operation",
        icon: "Smile",
        exec: "Codex · role.skill",
        meta: "argues upside",
        x: 540,
        y: 90,
        config: {
          prompt: "Argue the strongest case in favor. Cite evidence.",
          agent: "Codex",
          via: "skill",
          skill: "role.skill",
          checkpoint: false,
        },
      },
      {
        id: cid + "_r2",
        title: "Skeptic",
        kind: "Operation",
        icon: "ShieldAlert",
        exec: "Claude Code · role.skill",
        meta: "stress-tests",
        x: 540,
        y: 230,
        config: {
          prompt: "Challenge claims, surface risks and counter-evidence.",
          agent: "Claude Code",
          via: "skill",
          skill: "role.skill",
          checkpoint: false,
        },
      },
      {
        id: cid + "_r3",
        title: "Domain Expert",
        kind: "Operation",
        icon: "BookOpen",
        exec: "Hermes · role.skill",
        meta: "grounds in facts",
        x: 540,
        y: 370,
        config: {
          prompt: "Provide domain grounding and correct factual errors.",
          agent: "Hermes",
          via: "skill",
          skill: "role.skill",
          checkpoint: false,
        },
      },
      {
        id: cid + "_conv",
        title: "Converge",
        kind: "Quality Gate",
        icon: "GitMerge",
        exec: "agreement ≥ threshold",
        meta: "else another round",
        x: 820,
        y: 230,
        gate: true,
      },
      {
        id: cid + "_out",
        title: "Output · conclusion",
        kind: "Port",
        icon: "LogOut",
        exec: "to downstream",
        x: 1060,
        y: 230,
        port: true,
      },
    ],
    edges: [
      { id: cid + "_e0", from: cid + "_in", to: cid + "_mod", label: "topic", kind: "contract" },
      { id: cid + "_e1", from: cid + "_mod", to: cid + "_r1", label: "brief", kind: "contract" },
      { id: cid + "_e2", from: cid + "_mod", to: cid + "_r2", label: "brief", kind: "contract" },
      { id: cid + "_e3", from: cid + "_mod", to: cid + "_r3", label: "brief", kind: "contract" },
      { id: cid + "_e4", from: cid + "_r1", to: cid + "_conv", label: "stance", kind: "contract" },
      { id: cid + "_e5", from: cid + "_r2", to: cid + "_conv", label: "stance", kind: "contract" },
      { id: cid + "_e6", from: cid + "_r3", to: cid + "_conv", label: "stance", kind: "contract" },
      { id: cid + "_e7", from: cid + "_conv", to: cid + "_mod", label: "next round", kind: "loop" },
      {
        id: cid + "_e8",
        from: cid + "_conv",
        to: cid + "_out",
        label: "converged",
        kind: "contract",
      },
    ],
  };
}

/* ----- Delegation inner subgraph: split → isolated parallel workers → merge ----- */
function delegationSeed(cid) {
  return {
    nodes: [
      {
        id: cid + "_in",
        title: "Input · task",
        kind: "Port",
        icon: "LogIn",
        exec: "from upstream",
        x: 40,
        y: 230,
        port: true,
      },
      {
        id: cid + "_split",
        title: "Split",
        kind: "Operation",
        icon: "Split",
        exec: "Claude Code · planner.skill",
        meta: "fan out subtasks",
        x: 270,
        y: 230,
        config: {
          prompt: "Decompose the task into independent subtasks that can run in isolated contexts.",
          agent: "Claude Code",
          via: "skill",
          skill: "planner.skill",
          checkpoint: false,
        },
      },
      {
        id: cid + "_w1",
        title: "Worker A",
        kind: "Operation",
        icon: "Bot",
        exec: "Codex · isolated ctx",
        meta: "subtask 1",
        x: 540,
        y: 110,
        config: {
          prompt: "Complete the assigned subtask in an isolated context.",
          agent: "Codex",
          via: "skill",
          skill: "worker.skill",
          checkpoint: false,
        },
      },
      {
        id: cid + "_w2",
        title: "Worker B",
        kind: "Operation",
        icon: "Bot",
        exec: "Codex · isolated ctx",
        meta: "subtask 2",
        x: 540,
        y: 230,
        config: {
          prompt: "Complete the assigned subtask in an isolated context.",
          agent: "Codex",
          via: "skill",
          skill: "worker.skill",
          checkpoint: false,
        },
      },
      {
        id: cid + "_w3",
        title: "Worker C",
        kind: "Operation",
        icon: "Bot",
        exec: "Hermes · isolated ctx",
        meta: "subtask 3",
        x: 540,
        y: 350,
        config: {
          prompt: "Complete the assigned subtask in an isolated context.",
          agent: "Hermes",
          via: "skill",
          skill: "worker.skill",
          checkpoint: false,
        },
      },
      {
        id: cid + "_merge",
        title: "Merge",
        kind: "Operation",
        icon: "GitMerge",
        exec: "Claude Code · merge.skill",
        meta: "fold results",
        x: 820,
        y: 230,
        config: {
          prompt: "Merge worker outputs into one coherent result; resolve conflicts and dedupe.",
          agent: "Claude Code",
          via: "skill",
          skill: "merge.skill",
          checkpoint: false,
        },
      },
      {
        id: cid + "_out",
        title: "Output · merged",
        kind: "Port",
        icon: "LogOut",
        exec: "to downstream",
        x: 1060,
        y: 230,
        port: true,
      },
    ],
    edges: [
      { id: cid + "_e0", from: cid + "_in", to: cid + "_split", label: "task", kind: "contract" },
      {
        id: cid + "_e1",
        from: cid + "_split",
        to: cid + "_w1",
        label: "subtask",
        kind: "contract",
      },
      {
        id: cid + "_e2",
        from: cid + "_split",
        to: cid + "_w2",
        label: "subtask",
        kind: "contract",
      },
      {
        id: cid + "_e3",
        from: cid + "_split",
        to: cid + "_w3",
        label: "subtask",
        kind: "contract",
      },
      { id: cid + "_e4", from: cid + "_w1", to: cid + "_merge", label: "result", kind: "contract" },
      { id: cid + "_e5", from: cid + "_w2", to: cid + "_merge", label: "result", kind: "contract" },
      { id: cid + "_e6", from: cid + "_w3", to: cid + "_merge", label: "result", kind: "contract" },
      {
        id: cid + "_e7",
        from: cid + "_merge",
        to: cid + "_out",
        label: "merged",
        kind: "contract",
      },
    ],
  };
}

/* ----- component catalog: palette → new node templates ----- */
const CATALOG = {
  Folder: {
    kind: "Input Object",
    icon: "FolderOpen",
    exec: "Local folder",
    meta: "choose a directory",
    config: { source: "~/", format: "any files", out: "files[]" },
  },
  File: {
    kind: "Input Object",
    icon: "File",
    exec: "Single file",
    meta: "pick a file",
    config: { source: "~/file", format: "any", out: "file" },
  },
  "GitHub Project": {
    kind: "Input Object",
    icon: "Github",
    exec: "via github-mcp",
    meta: "owner/repo",
    config: { source: "github.com/…", format: "repo", out: "repo" },
  },
  Prompt: {
    kind: "Input Object",
    icon: "MessageSquare",
    exec: "Inline instruction",
    meta: "free text",
    config: { source: "(inline text)", format: "text", out: "text" },
  },
  "Parse PDF": {
    kind: "Operation",
    icon: "FileText",
    exec: "Claude Code · parser.skill",
    meta: "new operation",
    config: {
      prompt: "Describe what to extract from each document…",
      agent: "Claude Code",
      via: "skill",
      skill: "parser.skill",
      checkpoint: false,
    },
  },
  Summarize: {
    kind: "Operation",
    icon: "AlignLeft",
    exec: "Codex · summarize.skill",
    meta: "new operation",
    config: {
      prompt: "Summarize the input faithfully, keeping key facts…",
      agent: "Codex",
      via: "skill",
      skill: "summarize.skill",
      checkpoint: false,
    },
  },
  "Vocab Quiz Gen": {
    kind: "Operation",
    icon: "Sparkles",
    exec: "Codex · quiz-gen.skill",
    meta: "new operation",
    config: {
      prompt: "Generate multiple-choice questions from the vocabulary…",
      agent: "Codex",
      via: "skill",
      skill: "quiz-gen.skill",
      checkpoint: false,
    },
  },
  Verify: {
    compound: true,
    kind: "Compound · Verify",
    icon: "ShieldCheck",
    exec: "Generator ↔ Critic",
    meta: "empty — open to build",
  },
  Council: {
    compound: true,
    kind: "Compound · Council",
    icon: "Users",
    exec: "N agents debate",
    meta: "empty — open to build",
  },
  Delegation: {
    compound: true,
    kind: "Compound · Delegation",
    icon: "Split",
    exec: "split → parallel → merge",
    meta: "empty — open to build",
  },
  "Local Path": {
    kind: "Output",
    icon: "HardDrive",
    exec: "Write to disk",
    meta: "destination path",
    config: { dest: "~/out", connector: "local-fs", mode: "Write file" },
  },
  "Notion DB": {
    kind: "Output",
    icon: "Boxes",
    exec: "Connector · notion-mcp",
    meta: "Notion database",
    config: { dest: "Notion · Database", connector: "notion-mcp", mode: "Append rows" },
  },
};
const PALETTE = [
  { g: "Input Objects", items: ["Folder", "File", "GitHub Project", "Prompt"] },
  { g: "Operations", items: ["Parse PDF", "Summarize", "Vocab Quiz Gen"] },
  { g: "Compound", items: ["Verify", "Council", "Delegation"] },
  { g: "Output", items: ["Local Path", "Notion DB"] },
];
const AGENTS_LIST = ["Claude Code", "Codex", "Hermes"];
const MCP_LIST = ["notion-mcp", "github-mcp", "slack-mcp", "filesystem-mcp", "postgres-mcp"];

/* ============================== walkthrough ============================== */
const PHASES = ["empty", "clarify", "proposal", "applied", "running", "done"];
const PHASE_LABEL = {
  empty: "Empty canvas",
  clarify: "Clarify",
  proposal: "Proposal",
  applied: "Applied",
  running: "Running",
  done: "Done",
};

function nodeStatus(phase, id, isRoot) {
  if (!isRoot) return null;
  if (phase === "empty" || phase === "clarify" || phase === "reversing") return null;
  if (phase === "proposal") return "preview";
  if (phase === "applied") return "idle";
  if (phase === "done") return "done";
  return "idle";
}
function edgeState(phase, e, isRoot, statusOf) {
  if (!isRoot) return "idle";
  if (phase === "proposal") return "pending";
  if (phase === "applied") return "idle";
  if (phase === "done") return "done";
  if (phase === "running") {
    const a = statusOf(e.from),
      b = statusOf(e.to);
    if (a === "done" && b === "done") return "done";
    if (
      a === "done" &&
      (b === "running" || b === "retrying" || b === "waitingForUser" || b === "queued")
    )
      return "flow";
    if (a === "cancelled" || a === "failed" || b === "skipped" || b === "cancelled")
      return "pending";
    return "pending";
  }
  return "idle";
}

/* executor label derived from live config (agent · skill|mcp) */
function execLabel(n) {
  const c = n.config;
  if (c && n.kind.startsWith("Operation")) {
    const tool = c.via === "mcp" ? c.mcp || "mcp" : c.skill || "skill";
    return `${c.agent || "Agent"} · ${tool}`;
  }
  return n.exec;
}

/* traffic-light status light, top-right of a node — green/red/yellow + neutral */
function NodeStatusDot({ status }) {
  const C = {
    done: { c: "var(--c-success)", label: "Ran successfully" },
    completed: { c: "var(--c-success)", label: "Completed" },
    pass: { c: "var(--c-success)", label: "Passed" },
    running: { c: "var(--c-fg)", label: "Running…", pulse: true },
    retrying: { c: "var(--c-warning)", label: "Retrying…", pulse: true },
    review: { c: "var(--c-warning)", label: "Checkpoint · needs your review", pulse: true },
    waitingForUser: { c: "var(--c-warning)", label: "Checkpoint · waiting for you", pulse: true },
    failed: { c: "var(--c-destructive)", label: "Can’t run — needs attention" },
    error: { c: "var(--c-destructive)", label: "Error" },
    skipped: { c: "var(--c-muted-fg)", label: "Skipped", soft: true },
    cancelled: { c: "var(--c-muted-fg)", label: "Cancelled", soft: true },
  };
  const hit = C[status];
  if (!hit) {
    return (
      <span
        title={status === "queued" ? "Queued" : "Idle"}
        className="absolute top-2 right-2 z-10 h-[9px] w-[9px] rounded-full bg-surface"
        style={{
          boxShadow: "inset 0 0 0 1.5px color-mix(in oklab, var(--c-muted-fg) 55%, transparent)",
        }}
      >
        {status === "queued" ? (
          <span
            className="absolute inset-0 rounded-full ping"
            style={{ background: "var(--c-muted-fg)", opacity: 0.3 }}
          />
        ) : null}
      </span>
    );
  }
  return (
    <span title={hit.label} className="absolute top-2 right-2 z-10 inline-flex h-[9px] w-[9px]">
      {hit.pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full ping"
          style={{ background: hit.c, opacity: 0.5 }}
        />
      )}
      <span
        className="relative inline-flex h-[9px] w-[9px] rounded-full"
        style={{
          background: hit.soft ? `color-mix(in oklab, ${hit.c} 55%, transparent)` : hit.c,
          boxShadow: `0 0 0 2px var(--c-surface), 0 1px 2px color-mix(in oklab, ${hit.c} 50%, transparent)`,
        }}
      />
    </span>
  );
}

/* ================================ node card =============================== */
function GNode({
  n,
  status,
  selected,
  count,
  highlight,
  dragging,
  linking,
  onPointerDown,
  onClick,
  onDoubleClick,
  onAction,
  onBadge,
  onHandleDown,
  onHandleUp,
}) {
  const preview = status === "preview";
  const running = status === "running";
  const retrying = status === "retrying";
  const isCompound = n.compound;
  const isPort = n.port;
  const isGate = n.gate;
  return (
    <div
      onPointerDown={(e) => onPointerDown(e, n.id)}
      onPointerUp={(e) => onHandleUp(e, n.id)}
      onClick={(e) => onClick(e, n.id)}
      onDoubleClick={(e) => onDoubleClick(e, n.id)}
      style={{ left: n.x, top: n.y, width: NODE_W, cursor: dragging ? "grabbing" : "grab" }}
      className={`group absolute select-none rounded-xl transition-shadow
        ${isPort ? "bg-surface-2/70" : "bg-surface"} shadow-soft
        ${
          preview
            ? "opacity-80 ring-1 ring-dashed ring-border-strong"
            : selected
              ? "ring-2 ring-foreground/40 shadow-float"
              : "ring-1 ring-border hover:ring-border-strong hover:shadow-float"
        }
        ${running || retrying ? "node-running" : ""} ${isCompound ? "bg-surface-2/50" : ""} ${dragging ? "shadow-float" : ""}
        ${linking ? "ring-2 ring-foreground/50" : ""}`}
    >
      {!isPort && !preview && status && <NodeStatusDot status={status} />}
      {highlight && (
        <span className="pointer-events-none absolute -inset-1 z-10 rounded-2xl ring-2 ring-foreground/60" />
      )}
      {count > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBadge(n.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          title="Open this node’s thread"
          className="absolute -left-2 -top-2 z-10 flex h-5 items-center gap-0.5 rounded-full bg-foreground px-1.5 text-[9.5px] font-semibold text-primary-foreground shadow-pill"
        >
          <Icon name="MessageSquare" size={9} /> {count}
        </button>
      )}

      {!isPort && (
        <div className="absolute -top-3 right-1.5 z-10 hidden items-center gap-0.5 rounded-full bg-surface px-1 py-0.5 shadow-pill ring-1 ring-border group-hover:flex">
          <button
            title={isCompound ? "Open inside" : "Configure"}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAction("config", n.id);
            }}
            className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
          >
            <Icon name={isCompound ? "Maximize2" : "Settings2"} size={12} />
          </button>
          <button
            title="Ask the Agent about this node"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAction("ask", n.id);
            }}
            className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
          >
            <Icon name="Sparkles" size={12} />
          </button>
          <button
            title="Duplicate"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAction("duplicate", n.id);
            }}
            className="rounded-full p-1 text-foreground/70 hover:bg-accent/70"
          >
            <Icon name="Copy" size={12} />
          </button>
          <button
            title="Delete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onAction("delete", n.id);
            }}
            className="rounded-full p-1 text-foreground/70 hover:bg-destructive/10 hover:text-destructive"
          >
            <Icon name="Trash2" size={12} />
          </button>
        </div>
      )}

      <div
        className={`flex items-center gap-2 px-2.5 py-2 ${isPort ? "" : "border-b border-border/70"}`}
      >
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-md ${isCompound ? "bg-foreground text-primary-foreground" : isGate ? "bg-surface ring-1 ring-border-strong" : "bg-surface-2"}`}
        >
          <Icon name={n.icon} size={13} className={isCompound ? "" : "text-foreground/80"} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-semibold leading-tight tracking-tightish">
            {n.title}
          </div>
          <div className="truncate text-[10px] text-muted-foreground">{n.kind}</div>
        </div>
        {preview
          ? (() => {
              const D = {
                new: { l: "new", c: "var(--c-success)" },
                modified: { l: "edited", c: "var(--c-warning)" },
                reuse: { l: "reused", c: "var(--c-muted-fg)" },
              }[n.diff || "new"];
              return (
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-medium"
                  style={{
                    background: `color-mix(in oklab, ${D.c} 16%, transparent)`,
                    color: `color-mix(in oklab, ${D.c} 80%, var(--c-fg))`,
                  }}
                >
                  {D.l}
                </span>
              );
            })()
          : null}
      </div>

      {!isPort && (
        <div className="space-y-1.5 px-2.5 py-2">
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/55" />
            <span className="truncate">{execLabel(n)}</span>
          </div>
          {running || retrying ? (
            <div className="space-y-1.5 pt-0.5">
              <div className="overflow-hidden rounded-full bg-surface-2" style={{ height: 4 }}>
                <div
                  className="rounded-full edge-flow"
                  style={{
                    width: retrying ? "40%" : "22%",
                    height: 4,
                    background: retrying ? "var(--c-warning)" : "var(--c-fg)",
                  }}
                />
              </div>
              <div className="truncate text-[10px] text-foreground/70">
                {retrying ? "Retrying · re-chunking input…" : n.progress || "Working…"}
              </div>
            </div>
          ) : status === "waitingForUser" || status === "review" ? (
            <div
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px]"
              style={{
                background: "color-mix(in oklab, var(--c-warning) 15%, transparent)",
                color: "color-mix(in oklab, var(--c-warning) 72%, var(--c-fg))",
              }}
            >
              <Icon name="Flag" size={10} /> Checkpoint · review to continue
            </div>
          ) : status === "queued" ? (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Icon name="Clock" size={10} /> Queued…
            </div>
          ) : status === "skipped" ? (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Icon name="SkipForward" size={10} /> Skipped · upstream stopped
            </div>
          ) : status === "cancelled" ? (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Icon name="Ban" size={10} /> Cancelled by you
            </div>
          ) : status === "failed" ? (
            <div className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] status-wash-error">
              <Icon name="TriangleAlert" size={10} /> Connector not authorized
            </div>
          ) : status === "done" && n.out ? (
            <div className="truncate rounded-md bg-surface-2 px-1.5 py-1 font-mono text-[9.5px] text-muted-foreground">
              {n.out}
            </div>
          ) : (
            <div className="truncate text-[10px] text-muted-foreground/80">{n.meta}</div>
          )}
          {isCompound && (
            <div className="flex items-center gap-1 pt-0.5 text-[9.5px] text-foreground/60">
              <Icon name="Layers" size={10} /> double-click to open inside
            </div>
          )}
        </div>
      )}

      {/* IO handles — drag to connect */}
      <span
        title="Drag to connect from input"
        onPointerDown={(e) => onHandleDown(e, n.id, "in")}
        className="io-handle absolute -left-1.5 top-[22px] h-3 w-3 cursor-crosshair rounded-full border border-border-strong bg-surface transition-transform hover:scale-150 hover:border-foreground"
      />
      <span
        title="Drag to connect to next node"
        onPointerDown={(e) => onHandleDown(e, n.id, "out")}
        className="io-handle absolute -right-1.5 top-[22px] h-3 w-3 cursor-crosshair rounded-full border border-border-strong bg-surface transition-transform hover:scale-150 hover:border-foreground"
      />
    </div>
  );
}

/* ================================ edges svg =============================== */
function edgePath(A, B, loop) {
  const a = { x: A.x + NODE_W, y: A.y + 22 },
    b = { x: B.x, y: B.y + 22 };
  if (loop) {
    const midY = Math.min(a.y, b.y) - 70;
    return `M ${A.x + NODE_W / 2} ${A.y} C ${A.x + NODE_W / 2} ${midY}, ${B.x + NODE_W / 2} ${midY}, ${B.x + NODE_W / 2} ${B.y}`;
  }
  const dx = Math.max(50, Math.abs(b.x - a.x) * 0.5);
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
}
function EdgesLayer({ graph, phase, isRoot, selEdge, onEdgeClick, link, statusOf }) {
  const byId = (id) => graph.nodes.find((n) => n.id === id);
  return (
    <svg
      className="absolute overflow-visible"
      style={{ left: 0, top: 0, width: 1, height: 1, zIndex: 1, pointerEvents: "none" }}
    >
      <defs>
        <marker
          id="arrc"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="oklch(0.18 0 0 / 0.55)" />
        </marker>
      </defs>
      {graph.edges.map((e) => {
        const A = byId(e.from),
          B = byId(e.to);
        if (!A || !B) return null;
        const loop = e.kind === "loop";
        const a = { x: A.x + NODE_W, y: A.y + 22 },
          b = { x: B.x, y: B.y + 22 };
        const d = edgePath(A, B, loop);
        const st = edgeState(phase, e, isRoot, statusOf || (() => "idle"));
        const sel = selEdge === e.id;
        const mid = loop
          ? { x: (A.x + B.x) / 2 + NODE_W / 2, y: Math.min(a.y, b.y) - 70 }
          : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 2 };
        return (
          <g
            key={e.id}
            className="edge"
            style={{ pointerEvents: "auto", cursor: "pointer" }}
            onClick={(ev) => {
              ev.stopPropagation();
              onEdgeClick(e.id);
            }}
          >
            <path d={d} stroke="transparent" strokeWidth="16" fill="none" />
            <path
              d={d}
              markerEnd="url(#arrc)"
              strokeDasharray={loop ? "4 4" : undefined}
              className={`edge-path ${st === "done" || st === "flow" ? "is-active" : ""} ${st === "pending" ? "is-pending" : ""} ${st === "flow" ? "edge-flow" : ""} ${sel ? "is-active" : ""}`}
              style={sel ? { stroke: "var(--c-fg)", strokeWidth: 2 } : undefined}
            />
            <foreignObject x={mid.x - 90} y={mid.y - 13} width="180" height="26">
              <div className="flex justify-center">
                <div
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9.5px] shadow-soft ring-1 transition-all
                  ${sel ? "bg-foreground text-primary-foreground ring-foreground" : `bg-surface ${e.kind === "gate" || e.kind === "loop" ? "ring-foreground/15" : "ring-border"}`}
                  ${st === "pending" ? "opacity-60" : ""}`}
                >
                  <Icon
                    name={
                      e.kind === "gate"
                        ? "ShieldCheck"
                        : e.kind === "loop"
                          ? "RotateCcw"
                          : "ArrowRightLeft"
                    }
                    size={10}
                    className={sel ? "" : "text-foreground/60"}
                  />
                  <span className={`font-mono ${sel ? "" : "text-foreground/80"}`}>{e.label}</span>
                </div>
              </div>
            </foreignObject>
          </g>
        );
      })}
      {/* live link-drag preview */}
      {link &&
        (() => {
          const A = byId(link.fromId);
          if (!A) return null;
          const sx = link.fromSide === "out" ? A.x + NODE_W : A.x,
            sy = A.y + 22;
          const dx = Math.max(40, Math.abs(link.x - sx) * 0.5) * (link.fromSide === "out" ? 1 : -1);
          const d = `M ${sx} ${sy} C ${sx + dx} ${sy}, ${link.x - dx} ${link.y}, ${link.x} ${link.y}`;
          return (
            <path
              d={d}
              className="edge-path is-active"
              strokeDasharray="5 4"
              style={{ stroke: "var(--c-fg)", strokeWidth: 2 }}
              markerEnd="url(#arrc)"
            />
          );
        })()}
    </svg>
  );
}

/* =============================== empty state ============================== */
function CanvasEmpty({ onSeed }) {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="-mt-10 flex flex-col items-center text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface shadow-float ring-1 ring-border">
          <Icon name="Workflow" size={20} className="text-foreground/70" />
        </div>
        <div className="mt-4 text-[14px] font-semibold tracking-tightish">Empty canvas</div>
        <p className="mt-1 max-w-[270px] text-[12px] leading-relaxed text-muted-foreground">
          Describe a goal in the Agent Bar, open{" "}
          <span className="font-medium text-foreground">Components</span> to drop a node, or seed
          the sample pipeline.
        </p>
        <button
          onClick={onSeed}
          className="pointer-events-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11.5px] font-medium text-primary-foreground hover:opacity-90"
        >
          <Icon name="Wand2" size={12} /> Seed sample pipeline
        </button>
      </div>
    </div>
  );
}

/* ============================ node config sheet =========================== */
function Field({ label, children, hint }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </div>
        {hint && <div className="text-[9.5px] text-muted-foreground/70">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
function NodeConfig({ node, onClose, onConfig, onTitle, onReset, dirty, banner }) {
  const c = node.config || {};
  const isOp = node.kind.startsWith("Operation");
  const isInput = node.kind.includes("Input");
  const isOutput = node.kind.includes("Output");
  const inputCls =
    "w-full rounded-xl bg-surface-2 px-2.5 py-2 text-[11.5px] ring-1 ring-border focus:outline-none focus:ring-border-strong";
  return (
    <div
      className="absolute inset-0 z-40 grid place-items-center p-6"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="absolute inset-0 node-config-bg" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="node-config-card relative flex max-h-full w-[440px] flex-col overflow-hidden rounded-2xl bg-surface shadow-win ring-1 ring-border-strong"
      >
        <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
            <Icon name={node.icon} size={15} className="text-foreground/80" />
          </div>
          <div className="min-w-0 flex-1">
            <input
              value={node.title}
              onChange={(e) => onTitle(node.id, e.target.value)}
              className="w-full truncate rounded-md bg-transparent px-1 -mx-1 text-[14px] font-semibold tracking-tightish hover:bg-surface-2 focus:bg-surface-2 focus:outline-none focus:ring-1 focus:ring-border-strong"
            />
            <div className="px-1 text-[10.5px] text-muted-foreground">{node.kind} · editable</div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
          >
            <Icon name="X" size={15} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {banner}
          {isOp && (
            <>
              <Field label="Prompt / Instruction" hint={`${(c.prompt || "").length} chars`}>
                <textarea
                  rows={4}
                  value={c.prompt || ""}
                  onChange={(e) => onConfig({ prompt: e.target.value })}
                  className={`${inputCls} resize-none leading-relaxed`}
                />
              </Field>
              <Field label="Executor" hint="agent + skill or MCP">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-2.5 py-2 ring-1 ring-border">
                    <Icon name="Cpu" size={13} className="shrink-0 text-muted-foreground" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Agent
                    </span>
                    <select
                      value={c.agent}
                      onChange={(e) => onConfig({ agent: e.target.value })}
                      className="ml-auto bg-transparent text-right text-[11.5px] focus:outline-none"
                    >
                      {AGENTS_LIST.map((a) => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-xl bg-surface-2 p-2 ring-1 ring-border">
                    <div className="mb-1.5 flex items-center gap-1 rounded-lg bg-surface p-0.5 ring-1 ring-border">
                      {[
                        ["skill", "Skill", "Sparkles"],
                        ["mcp", "MCP", "Plug"],
                      ].map(([v, l, ic]) => {
                        const on = (c.via || "skill") === v;
                        return (
                          <button
                            key={v}
                            onClick={() => onConfig({ via: v })}
                            className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium transition-colors ${on ? "bg-foreground text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                          >
                            <Icon name={ic} size={11} /> {l}
                          </button>
                        );
                      })}
                    </div>
                    {(c.via || "skill") === "mcp" ? (
                      <div className="flex items-center gap-1.5 px-1.5 py-1">
                        <Icon name="Plug" size={12} className="shrink-0 text-muted-foreground" />
                        <input
                          value={c.mcp || ""}
                          onChange={(e) => onConfig({ mcp: e.target.value })}
                          placeholder="notion-mcp"
                          list="mcp-list"
                          className="w-full bg-transparent font-mono text-[11px] focus:outline-none"
                        />
                        <datalist id="mcp-list">
                          {MCP_LIST.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 px-1.5 py-1">
                        <Icon
                          name="Sparkles"
                          size={12}
                          className="shrink-0 text-muted-foreground"
                        />
                        <input
                          value={c.skill || ""}
                          onChange={(e) => onConfig({ skill: e.target.value })}
                          placeholder="some.skill"
                          className="w-full bg-transparent font-mono text-[11px] focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </Field>
              <Field label="Status · last run">
                {node.lastRun ? (
                  <div className="rounded-xl bg-surface-2 p-2.5 ring-1 ring-border">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="font-mono text-[15px] font-semibold tabular-nums">
                          {node.lastRun.tokens}
                        </div>
                        <div className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                          tokens
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[15px] font-semibold tabular-nums">
                          {node.lastRun.cost}
                        </div>
                        <div className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                          cost
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[15px] font-semibold tabular-nums">
                          {node.lastRun.dur}
                        </div>
                        <div className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                          duration
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 border-t border-border/70 pt-1.5 text-center text-[10px] text-muted-foreground">
                      last ran {node.lastRun.at}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-2.5 py-2 text-[11px] text-muted-foreground ring-1 ring-border">
                    <Icon name="Gauge" size={12} /> No runs yet — token usage shows here after a
                    run.
                  </div>
                )}
              </Field>
              <Field label="Checkpoint">
                <button
                  onClick={() => onConfig({ checkpoint: !c.checkpoint })}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-surface-2 px-2.5 py-2 text-left ring-1 ring-border"
                >
                  <span
                    className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${c.checkpoint ? "bg-foreground" : "bg-surface-3"}`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-surface transition-transform ${c.checkpoint ? "translate-x-4" : ""}`}
                    />
                  </span>
                  <span className="flex-1 text-[11.5px]">
                    <span className="font-medium">Pause for review</span>
                    <span className="text-muted-foreground"> after this step finishes</span>
                  </span>
                  <Icon name="Flag" size={13} className="text-muted-foreground" />
                </button>
              </Field>
            </>
          )}
          {isInput && (
            <>
              <Field label="Source">
                <input
                  value={c.source || ""}
                  onChange={(e) => onConfig({ source: e.target.value })}
                  className={`${inputCls} font-mono`}
                />
              </Field>
              <Field label="Accepted formats">
                <input
                  value={c.format || ""}
                  onChange={(e) => onConfig({ format: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Output port">
                <div className="inline-block rounded-lg bg-surface-2 px-2 py-1 font-mono text-[11px] ring-1 ring-border">
                  {c.out}
                </div>
              </Field>
            </>
          )}
          {isOutput && (
            <>
              <Field label="Destination">
                <input
                  value={c.dest || ""}
                  onChange={(e) => onConfig({ dest: e.target.value })}
                  className={inputCls}
                />
              </Field>
              <Field label="Connector">
                <div className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-2 py-1.5 ring-1 ring-border">
                  <Icon name="Plug" size={12} className="text-muted-foreground" />
                  <input
                    value={c.connector || ""}
                    onChange={(e) => onConfig({ connector: e.target.value })}
                    className="w-full bg-transparent font-mono text-[11px] focus:outline-none"
                  />
                </div>
              </Field>
              <Field label="Write mode">
                <input
                  value={c.mode || ""}
                  onChange={(e) => onConfig({ mode: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </>
          )}
          {!isOp && !isInput && !isOutput && (
            <div className="rounded-xl bg-surface-2 p-3 text-[11.5px] text-muted-foreground ring-1 ring-border">
              This node type has no editable parameters. Drill in to edit its internals.
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-foreground py-2 text-[12.5px] font-medium text-primary-foreground hover:opacity-90"
          >
            Done
          </button>
          <button
            onClick={onReset}
            disabled={!dirty}
            className={`rounded-xl px-3 py-2 text-[12.5px] ring-1 ring-border ${dirty ? "bg-surface hover:bg-accent/60" : "bg-surface opacity-40"}`}
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================== edge contract panel ========================== */
function EdgeInspector({ edge, onClose, onToggleField, onDelete }) {
  const ct = edge.contract;
  return (
    <div className="edge-inspector-card absolute bottom-20 left-1/2 z-30 w-[420px] -translate-x-1/2 overflow-hidden rounded-2xl bg-surface shadow-win ring-1 ring-border-strong">
      <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-2">
          <Icon name="ArrowRightLeft" size={13} className="text-foreground/80" />
        </div>
        <div className="flex-1">
          <div className="text-[12.5px] font-semibold tracking-tightish">Data Contract</div>
          <div className="text-[10px] text-muted-foreground">
            {ct ? ct.fromNode : edge.from} <span className="px-1 text-foreground/40">→</span>{" "}
            {ct ? ct.toNode : edge.to}
          </div>
        </div>
        <button
          onClick={onDelete}
          title="Delete edge"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <Icon name="Unlink" size={14} />
        </button>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
        >
          <Icon name="X" size={14} />
        </button>
      </div>
      <div className="px-3.5 py-3">
        {ct ? (
          <>
            <div className="mb-2 grid grid-cols-[1fr_auto_1fr] gap-2 px-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <span>Source field</span>
              <span>Flow</span>
              <span>Target input</span>
            </div>
            <div className="space-y-1.5">
              {ct.fields.map((f) => (
                <button
                  key={f.name}
                  onClick={() => onToggleField(f.name)}
                  className={`grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-xl px-2.5 py-2 text-left ring-1 transition-all ${f.on ? "bg-surface-2 ring-border hover:ring-border-strong" : "bg-surface ring-border/60 opacity-55 hover:opacity-80"}`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[11px] font-medium">{f.name}</div>
                    <div className="truncate text-[9.5px] text-muted-foreground">{f.type}</div>
                  </div>
                  <span
                    className={`flex h-4 w-7 items-center rounded-full p-0.5 transition-colors ${f.on ? "bg-foreground" : "bg-surface-3"}`}
                  >
                    <span
                      className={`h-3 w-3 rounded-full bg-surface transition-transform ${f.on ? "translate-x-3" : ""}`}
                    />
                  </span>
                  <div className={`truncate font-mono text-[11px] ${f.on ? "" : "line-through"}`}>
                    {f.on ? f.to : "dropped"}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
              <Icon name="Info" size={11} /> Tap a field to toggle whether it flows downstream ·{" "}
              {ct.fields.filter((f) => f.on).length}/{ct.fields.length} on
            </div>
          </>
        ) : (
          <div className="rounded-xl bg-surface-2 p-3 text-[11.5px] text-muted-foreground ring-1 ring-border">
            New connection · fields are inferred at run time.
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================ ask-the-agent popover ========================= */
function AskComposer({ x, y, onSubmit, onClose }) {
  const [val, setVal] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    ref.current && ref.current.focus();
  }, []);
  const send = () => {
    if (val.trim()) onSubmit(val.trim());
  };
  return (
    <div
      className="node-config-card absolute z-40 w-[244px] rounded-2xl bg-surface p-2.5 shadow-win ring-1 ring-border-strong"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded bg-foreground text-primary-foreground">
          <Icon name="Sparkles" size={9} />
        </span>{" "}
        Ask the Agent
      </div>
      <textarea
        ref={ref}
        rows={3}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Tell the Agent what to change here…"
        className="w-full resize-none rounded-lg bg-surface-2 p-2 text-[11.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border-strong"
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          onClick={send}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-foreground py-1.5 text-[11.5px] font-medium text-primary-foreground hover:opacity-90"
        >
          <Icon name="ArrowUp" size={11} /> Send to Agent
        </button>
        <button
          onClick={onClose}
          className="rounded-lg px-2.5 py-1.5 text-[11.5px] text-muted-foreground hover:bg-accent/60"
        >
          Cancel
        </button>
      </div>
      <div className="mt-1.5 px-0.5 text-[9.5px] leading-snug text-muted-foreground">
        Adds a node-anchored message to the Agent Bar thread.
      </div>
    </div>
  );
}

/* ============================== the canvas =============================== */
function InteractiveCanvas({
  phase,
  setPhase,
  agentOpen,
  setAgentOpen,
  compOpen,
  setCompOpen,
  onSelRefs,
  anchorCounts = {},
  hoverRef,
  spotlight,
  onAsk,
  onOpenThread,
  onAskSelection,
  notify,
  pipe,
  onRename,
}) {
  const wrapRef = useRef(null);
  const fresh = !!(pipe && pipe.fresh);
  const [graphs, setGraphs] = useState(() =>
    fresh
      ? { root: { nodes: [], edges: [] } }
      : {
          root: { nodes: ROOT_NODES, edges: ROOT_EDGES },
          n4: { nodes: VERIFY_NODES, edges: VERIFY_EDGES },
        },
  );
  const [drill, setDrill] = useState([]);
  const [view, setView] = useState({ x: 30, y: 30, scale: 0.78 });
  const [tool, setTool] = useState("select");
  const [sel, setSel] = useState([]);
  const [selEdge, setSelEdge] = useState(null);
  const [configId, setConfigId] = useState(null);
  const [composer, setComposer] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [pendingFocus, setPendingFocus] = useState(null);
  const [box, setBox] = useState(null);
  const [link, setLink] = useState(null);
  const [toast, setToast] = useState(null);
  const [dragName, setDragName] = useState(null);
  const [run, setRun] = useState({
    active: false,
    statuses: {},
    log: [],
    checkpoint: null,
    terminal: false,
  });
  const [consoleOpen, setConsoleOpen] = useState(false);
  const [version, setVersion] = useState(3);
  const [dirty, setDirty] = useState(false);
  const drag = useRef(null);
  const cfgSnapshot = useRef(null);
  const runTimers = useRef({ clock: null, acc: 0, last: 0, paused: false });
  const runSteps = useRef([]);
  const runIdx = useRef(0);
  const clipboard = useRef(null);
  const histRef = useRef({ past: [], future: [] });
  const graphsRef = useRef(null);
  const drillRef = useRef([]);
  const resumeCp = useRef(null);

  const activeKey = drill.length ? drill[drill.length - 1] : "root";
  const isRoot = activeKey === "root";
  const graph = graphs[activeKey] || { nodes: [], edges: [] };
  const hasInner = (id) => !!graphs[id];
  const showGraph = phase !== "empty" && phase !== "clarify";

  const refIdOf = (id) => (drill.length ? drill.join("/") + "/" + id : id);
  const buildNodeRef = (n) => ({
    id: refIdOf(n.id),
    type: "node",
    baseId: n.id,
    label: drill.length
      ? drill.map((d) => d.replace(/_.*/, "")).join("/") + " / " + n.title
      : n.title,
    kind: n.kind,
    path: drill.slice(),
  });
  useEffect(() => {
    if (!onSelRefs) return;
    const out = [];
    sel.forEach((id) => {
      const n = graph.nodes.find((x) => x.id === id);
      if (n && !n.port) out.push(buildNodeRef(n));
    });
    if (selEdge) {
      const e = graph.edges.find((x) => x.id === selEdge);
      if (e)
        out.push({
          id: refIdOf(e.id),
          type: "edge",
          baseId: e.id,
          label: e.label,
          kind: e.kind || "contract",
          path: drill.slice(),
        });
    }
    onSelRefs(out);
  }, [sel, selEdge, activeKey]);

  /* ---------- focus / fit a node or edge when a chip or badge is clicked ---------- */
  useEffect(() => {
    if (!spotlight || !spotlight.ref) return;
    const r = spotlight.ref;
    setDrill(r.path && r.path.length ? r.path.slice() : []);
    setPendingFocus(r);
  }, [spotlight && spotlight.nonce]);
  useEffect(() => {
    if (!pendingFocus || !wrapRef.current) return;
    const g = graphs[activeKey] || { nodes: [], edges: [] };
    const base = pendingFocus.baseId || pendingFocus.id.split("/").pop();
    let cx, cy;
    if (pendingFocus.type === "edge") {
      const e = g.edges.find((x) => x.id === base);
      if (!e) {
        setPendingFocus(null);
        return;
      }
      const A = g.nodes.find((n) => n.id === e.from),
        B = g.nodes.find((n) => n.id === e.to);
      if (!A || !B) {
        setPendingFocus(null);
        return;
      }
      cx = (A.x + B.x) / 2 + NODE_W / 2;
      cy = (A.y + B.y) / 2 + NODE_H / 2;
      setSelEdge(e.id);
      setSel([]);
    } else {
      const n = g.nodes.find((x) => x.id === base);
      if (!n) {
        setPendingFocus(null);
        return;
      }
      cx = n.x + NODE_W / 2;
      cy = n.y + NODE_H / 2;
      if (!n.port) setSel([n.id]);
      setSelEdge(null);
    }
    const rect = wrapRef.current.getBoundingClientRect();
    const scale = 0.92;
    setView({ scale, x: rect.width / 2 - cx * scale, y: rect.height / 2 - cy * scale });
    setPendingFocus(null);
  }, [pendingFocus, activeKey]);

  const flash = (msg) => {
    setToast(msg);
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 2600);
  };
  const toWorld = (clientX, clientY) => {
    const r = wrapRef.current.getBoundingClientRect();
    return {
      x: (clientX - r.left - view.x) / view.scale,
      y: (clientY - r.top - view.y) / view.scale,
    };
  };
  const toScreen = (wx, wy) => ({ x: wx * view.scale + view.x, y: wy * view.scale + view.y });
  const updateActive = (fn) =>
    setGraphs((g) => ({ ...g, [activeKey]: fn(g[activeKey] || { nodes: [], edges: [] }) }));
  const nodeAt = (wx, wy, exclude) =>
    graph.nodes.find(
      (n) => n.id !== exclude && wx >= n.x && wx <= n.x + NODE_W && wy >= n.y && wy <= n.y + NODE_H,
    );

  /* ---------- history (undo / redo) ---------- */
  useEffect(() => {
    graphsRef.current = graphs;
  }, [graphs]);
  useEffect(() => {
    drillRef.current = drill;
  }, [drill]);
  const snapshot = () => {
    histRef.current.past.push({ graphs: graphsRef.current, drill: drillRef.current });
    if (histRef.current.past.length > 60) histRef.current.past.shift();
    histRef.current.future = [];
    setDirty(true);
  };
  const undo = () => {
    const h = histRef.current;
    if (!h.past.length) {
      flash("Nothing to undo");
      return;
    }
    h.future.push({ graphs: graphsRef.current, drill: drillRef.current });
    const prev = h.past.pop();
    setGraphs(prev.graphs);
    setDrill(prev.drill);
    setSel([]);
    setSelEdge(null);
    setConfigId(null);
    flash("Undo");
  };
  const redo = () => {
    const h = histRef.current;
    if (!h.future.length) {
      flash("Nothing to redo");
      return;
    }
    h.past.push({ graphs: graphsRef.current, drill: drillRef.current });
    const next = h.future.pop();
    setGraphs(next.graphs);
    setDrill(next.drill);
    setSel([]);
    setSelEdge(null);
    flash("Redo");
  };

  /* ---------- clipboard (copy / paste nodes) ---------- */
  const copySel = () => {
    const picked = graph.nodes.filter((n) => sel.includes(n.id) && !n.port);
    if (!picked.length) return;
    const ids = picked.map((n) => n.id);
    const innerEdges = graph.edges.filter((e) => ids.includes(e.from) && ids.includes(e.to));
    clipboard.current = {
      nodes: JSON.parse(JSON.stringify(picked)),
      edges: JSON.parse(JSON.stringify(innerEdges)),
    };
    flash(`Copied ${picked.length} node${picked.length > 1 ? "s" : ""}`);
  };
  const pasteClip = () => {
    const clip = clipboard.current;
    if (!clip || !clip.nodes.length) return;
    snapshot();
    const idMap = {};
    const stamp = Date.now();
    const newNodes = clip.nodes.map((n, i) => {
      const nid = "pst" + stamp + i;
      idMap[n.id] = nid;
      return { ...n, id: nid, x: n.x + 32, y: n.y + 32 };
    });
    const newEdges = clip.edges.map((e, i) => ({
      ...e,
      id: "pe" + stamp + i,
      from: idMap[e.from],
      to: idMap[e.to],
    }));
    updateActive((g) => ({ nodes: [...g.nodes, ...newNodes], edges: [...g.edges, ...newEdges] }));
    setSel(newNodes.map((n) => n.id));
    setSelEdge(null);
    flash(`Pasted ${newNodes.length} node${newNodes.length > 1 ? "s" : ""}`);
  };

  /* ---------- live run engine: single-interval virtual clock (robust vs. timer throttling) ---------- */
  const stopClock = () => {
    if (runTimers.current.clock) {
      clearInterval(runTimers.current.clock);
      runTimers.current.clock = null;
    }
  };
  const setNodeRun = (id, st) => setRun((r) => ({ ...r, statuses: { ...r.statuses, [id]: st } }));
  const pushLog = (id, line, p) =>
    setRun((r) => ({
      ...r,
      log: [...r.log, { node: id, name: p ? p.name : "", type: line[0], text: line[1] }],
    }));
  const tick = () => {
    const c = runTimers.current;
    if (!c.clock || c.paused) {
      c.last = performance.now();
      return;
    }
    const now = performance.now();
    let delta = now - c.last;
    c.last = now;
    if (delta > 1500) delta = 1500; // clamp after a suspend so it doesn't fast-forward
    c.acc += delta;
    let guard = 0;
    while (
      runIdx.current < runSteps.current.length &&
      c.acc >= runSteps.current[runIdx.current].delay &&
      guard < 40
    ) {
      guard++;
      const step = runSteps.current[runIdx.current];
      c.acc -= step.delay;
      runIdx.current++;
      const res = step.fn();
      if (res === "pause") {
        c.paused = true;
        break;
      }
      if (res === "stop") {
        stopClock();
        return;
      }
    }
    if (runIdx.current >= runSteps.current.length) stopClock();
  };
  const buildRunSteps = () => {
    const plan = window.RUN_PLAN;
    const steps = [];
    plan.forEach((p) => {
      steps.push({ delay: 280, fn: () => setNodeRun(p.id, "queued") });
      steps.push({
        delay: 440,
        fn: () => {
          setNodeRun(p.id, "running");
          pushLog(p.id, p.lines[0], p);
        },
      });
      p.lines.slice(1).forEach((ln) =>
        steps.push({
          delay: ln[0] === "warn" ? 680 : 520,
          fn: () => {
            if (ln[0] === "retry") setNodeRun(p.id, "retrying");
            else if (ln[0] !== "err") setNodeRun(p.id, "running");
            pushLog(p.id, ln, p);
          },
        }),
      );
      if (p.checkpoint) {
        steps.push({
          delay: 480,
          fn: () => {
            setNodeRun(p.id, "waitingForUser");
            setRun((r) => ({ ...r, checkpoint: p.id }));
            return "pause";
          },
        });
        (p.after || []).forEach((ln) =>
          steps.push({
            delay: 520,
            fn: () => {
              setNodeRun(p.id, "running");
              pushLog(p.id, ln, p);
            },
          }),
        );
        steps.push({
          delay: 620,
          fn: () => {
            setNodeRun(p.id, "done");
            pushLog(p.id, ["done", `${p.dur} · ${p.tok} tok`], p);
          },
        });
      } else if (p.fail) {
        steps.push({
          delay: 420,
          fn: () => {
            setNodeRun(p.id, "failed");
            setRun((r) => ({ ...r, terminal: true, active: false }));
            return "stop";
          },
        });
      } else {
        steps.push({
          delay: 600,
          fn: () => {
            setNodeRun(p.id, "done");
            pushLog(p.id, ["done", `${p.dur} · ${p.tok} tok`], p);
          },
        });
      }
    });
    return steps;
  };
  const startRun = () => {
    stopClock();
    setRun({
      active: true,
      statuses: { n1: "idle", n2: "idle", n3: "idle", n4: "idle", n5: "idle" },
      log: [],
      checkpoint: null,
      terminal: false,
    });
    setConsoleOpen(true);
    setPhase("running");
    setDrill([]);
    setSel([]);
    setSelEdge(null);
    runSteps.current = buildRunSteps();
    runIdx.current = 0;
    runTimers.current = { clock: null, acc: -300, last: performance.now(), paused: false };
    runTimers.current.clock = setInterval(tick, 90);
  };
  const resetRun = () => {
    stopClock();
    setRun({ active: false, statuses: {}, log: [], checkpoint: null, terminal: false });
    setConsoleOpen(false);
  };
  const approveCheckpoint = () => {
    setRun((r) => ({ ...r, checkpoint: null }));
    flash("Checkpoint approved — continuing");
    runTimers.current.acc = 0;
    runTimers.current.last = performance.now();
    runTimers.current.paused = false;
  };
  const cancelRun = () => {
    stopClock();
    setRun((r) => {
      const order = window.RUN_PLAN.map((p) => p.id);
      const st = { ...r.statuses };
      let hit = false;
      order.forEach((id) => {
        const s = st[id];
        if (s === "done" || s === "failed") return;
        if (
          !hit &&
          (s === "running" || s === "retrying" || s === "queued" || s === "waitingForUser")
        ) {
          st[id] = "cancelled";
          hit = true;
        } else st[id] = "skipped";
      });
      return {
        ...r,
        statuses: st,
        active: false,
        checkpoint: null,
        terminal: true,
        log: [
          ...r.log,
          {
            node: "_",
            name: "",
            type: "err",
            text: "run cancelled by user — downstream steps skipped",
          },
        ],
      };
    });
    flash("Run cancelled");
  };
  useEffect(() => stopClock, []);
  const statusOf = (id) =>
    phase === "running" && (run.active || run.terminal)
      ? run.statuses[id] || "idle"
      : nodeStatus(phase, id, isRoot);
  const closeConfig = () => {
    setConfigId(null);
    if (resumeCp.current) {
      const cp = resumeCp.current;
      resumeCp.current = null;
      setRun((r) => ({ ...r, checkpoint: cp }));
    }
  };
  const editCheckpointStep = () => {
    resumeCp.current = run.checkpoint;
    setRun((r) => ({ ...r, checkpoint: null }));
    openConfig(run.checkpoint);
  };

  /* ---------- add node from palette ---------- */
  const addNode = (name, worldPt) => {
    const t = CATALOG[name];
    if (!t) return;
    snapshot();
    const id = "nd" + Date.now() + Math.floor(Math.random() * 99);
    const cfg = t.config ? JSON.parse(JSON.stringify(t.config)) : undefined;
    const node = {
      id,
      title: name,
      x: Math.round(worldPt.x - NODE_W / 2),
      y: Math.round(worldPt.y - 28),
      kind: t.kind,
      icon: t.icon,
      exec: t.exec,
      meta: t.meta,
      compound: t.compound,
      config: cfg,
    };
    updateActive((g) => ({ ...g, nodes: [...g.nodes, node] }));
    if (t.compound) {
      const seed =
        name === "Council"
          ? councilSeed(id)
          : name === "Delegation"
            ? delegationSeed(id)
            : name === "Verify"
              ? {
                  nodes: [
                    {
                      id: id + "_in",
                      title: "Input · candidate",
                      kind: "Port",
                      icon: "LogIn",
                      exec: "from upstream",
                      x: 40,
                      y: 230,
                      port: true,
                    },
                    {
                      id: id + "_gen",
                      title: "Generator",
                      kind: "Operation",
                      icon: "PenLine",
                      exec: "Codex · gen.skill",
                      meta: "writes / rewrites",
                      x: 280,
                      y: 120,
                      config: {
                        prompt: "Improve the candidate using the critic's report.",
                        agent: "Codex",
                        via: "skill",
                        skill: "gen.skill",
                        checkpoint: false,
                      },
                    },
                    {
                      id: id + "_crit",
                      title: "Critic",
                      kind: "Operation",
                      icon: "ShieldAlert",
                      exec: "Claude Code · critic.skill",
                      meta: "independent context",
                      x: 280,
                      y: 330,
                      config: {
                        prompt:
                          "Adversarially review and flag issues. Output { passed, issues[] }.",
                        agent: "Claude Code",
                        via: "skill",
                        skill: "critic.skill",
                        checkpoint: false,
                      },
                    },
                    {
                      id: id + "_gate",
                      title: "Pass gate",
                      kind: "Quality Gate",
                      icon: "GitFork",
                      exec: "no issues → pass",
                      meta: "else loop ≤ 3",
                      x: 560,
                      y: 225,
                      gate: true,
                    },
                    {
                      id: id + "_out",
                      title: "Output · verified",
                      kind: "Port",
                      icon: "LogOut",
                      exec: "to downstream",
                      x: 820,
                      y: 230,
                      port: true,
                    },
                  ],
                  edges: [
                    {
                      id: id + "_e0",
                      from: id + "_in",
                      to: id + "_gen",
                      label: "candidate",
                      kind: "contract",
                    },
                    {
                      id: id + "_e1",
                      from: id + "_gen",
                      to: id + "_crit",
                      label: "draft",
                      kind: "contract",
                    },
                    {
                      id: id + "_e2",
                      from: id + "_crit",
                      to: id + "_gate",
                      label: "report",
                      kind: "gate",
                    },
                    {
                      id: id + "_e3",
                      from: id + "_gate",
                      to: id + "_gen",
                      label: "retry ≤ 3",
                      kind: "loop",
                    },
                    {
                      id: id + "_e4",
                      from: id + "_gate",
                      to: id + "_out",
                      label: "passed",
                      kind: "contract",
                    },
                  ],
                }
              : {
                  nodes: [
                    {
                      id: id + "_in",
                      title: "Input",
                      kind: "Port",
                      icon: "LogIn",
                      exec: "from upstream",
                      x: 60,
                      y: 220,
                      port: true,
                    },
                    {
                      id: id + "_out",
                      title: "Output",
                      kind: "Port",
                      icon: "LogOut",
                      exec: "to downstream",
                      x: 640,
                      y: 220,
                      port: true,
                    },
                  ],
                  edges: [],
                };
      setGraphs((g) => ({ ...g, [id]: seed }));
    }
    setSel([id]);
    setSelEdge(null);
    flash(`Added “${name}” — drag its handles to connect`);
  };
  const addNodeAtCenter = (name) => {
    const r = wrapRef.current.getBoundingClientRect();
    addNode(
      name,
      toWorld(
        r.left + r.width / 2 + (Math.random() * 40 - 20),
        r.top + r.height / 2 + (Math.random() * 40 - 20),
      ),
    );
  };

  /* ---------- add edge ---------- */
  const addEdge = (from, to) => {
    if (from === to) return;
    if (graph.edges.some((e) => e.from === from && e.to === to)) {
      flash("Those nodes are already connected");
      return;
    }
    const A = graph.nodes.find((n) => n.id === from),
      B = graph.nodes.find((n) => n.id === to);
    if (!A || !B) return;
    snapshot();
    const id = "ed" + Date.now();
    const edge = {
      id,
      from,
      to,
      label: "data",
      kind: "contract",
      contract: {
        fromNode: A.title,
        toNode: B.title,
        fields: [{ name: "output", type: "any", to: "input", on: true }],
      },
    };
    updateActive((g) => ({ ...g, edges: [...g.edges, edge] }));
    setSelEdge(id);
    setSel([]);
    flash(`Connected ${A.title} → ${B.title}`);
  };

  /* ---------- pointer: node drag ---------- */
  const onNodePointerDown = (e, id) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const multi = sel.length > 1 && sel.includes(id);
    drag.current = {
      mode: "node",
      id,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      ids: multi ? sel.slice() : [id],
      orig: Object.fromEntries(
        (multi ? sel : [id]).map((nid) => {
          const n = graph.nodes.find((x) => x.id === nid);
          return [nid, { x: n.x, y: n.y }];
        }),
      ),
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /* ---------- pointer: handle → link drag ---------- */
  const onHandleDown = (e, id, side) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const w = toWorld(e.clientX, e.clientY);
    drag.current = {
      mode: "link",
      fromId: id,
      fromSide: side,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
    setLink({ fromId: id, fromSide: side, x: w.x, y: w.y });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };
  const onHandleUp = (e, id) => {
    const d = drag.current;
    if (d && d.mode === "link" && d.fromId !== id) {
      const a = d.fromSide === "out" ? d.fromId : id;
      const b = d.fromSide === "out" ? id : d.fromId;
      addEdge(a, b);
      d.consumed = true;
    }
  };

  /* ---------- pointer: background (pan or box-select) ---------- */
  const onBgPointerDown = (e) => {
    if (e.button === 1 || tool === "hand" || e.button === 2) {
      drag.current = { mode: "pan", startX: e.clientX, startY: e.clientY, ox: view.x, oy: view.y };
    } else {
      const w = toWorld(e.clientX, e.clientY);
      drag.current = { mode: "box", startX: e.clientX, startY: e.clientY, wx0: w.x, wy0: w.y };
    }
    setSelEdge(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX,
      dy = e.clientY - d.startY;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (d.mode === "node") {
      if (d.moved && !d.snapped) {
        snapshot();
        d.snapped = true;
      }
      updateActive((g) => ({
        ...g,
        nodes: g.nodes.map((n) =>
          d.ids.includes(n.id)
            ? { ...n, x: d.orig[n.id].x + dx / view.scale, y: d.orig[n.id].y + dy / view.scale }
            : n,
        ),
      }));
    } else if (d.mode === "pan") {
      setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
    } else if (d.mode === "box") {
      const r = wrapRef.current.getBoundingClientRect();
      setBox({
        x0: d.startX - r.left,
        y0: d.startY - r.top,
        x1: e.clientX - r.left,
        y1: e.clientY - r.top,
      });
    } else if (d.mode === "link") {
      const w = toWorld(e.clientX, e.clientY);
      setLink((l) => (l ? { ...l, x: w.x, y: w.y } : l));
    }
  };
  const onUp = (e) => {
    const d = drag.current;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (d && d.mode === "box") {
      if (d.moved) {
        const w1 = toWorld(e.clientX, e.clientY);
        const x0 = Math.min(d.wx0, w1.x),
          x1 = Math.max(d.wx0, w1.x),
          y0 = Math.min(d.wy0, w1.y),
          y1 = Math.max(d.wy0, w1.y);
        const hit = graph.nodes
          .filter((n) => {
            const cx = n.x + NODE_W / 2,
              cy = n.y + NODE_H / 2;
            return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1 && !n.port;
          })
          .map((n) => n.id);
        setSel(hit);
      } else setSel([]);
      setBox(null);
    } else if (d && d.mode === "link") {
      if (!d.consumed) {
        const w = toWorld(e.clientX, e.clientY);
        const target = nodeAt(w.x, w.y, d.fromId);
        if (target) {
          const a = d.fromSide === "out" ? d.fromId : target.id;
          const b = d.fromSide === "out" ? target.id : d.fromId;
          addEdge(a, b);
        }
      }
      setLink(null);
    }
    drag.current = null;
  };

  /* ---------- wheel ---------- */
  const onWheel = (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const r = wrapRef.current.getBoundingClientRect();
      const cx = e.clientX - r.left,
        cy = e.clientY - r.top;
      setView((v) => {
        const ns = Math.min(1.6, Math.max(0.35, v.scale * (1 - e.deltaY * 0.0016)));
        const wx = (cx - v.x) / v.scale,
          wy = (cy - v.y) / v.scale;
        return { scale: ns, x: cx - wx * ns, y: cy - wy * ns };
      });
    } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
  };
  const zoomBy = (f) =>
    setView((v) => {
      const r = wrapRef.current.getBoundingClientRect();
      const cx = r.width / 2,
        cy = r.height / 2;
      const ns = Math.min(1.6, Math.max(0.35, v.scale * f));
      const wx = (cx - v.x) / v.scale,
        wy = (cy - v.y) / v.scale;
      return { scale: ns, x: cx - wx * ns, y: cy - wy * ns };
    });

  /* ---------- drag-drop from palette ---------- */
  const onCanvasDrop = (e) => {
    e.preventDefault();
    const name = e.dataTransfer.getData("text/node");
    if (name && CATALOG[name]) addNode(name, toWorld(e.clientX, e.clientY));
    setDragName(null);
  };

  /* ---------- click / double-click ---------- */
  const onNodeClick = (e, id) => {
    e.stopPropagation();
    if (drag.current && drag.current.moved) return;
    const node = graph.nodes.find((n) => n.id === id);
    if (node.port) return;
    setSelEdge(null);
    if (e.shiftKey) setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    else setSel([id]);
  };
  const openConfig = (id) => {
    const node = graph.nodes.find((n) => n.id === id);
    snapshot();
    cfgSnapshot.current = {
      id,
      title: node.title,
      config: JSON.parse(JSON.stringify(node.config || {})),
    };
    setConfigId(id);
  };
  const onNodeDouble = (e, id) => {
    e.stopPropagation();
    const node = graph.nodes.find((n) => n.id === id);
    if (node.port) return;
    if (node.compound && hasInner(id)) {
      setDrill((d) => [...d, id]);
      setSel([]);
      setSelEdge(null);
    } else openConfig(id);
  };
  const onEdgeClick = (id) => {
    setSelEdge(id);
    setSel([]);
  };

  /* ---------- node config edits ---------- */
  const patchConfig = (id, cfgPatch) =>
    updateActive((g) => ({
      ...g,
      nodes: g.nodes.map((n) => (n.id === id ? { ...n, config: { ...n.config, ...cfgPatch } } : n)),
    }));
  const patchTitle = (id, title) =>
    updateActive((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === id ? { ...n, title } : n)) }));
  const resetConfig = () => {
    const s = cfgSnapshot.current;
    if (!s) return;
    updateActive((g) => ({
      ...g,
      nodes: g.nodes.map((n) =>
        n.id === s.id ? { ...n, title: s.title, config: JSON.parse(JSON.stringify(s.config)) } : n,
      ),
    }));
    flash("Reset to last-saved values");
  };

  /* ---------- edge contract / delete ---------- */
  const toggleField = (edgeId, fieldName) =>
    updateActive((g) => ({
      ...g,
      edges: g.edges.map((e) =>
        e.id === edgeId
          ? {
              ...e,
              contract: {
                ...e.contract,
                fields: e.contract.fields.map((f) =>
                  f.name === fieldName ? { ...f, on: !f.on } : f,
                ),
              },
            }
          : e,
      ),
    }));
  const deleteEdge = (edgeId) => {
    snapshot();
    updateActive((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== edgeId) }));
    setSelEdge(null);
    flash("Connection removed");
  };

  /* ---------- node hover actions ---------- */
  const onNodeAction = (action, id) => {
    const node = graph.nodes.find((n) => n.id === id);
    const s = toScreen(node.x + NODE_W - 10, node.y + 6);
    if (action === "config") {
      if (node.compound && hasInner(id)) {
        setDrill((d) => [...d, id]);
        setSel([]);
      } else openConfig(id);
    } else if (action === "ask") {
      setComposer({
        nodeId: id,
        x: Math.min(s.x, (wrapRef.current.clientWidth || 600) - 254),
        y: s.y + 14,
      });
    } else if (action === "duplicate") {
      snapshot();
      const id2 = "nd" + Date.now() + Math.floor(Math.random() * 99);
      const copy = {
        ...JSON.parse(JSON.stringify(node)),
        id: id2,
        x: node.x + 28,
        y: node.y + 28,
        title: node.title,
      };
      updateActive((g) => ({ ...g, nodes: [...g.nodes, copy] }));
      setSel([id2]);
      flash("Duplicated node");
    } else if (action === "delete") {
      snapshot();
      updateActive((g) => ({
        nodes: g.nodes.filter((n) => n.id !== id),
        edges: g.edges.filter((ed) => ed.from !== id && ed.to !== id),
      }));
      setSel((sl) => sl.filter((x) => x !== id));
      flash(`Removed “${node.title}” — Agent Bar notified`);
    }
  };
  const onBadge = (id) => {
    const node = graph.nodes.find((n) => n.id === id);
    if (node && onOpenThread) onOpenThread(buildNodeRef(node));
  };
  const askSubmit = (text) => {
    if (!composer) return;
    const node = graph.nodes.find((n) => n.id === composer.nodeId);
    if (node && onAsk) onAsk(buildNodeRef(node), text);
    setComposer(null);
  };

  /* ---------- compose selected → compound ---------- */
  const composeSel = () => {
    const chosen = sel.filter((id) => {
      const n = graph.nodes.find((x) => x.id === id);
      return n && !n.port;
    });
    if (chosen.length < 2) return;
    snapshot();
    const ns = chosen.map((id) => graph.nodes.find((n) => n.id === id));
    const minX = Math.min(...ns.map((n) => n.x)),
      minY = Math.min(...ns.map((n) => n.y));
    const cid = "c" + Date.now();
    const inner = ns.map((n) => ({ ...n, x: n.x - minX + 60, y: n.y - minY + 120 }));
    const innerEdges = graph.edges.filter(
      (ed) => chosen.includes(ed.from) && chosen.includes(ed.to),
    );
    const compoundNode = {
      id: cid,
      title: "Compound step",
      kind: "Compound · Custom",
      icon: "Layers",
      exec: `${ns.length} inner nodes`,
      meta: "double-click to open",
      x: minX,
      y: minY,
      compound: true,
    };
    updateActive((g) => {
      const remaining = g.nodes.filter((n) => !chosen.includes(n.id));
      const rewired = g.edges
        .filter((ed) => !(chosen.includes(ed.from) && chosen.includes(ed.to)))
        .map((ed) => ({
          ...ed,
          from: chosen.includes(ed.from) ? cid : ed.from,
          to: chosen.includes(ed.to) ? cid : ed.to,
        }));
      return { nodes: [...remaining, compoundNode], edges: rewired };
    });
    setGraphs((g) => ({ ...g, [cid]: { nodes: inner, edges: innerEdges } }));
    setSel([cid]);
    flash(`Composed ${ns.length} nodes into a compound — double-click to drill in`);
  };

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))
        return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && (e.key === "c" || e.key === "C")) {
        e.preventDefault();
        copySel();
        return;
      }
      if (mod && (e.key === "v" || e.key === "V")) {
        e.preventDefault();
        pasteClip();
        return;
      }
      if (mod && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        if (sel.length) {
          copySel();
          setTimeout(pasteClip, 0);
        }
        return;
      }
      if (configId || composer) {
        if (e.key === "Escape") {
          setConfigId(null);
          setComposer(null);
        }
        return;
      }
      if (e.key === "Escape") {
        if (drill.length) setDrill((d) => d.slice(0, -1));
        else {
          setSel([]);
          setSelEdge(null);
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (sel.length) {
          snapshot();
          updateActive((g) => ({
            nodes: g.nodes.filter((n) => !sel.includes(n.id)),
            edges: g.edges.filter((ed) => !sel.includes(ed.from) && !sel.includes(ed.to)),
          }));
          flash(`Removed ${sel.length} node${sel.length > 1 ? "s" : ""}`);
          setSel([]);
        } else if (selEdge) deleteEdge(selEdge);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, selEdge, drill, configId, composer, activeKey]);

  const running = phase === "running";
  const showStatus = running || phase === "done";
  const configNode = configId ? graph.nodes.find((n) => n.id === configId) : null;
  const selEdgeObj = selEdge ? graph.edges.find((e) => e.id === selEdge) : null;
  const cfgDirty =
    configNode && cfgSnapshot.current
      ? JSON.stringify({ t: configNode.title, c: configNode.config }) !==
        JSON.stringify({ t: cfgSnapshot.current.title, c: cfgSnapshot.current.config })
      : false;

  const crumbs = [{ id: "root", label: (pipe && pipe.name) || "Textbook → Quiz Pipeline" }];
  let parent = "root";
  drill.forEach((id) => {
    const n = (graphs[parent] || { nodes: [] }).nodes.find((x) => x.id === id);
    crumbs.push({ id, label: n ? n.title : "Compound" });
    parent = id;
  });

  return (
    <div
      className="relative h-full w-full overflow-hidden canvas-grid"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ---- top chrome ---- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-surface px-2.5 py-1.5 shadow-pill ring-1 ring-border">
            <Icon
              name={drill.length ? "Layers" : "Workflow"}
              size={13}
              className="shrink-0 text-muted-foreground"
            />
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              if (i === 0 && renaming) {
                const commit = (e) => {
                  const v = (e.target.value || "").trim();
                  if (onRename) onRename(v || c.label);
                  setRenaming(false);
                };
                return (
                  <input
                    key="rename"
                    autoFocus
                    defaultValue={c.label}
                    onBlur={commit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit(e);
                      if (e.key === "Escape") setRenaming(false);
                    }}
                    className="w-44 rounded-md bg-surface-2 px-1.5 py-0.5 text-[12.5px] font-semibold tracking-tightish focus:outline-none focus:ring-1 focus:ring-border-strong"
                  />
                );
              }
              return (
                <React.Fragment key={c.id}>
                  {i > 0 && (
                    <Icon name="ChevronRight" size={12} className="text-muted-foreground/50" />
                  )}
                  <button
                    onClick={() => {
                      if (i === 0 && isLast && onRename) setRenaming(true);
                      else setDrill(drill.slice(0, i));
                    }}
                    onDoubleClick={() => {
                      if (i === 0 && onRename) setRenaming(true);
                    }}
                    title={i === 0 && onRename ? "Click to rename" : undefined}
                    className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[12.5px] tracking-tightish transition-colors ${isLast ? "font-semibold text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}
                  >
                    {c.label}
                  </button>
                </React.Fragment>
              );
            })}
            {!drill.length && (
              <VersionMenu
                version={version}
                dirty={dirty}
                runState={run.active ? "running" : phase === "done" ? "done" : "draft"}
                onOverwrite={() => {
                  setDirty(false);
                  flash(`Saved over v${version}`);
                }}
                onSaveAsNew={() => {
                  setVersion((v) => v + 1);
                  setDirty(false);
                  flash(`Saved as v${version + 1}`);
                }}
              />
            )}
          </div>
          {drill.length > 0 && (
            <button
              onClick={() => setDrill((d) => d.slice(0, -1))}
              className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12px] shadow-pill ring-1 ring-border hover:ring-border-strong"
            >
              <Icon name="CornerUpLeft" size={13} /> Drill out
            </button>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {!drill.length && <StateLegend />}
          {!drill.length && (
            <button
              onClick={() => {
                if (run.active) cancelRun();
                else startRun();
              }}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12.5px] font-medium shadow-pill transition-all ${run.active ? "bg-surface text-foreground ring-1 ring-border" : "bg-foreground text-primary-foreground hover:opacity-90"}`}
            >
              <Icon
                name={run.active ? "Square" : "Play"}
                size={13}
                className={run.active ? "" : "fill-current"}
              />
              {run.active ? "Stop" : run.terminal ? "Re-run" : "Run"}
            </button>
          )}
          {!agentOpen && (
            <button
              onClick={() => setAgentOpen(true)}
              title="Show Agent Bar"
              className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12px] shadow-pill ring-1 ring-border hover:ring-border-strong"
            >
              <Icon name="Bot" size={13} /> Agent
            </button>
          )}
        </div>
      </div>

      {/* ---- components palette ---- */}
      {!drill.length && (
        <div className="pointer-events-auto absolute left-3 top-16 z-10">
          <button
            onClick={() => setCompOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] shadow-pill ring-1 transition-colors ${compOpen ? "bg-foreground text-primary-foreground ring-foreground" : "bg-surface ring-border hover:ring-border-strong"}`}
          >
            <Icon name="Boxes" size={13} /> Components
          </button>
          {compOpen && (
            <div className="mt-2 w-[230px] rounded-2xl bg-surface p-2.5 shadow-float ring-1 ring-border">
              <div className="mb-1.5 px-1 text-[10px] leading-snug text-muted-foreground">
                Click to drop on canvas, or drag one in.
              </div>
              {PALETTE.map((s) => (
                <div key={s.g} className="mb-2 last:mb-0">
                  <div className="px-1 pb-1 text-[9.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
                    {s.g}
                  </div>
                  <div className="space-y-0.5">
                    {s.items.map((it) => (
                      <div
                        key={it}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/node", it);
                          e.dataTransfer.effectAllowed = "copy";
                          setDragName(it);
                        }}
                        onDragEnd={() => setDragName(null)}
                        onClick={() => addNodeAtCenter(it)}
                        className={`flex cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px] ring-1 ring-transparent transition-colors hover:bg-accent/60 hover:ring-border ${dragName === it ? "opacity-40" : ""}`}
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-surface-2">
                          <Icon name={CATALOG[it].icon} size={11} className="text-foreground/70" />
                        </span>
                        <span className="flex-1">{it}</span>
                        <Icon name="Plus" size={11} className="text-muted-foreground/50" />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {drill.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-14 z-10 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface-2/90 px-3 py-1 text-[11px] text-muted-foreground shadow-soft ring-1 ring-border backdrop-blur">
            <Icon name="ShieldCheck" size={12} className="text-foreground/70" />
            Inside compound · drag handles to wire nodes. Only inputs/outputs show on the parent.
          </div>
        </div>
      )}

      {/* ---- the world ---- */}
      <div
        ref={wrapRef}
        className="absolute inset-0"
        onPointerDown={onBgPointerDown}
        onWheel={onWheel}
        onDragOver={(e) => {
          if (dragName) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={onCanvasDrop}
        style={{ cursor: tool === "hand" ? "grab" : "default" }}
      >
        {showGraph && (
          <div
            className="absolute left-0 top-0"
            style={{
              transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
              transformOrigin: "top left",
            }}
          >
            <EdgesLayer
              graph={graph}
              phase={phase}
              isRoot={isRoot}
              selEdge={selEdge}
              onEdgeClick={onEdgeClick}
              link={link}
              statusOf={statusOf}
            />
            <div className="absolute left-0 top-0" style={{ zIndex: 2 }}>
              {graph.nodes.map((n) => (
                <GNode
                  key={n.id}
                  n={n}
                  status={statusOf(n.id)}
                  selected={sel.includes(n.id)}
                  count={anchorCounts[refIdOf(n.id)] || 0}
                  highlight={hoverRef && hoverRef === refIdOf(n.id)}
                  dragging={
                    drag.current &&
                    drag.current.mode === "node" &&
                    drag.current.ids &&
                    drag.current.ids.includes(n.id)
                  }
                  linking={link && link.fromId === n.id}
                  onPointerDown={onNodePointerDown}
                  onClick={onNodeClick}
                  onDoubleClick={onNodeDouble}
                  onAction={onNodeAction}
                  onBadge={onBadge}
                  onHandleDown={onHandleDown}
                  onHandleUp={onHandleUp}
                />
              ))}
            </div>
          </div>
        )}
        {box && (
          <div
            className="pointer-events-none absolute z-30 rounded-md border border-foreground/40 bg-foreground/5"
            style={{
              left: Math.min(box.x0, box.x1),
              top: Math.min(box.y0, box.y1),
              width: Math.abs(box.x1 - box.x0),
              height: Math.abs(box.y1 - box.y0),
            }}
          />
        )}
        {dragName && (
          <div className="pointer-events-none absolute inset-0 z-20 border-2 border-dashed border-foreground/20" />
        )}
      </div>

      {(phase === "empty" || phase === "clarify" || phase === "reversing") && (
        <CanvasEmpty
          onSeed={() => {
            setGraphs({
              root: { nodes: ROOT_NODES, edges: ROOT_EDGES },
              n4: { nodes: VERIFY_NODES, edges: VERIFY_EDGES },
            });
            setPhase("applied");
          }}
        />
      )}

      {/* ---- compose bar ---- */}
      {sel.length >= 2 && !configId && (
        <div className="pointer-events-auto absolute left-1/2 top-16 z-30 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-foreground px-2 py-1.5 text-primary-foreground shadow-win">
            <span className="pl-1.5 text-[11.5px]">{sel.length} selected</span>
            <span className="h-3.5 w-px bg-primary-foreground/25" />
            <button
              onClick={composeSel}
              className="flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[11.5px] font-medium hover:bg-primary-foreground/25"
            >
              <Icon name="Group" size={12} /> Compose into compound
            </button>
            <button
              onClick={() => onAskSelection && onAskSelection()}
              className="flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1 text-[11.5px] font-medium hover:bg-primary-foreground/25"
            >
              <Icon name="Sparkles" size={12} /> Ask about selection
            </button>
            <button
              onClick={() => setSel([])}
              className="rounded-full p-1 text-primary-foreground/70 hover:bg-primary-foreground/15"
            >
              <Icon name="X" size={13} />
            </button>
          </div>
        </div>
      )}

      {composer && (
        <AskComposer
          x={composer.x}
          y={composer.y}
          onSubmit={askSubmit}
          onClose={() => setComposer(null)}
        />
      )}
      {selEdgeObj && (
        <EdgeInspector
          edge={selEdgeObj}
          onClose={() => setSelEdge(null)}
          onToggleField={(f) => toggleField(selEdgeObj.id, f)}
          onDelete={() => deleteEdge(selEdgeObj.id)}
        />
      )}
      {configNode && (
        <NodeConfig
          node={configNode}
          onClose={closeConfig}
          onConfig={(p) => patchConfig(configNode.id, p)}
          onTitle={patchTitle}
          onReset={resetConfig}
          dirty={cfgDirty}
        />
      )}

      {phase === "running" && (run.active || run.terminal) && !drill.length && (
        <RunConsole log={run.log} open={consoleOpen} onToggle={() => setConsoleOpen((v) => !v)} />
      )}
      {run.checkpoint && (
        <CheckpointDialog
          node={window.RUN_PLAN.find((p) => p.id === run.checkpoint) || { name: "this step" }}
          onApprove={approveCheckpoint}
          onReject={cancelRun}
          onEdit={editCheckpointStep}
        />
      )}

      {toast && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-40 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full bg-foreground px-3.5 py-2 text-[11.5px] text-primary-foreground shadow-win">
            <Icon name="Check" size={13} /> {toast}
          </div>
        </div>
      )}

      {/* ---- walkthrough stepper ---- */}
      <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2">
        <div className="flex items-center gap-1 rounded-full bg-surface px-1.5 py-1 shadow-pill ring-1 ring-border">
          <span className="pl-1.5 pr-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            Walkthrough
          </span>
          <button
            onClick={() => {
              const p = PHASES[Math.max(0, PHASES.indexOf(phase) - 1)];
              if (p === "running") startRun();
              else {
                resetRun();
                setDrill([]);
                setPhase(p);
              }
            }}
            className="rounded-full p-1.5 hover:bg-accent/60"
          >
            <Icon name="ChevronLeft" size={13} />
          </button>
          <div className="flex items-center gap-1 px-1">
            {PHASES.map((p) => (
              <button
                key={p}
                onClick={() => {
                  if (p === "running") startRun();
                  else {
                    resetRun();
                    setDrill([]);
                    setPhase(p);
                  }
                }}
                title={PHASE_LABEL[p]}
                className={`h-1.5 rounded-full transition-all ${p === phase ? "w-5 bg-foreground" : "w-1.5 bg-foreground/20 hover:bg-foreground/40"}`}
              />
            ))}
          </div>
          <span className="px-1 text-[11px] font-medium tabular-nums">
            {String(PHASES.indexOf(phase) + 1).padStart(2, "0")} · {PHASE_LABEL[phase]}
          </span>
          <button
            onClick={() => {
              const p = PHASES[Math.min(PHASES.length - 1, PHASES.indexOf(phase) + 1)];
              if (p === "running") startRun();
              else {
                resetRun();
                setDrill([]);
                setPhase(p);
              }
            }}
            className="rounded-full p-1.5 hover:bg-accent/60"
          >
            <Icon name="ChevronRight" size={13} />
          </button>
        </div>
      </div>

      {/* ---- tool + zoom ---- */}
      <div className="pointer-events-auto absolute bottom-4 right-4 z-20 flex items-center gap-0.5 rounded-full bg-surface p-1 shadow-pill ring-1 ring-border">
        <button
          onClick={() => setTool("select")}
          title="Select / box-select"
          className={`rounded-full p-1.5 ${tool === "select" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60"}`}
        >
          <Icon name="MousePointer2" size={13} />
        </button>
        <button
          onClick={() => setTool("hand")}
          title="Pan"
          className={`rounded-full p-1.5 ${tool === "hand" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60"}`}
        >
          <Icon name="Hand" size={13} />
        </button>
        <div className="mx-0.5 h-4 w-px bg-border-strong" />
        <button onClick={() => zoomBy(1 / 1.15)} className="rounded-full p-1.5 hover:bg-accent/60">
          <Icon name="Minus" size={13} />
        </button>
        <button
          onClick={() => setView({ x: 30, y: 30, scale: 0.78 })}
          className="px-1 text-[11px] tabular-nums text-muted-foreground hover:text-foreground"
          title="Reset view"
        >
          {Math.round(view.scale * 100)}%
        </button>
        <button onClick={() => zoomBy(1.15)} className="rounded-full p-1.5 hover:bg-accent/60">
          <Icon name="Plus" size={13} />
        </button>
      </div>
    </div>
  );
}

window.InteractiveCanvas = InteractiveCanvas;
window.NodeConfig = NodeConfig;
window.CANVAS_AGENTS = AGENTS_LIST;
window.CANVAS_MCP = MCP_LIST;
window.PIPE_NODES = ROOT_NODES;
window.PHASES = PHASES;
window.PHASE_LABEL = PHASE_LABEL;
