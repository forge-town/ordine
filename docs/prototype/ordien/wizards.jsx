/* ——— wizards.jsx · Capability wizards & drawers: Add/Manage Connector, Import Skill,
       Configure Agent, Find-for-me. Exported to window for pages.jsx. ——— */
const { useState: useStateWZ, useEffect: useEffectWZ, useRef: useRefWZ } = React;
const { Icon: WIcon } = window;

/* shared modal / drawer shells (match the canvas NodeConfig + Job drawer vocabulary) */
function Modal({ w = 460, children, onClose }) {
  return (
    <div className="absolute inset-0 z-50 grid place-items-center p-6" onClick={onClose}>
      <div className="absolute inset-0 node-config-bg" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="node-config-card relative flex max-h-[88%] w-full flex-col overflow-hidden rounded-2xl bg-surface shadow-win ring-1 ring-border-strong"
        style={{ maxWidth: w }}
      >
        {children}
      </div>
    </div>
  );
}
function ModalHead({ icon, title, sub, onClose, onBack }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
      {onBack && (
        <button
          onClick={onBack}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          <WIcon name="ArrowLeft" size={15} />
        </button>
      )}
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2">
        <WIcon name={icon} size={15} className="text-foreground/75" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-semibold tracking-tightish">{title}</div>
        {sub && <div className="truncate text-[10.5px] text-muted-foreground">{sub}</div>}
      </div>
      <button
        onClick={onClose}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      >
        <WIcon name="X" size={15} />
      </button>
    </div>
  );
}
function Drawer({ children, onClose }) {
  return (
    <div className="absolute inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="absolute inset-0"
        style={{ background: "color-mix(in oklab, var(--c-fg) 14%, transparent)" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="drawer-in relative flex h-full w-[440px] flex-col bg-background shadow-win ring-1 ring-border-strong"
      >
        {children}
      </div>
    </div>
  );
}
function WLabel({ children }) {
  return (
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </div>
  );
}
function WInput({ value, onChange, placeholder, mono }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-xl bg-surface-2 px-2.5 py-2 text-[12px] ring-1 ring-border focus:outline-none focus:ring-border-strong ${mono ? "font-mono text-[11.5px]" : ""}`}
    />
  );
}
function FooterBtns({ onClose, onConfirm, confirmLabel, confirmIcon, disabled, note }) {
  return (
    <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3">
      {note && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <WIcon name="Info" size={12} /> {note}
        </div>
      )}
      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onClose}
          className="rounded-xl bg-surface px-3 py-1.5 text-[12.5px] ring-1 ring-border hover:bg-accent/60"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={disabled}
          className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[12.5px] font-medium text-primary-foreground transition-opacity ${disabled ? "bg-surface-3 text-muted-foreground" : "bg-foreground hover:opacity-90"}`}
        >
          {confirmIcon && <WIcon name={confirmIcon} size={13} />} {confirmLabel}
        </button>
      </div>
    </div>
  );
}

/* ============================ Add Connector wizard ============================ */
const CONN_METHODS = [
  {
    v: "MCP",
    icon: "Plug",
    title: "MCP server",
    desc: "Connect a Model Context Protocol server by command or URL.",
  },
  {
    v: "Built-in",
    icon: "Boxes",
    title: "Built-in",
    desc: "Ordine-native integrations with guided auth.",
  },
  {
    v: "Direct API",
    icon: "Globe",
    title: "Direct API",
    desc: "Point at a base URL with a bearer token.",
  },
];
const BUILTIN_CATALOG = [
  ["Notion", "No"],
  ["Slack", "Sl"],
  ["GitHub", "GH"],
  ["Feishu / Lark", "Fs"],
  ["Google Drive", "GD"],
  ["Local Folder", "Fd"],
];
const MCP_SCOPES = ["read", "write", "search", "admin"];

function AddConnectorWizard({ onAdd, onClose, notify }) {
  const [method, setMethod] = useState(null);
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [scopes, setScopes] = useState(["read"]);
  const pickBuiltin = (n) => setName(n);
  const ready =
    method === "Built-in" ? !!name : method === "MCP" ? !!name && !!endpoint : !!name && !!endpoint;
  const mono = (name || "??")
    .split(/[\s/]+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const finish = () => {
    onAdd({
      name: name || "New connector",
      mono,
      method,
      status: "connected",
      need: false,
      scopes:
        method === "MCP"
          ? scopes.join(" · ")
          : method === "Direct API"
            ? "bearer · connected"
            : "guided · connected",
      sync: "just now",
    });
    notify && notify(`${name || "Connector"} added`);
    onClose();
  };

  return (
    <Modal w={480} onClose={onClose}>
      <ModalHead
        icon="Plug"
        title="Add connector"
        sub={method ? `${method} · step 2 of 2` : "Choose a connection method"}
        onClose={onClose}
        onBack={method ? () => setMethod(null) : null}
      />
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {!method ? (
          <div className="space-y-2">
            {CONN_METHODS.map((m) => (
              <button
                key={m.v}
                onClick={() => setMethod(m.v)}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left ring-1 ring-border transition-all hover:ring-border-strong hover:bg-accent/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface ring-1 ring-border">
                  <WIcon name={m.icon} size={17} className="text-foreground/80" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold tracking-tightish">{m.title}</div>
                  <div className="text-[11px] leading-snug text-muted-foreground">{m.desc}</div>
                </div>
                <WIcon name="ChevronRight" size={15} className="text-muted-foreground" />
              </button>
            ))}
          </div>
        ) : method === "Built-in" ? (
          <>
            <div>
              <WLabel>Choose a service</WLabel>
              <div className="grid grid-cols-3 gap-2">
                {BUILTIN_CATALOG.map(([n, m]) => (
                  <button
                    key={n}
                    onClick={() => pickBuiltin(n)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center ring-1 transition-colors ${name === n ? "bg-accent ring-border-strong" : "bg-surface-2 ring-border hover:bg-accent/50"}`}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-[12px] font-bold ring-1 ring-border">
                      {m}
                    </span>
                    <span className="text-[11px] font-medium leading-tight">{n}</span>
                  </button>
                ))}
              </div>
            </div>
            {name && (
              <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[11.5px] text-muted-foreground ring-1 ring-border">
                <WIcon name="ShieldCheck" size={13} className="text-foreground/70" /> Ordine will
                open a guided auth window for{" "}
                <span className="font-medium text-foreground">{name}</span>.
              </div>
            )}
          </>
        ) : method === "MCP" ? (
          <>
            <div>
              <WLabel>Server name</WLabel>
              <WInput value={name} onChange={setName} placeholder="notion-mcp" mono />
            </div>
            <div>
              <WLabel>Command or URL</WLabel>
              <WInput
                value={endpoint}
                onChange={setEndpoint}
                placeholder="npx -y @modelcontextprotocol/server-notion"
                mono
              />
            </div>
            <div>
              <WLabel>Scopes</WLabel>
              <div className="flex flex-wrap gap-1.5">
                {MCP_SCOPES.map((sc) => {
                  const on = scopes.includes(sc);
                  return (
                    <button
                      key={sc}
                      onClick={() =>
                        setScopes((cur) => (on ? cur.filter((x) => x !== sc) : [...cur, sc]))
                      }
                      className={`rounded-full px-2.5 py-1 text-[11.5px] font-mono ring-1 transition-colors ${on ? "bg-foreground text-primary-foreground ring-foreground" : "bg-surface ring-border hover:bg-accent/60"}`}
                    >
                      {on ? "✓ " : ""}
                      {sc}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <div>
              <WLabel>Connector name</WLabel>
              <WInput value={name} onChange={setName} placeholder="Internal API" />
            </div>
            <div>
              <WLabel>Base URL</WLabel>
              <WInput
                value={endpoint}
                onChange={setEndpoint}
                placeholder="https://api.example.com/v1"
                mono
              />
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[11.5px] text-muted-foreground ring-1 ring-border">
              <WIcon name="KeyRound" size={13} className="text-foreground/70" /> Add a bearer token
              after creating — it’s stored locally and masked.
            </div>
          </>
        )}
      </div>
      {method && (
        <FooterBtns
          onClose={onClose}
          onConfirm={finish}
          disabled={!ready}
          confirmLabel="Add connector"
          confirmIcon="Plus"
        />
      )}
    </Modal>
  );
}

/* =========================== Manage Connector drawer =========================== */
function ManageConnectorDrawer({ conn, onClose, onDisconnect, notify }) {
  const [scopes, setScopes] = useState(() => {
    const base = (conn.scopes || "")
      .split(/[·•]/)
      .map((x) => x.trim())
      .filter(Boolean);
    return (base.length ? base : ["read", "write"]).map((label) => ({ label, on: true }));
  });
  const log = [
    ["ok", `synced ${conn.sync || "just now"}`],
    ["info", "12 calls in the last hour · 0 errors"],
    ["info", `method · ${conn.method}`],
    ["ok", "token valid · expires in 27 days"],
  ];
  return (
    <Modal w={460} onClose={onClose}>
      <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-[12px] font-bold">
          {conn.mono}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold tracking-tightish">{conn.name}</div>
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span className="rounded bg-surface-2 px-1 py-0.5 font-medium">{conn.method}</span> ·{" "}
            {conn.need ? "needs setup" : "connected"}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          <WIcon name="X" size={15} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div>
          <WLabel>Scopes</WLabel>
          <div className="space-y-1.5">
            {scopes.map((sc, i) => (
              <button
                key={sc.label + i}
                onClick={() =>
                  setScopes((cur) => cur.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))
                }
                className="flex w-full items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2 text-left ring-1 ring-border"
              >
                <span className="flex-1 truncate font-mono text-[11.5px]">{sc.label}</span>
                <span
                  className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${sc.on ? "bg-foreground" : "bg-surface-3"}`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-surface transition-transform ${sc.on ? "translate-x-4" : ""}`}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <WLabel>Sync log</WLabel>
          <div className="space-y-1 rounded-xl bg-surface-2 p-3 font-mono text-[10.5px] leading-relaxed ring-1 ring-border">
            {log.map((l, i) => (
              <div key={i} className="flex gap-2">
                <span
                  className="w-3 shrink-0 text-center"
                  style={{ color: l[0] === "ok" ? "var(--c-success)" : undefined }}
                >
                  {l[0] === "ok" ? "✓" : "·"}
                </span>
                <span
                  className={l[0] === "ok" ? "" : "text-muted-foreground"}
                  style={l[0] === "ok" ? { color: "var(--c-success)" } : undefined}
                >
                  {l[1]}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => notify && notify(`Re-authorizing ${conn.name}…`)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-surface-2 py-2 text-[12.5px] font-medium ring-1 ring-border hover:bg-accent/60"
        >
          <WIcon name="RefreshCw" size={13} /> Re-authorize
        </button>
      </div>
      <div className="border-t border-border/70 px-4 py-3">
        <button
          onClick={() => {
            onDisconnect && onDisconnect(conn.name);
            onClose();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12.5px] font-medium text-destructive ring-1 ring-border hover:bg-destructive/10"
        >
          <WIcon name="Unplug" size={13} /> Disconnect
        </button>
      </div>
    </Modal>
  );
}

/* ============================== Import Skill wizard ============================== */
const DISCOVER = {
  "Claude Code": [
    ["refactor.skill", "Multi-file refactor across a repo"],
    ["test-gen.skill", "Generate unit tests from a function"],
    ["doc.skill", "Write docstrings & READMEs"],
  ],
  Codex: [
    ["sql.skill", "Natural language → SQL with schema"],
    ["regex.skill", "Build & explain regular expressions"],
    ["lint-fix.skill", "Auto-fix lint violations"],
  ],
  Hermes: [
    ["translate.skill", "Local translation · 40 languages"],
    ["redact.skill", "Strip PII from text · runs offline"],
  ],
};
function ImportSkillWizard({ onImport, onClose, notify }) {
  const [src, setSrc] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [found, setFound] = useState([]);
  const [picked, setPicked] = useState([]);
  const choose = (agent) => {
    setSrc(agent);
    setScanning(true);
    setFound([]);
    setPicked([]);
    window.setTimeout(() => {
      setFound(DISCOVER[agent] || []);
      setScanning(false);
    }, 1100);
  };
  const toggle = (n) =>
    setPicked((cur) => (cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]));
  const finish = () => {
    onImport && onImport(src, picked);
    notify && notify(`Imported ${picked.length} skill${picked.length > 1 ? "s" : ""} from ${src}`);
    onClose();
  };

  return (
    <Modal w={460} onClose={onClose}>
      <ModalHead
        icon="Download"
        title="Import skill"
        sub={src ? `${src} · select to import` : "Choose a source agent"}
        onClose={onClose}
        onBack={
          src
            ? () => {
                setSrc(null);
                setFound([]);
                setPicked([]);
              }
            : null
        }
      />
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {!src ? (
          (window.CANVAS_AGENTS || ["Claude Code", "Codex", "Hermes"]).map((a) => (
            <button
              key={a}
              onClick={() => choose(a)}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left ring-1 ring-border transition-all hover:ring-border-strong hover:bg-accent/40"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-[12px] font-bold text-primary-foreground">
                {a
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold tracking-tightish">{a}</div>
                <div className="text-[11px] text-muted-foreground">
                  {(DISCOVER[a] || []).length} skills available to import
                </div>
              </div>
              <WIcon name="ChevronRight" size={15} className="text-muted-foreground" />
            </button>
          ))
        ) : scanning ? (
          <div className="grid place-items-center py-12 text-center">
            <WIcon name="LoaderCircle" size={22} className="spin text-foreground/70" />
            <div className="mt-3 text-[12.5px] font-medium">Scanning {src}…</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Looking for importable skills
            </div>
          </div>
        ) : (
          <>
            <div className="px-1 text-[11px] text-muted-foreground">
              {found.length} skills found · pick the ones to add.
            </div>
            {found.map(([n, d]) => {
              const on = picked.includes(n);
              return (
                <button
                  key={n}
                  onClick={() => toggle(n)}
                  className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left ring-1 transition-colors ${on ? "bg-accent ring-border-strong" : "bg-surface-2 ring-border hover:bg-accent/50"}`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-md ring-1 ${on ? "bg-foreground text-primary-foreground ring-foreground" : "bg-surface ring-border-strong"}`}
                  >
                    {on && <WIcon name="Check" size={12} />}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface ring-1 ring-border">
                    <WIcon name="Sparkles" size={13} className="text-foreground/70" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[12px] font-semibold">{n}</div>
                    <div className="truncate text-[10.5px] text-muted-foreground">{d}</div>
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>
      {src && !scanning && (
        <FooterBtns
          onClose={onClose}
          onConfirm={finish}
          disabled={!picked.length}
          confirmLabel={`Import ${picked.length || ""}`.trim()}
          confirmIcon="Download"
          note={`${picked.length} selected`}
        />
      )}
    </Modal>
  );
}

/* ============================= Configure Agent drawer ============================= */
const AGENT_TOOLS = ["File edit", "Shell", "Web fetch", "Network", "Local exec"];
function ConfigureAgentDrawer({ agent, onClose, notify }) {
  const [prompt, setPrompt] = useState(
    `You are ${agent.name}, a local worker. Complete the assigned operation precisely and return structured output.`,
  );
  const [tools, setTools] = useState(() =>
    AGENT_TOOLS.map((t) => ({
      t,
      on:
        (agent.caps || []).some((c) => t.toLowerCase().includes(c.toLowerCase().split(" ")[0])) ||
        t === "File edit",
    })),
  );
  const [model, setModel] = useState((agent.models || "").split("·")[0].trim() || "default");
  const models = (agent.models || "")
    .split("·")
    .map((m) => m.trim())
    .filter(Boolean);
  return (
    <Drawer onClose={onClose}>
      <div className="flex items-start gap-3 border-b border-border/70 px-5 py-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-foreground text-[13px] font-bold text-primary-foreground">
          {agent.mono}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold tracking-tightish">{agent.name}</div>
          <div className="font-mono text-[10.5px] text-muted-foreground">
            {agent.ver} · {agent.models}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          <WIcon name="X" size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div>
          <WLabel>System prompt</WLabel>
          <textarea
            rows={4}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full resize-none rounded-xl bg-surface-2 p-2.5 text-[11.5px] leading-relaxed ring-1 ring-border focus:outline-none focus:ring-border-strong"
          />
        </div>
        <div>
          <WLabel>Default model</WLabel>
          <div className="flex flex-wrap gap-1.5">
            {(models.length ? models : ["default"]).map((m) => (
              <button
                key={m}
                onClick={() => setModel(m)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] ring-1 transition-colors ${model === m ? "bg-foreground text-primary-foreground ring-foreground" : "bg-surface ring-border hover:bg-accent/60"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div>
          <WLabel>Allowed tools</WLabel>
          <div className="space-y-1.5">
            {tools.map((t, i) => (
              <button
                key={t.t}
                onClick={() =>
                  setTools((cur) => cur.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))
                }
                className="flex w-full items-center gap-2.5 rounded-xl bg-surface-2 px-3 py-2 text-left ring-1 ring-border"
              >
                <span className="flex-1 text-[12px] font-medium">{t.t}</span>
                <span
                  className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${t.on ? "bg-foreground" : "bg-surface-3"}`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-surface transition-transform ${t.on ? "translate-x-4" : ""}`}
                  />
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-border/70 px-5 py-3">
        <button
          onClick={() => {
            notify && notify(`${agent.name} configuration saved`);
            onClose();
          }}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-foreground py-2 text-[12.5px] font-medium text-primary-foreground hover:opacity-90"
        >
          <WIcon name="Check" size={14} /> Save configuration
        </button>
      </div>
    </Drawer>
  );
}

/* =============================== Find-for-me modal =============================== */
function FindForMeModal({ items, onPick, onClose }) {
  const [phase, setPhase] = useState("searching");
  useEffect(() => {
    const t = setTimeout(() => setPhase("done"), 1000);
    return () => clearTimeout(t);
  }, []);
  const top = (items || [])
    .slice()
    .sort((a, b) => (b.used || 0) - (a.used || 0))
    .slice(0, 5);
  return (
    <Modal w={440} onClose={onClose}>
      <ModalHead
        icon="Sparkles"
        title="Find for me"
        sub="The Agent scans your component library"
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {phase === "searching" ? (
          <div className="grid place-items-center py-12 text-center">
            <WIcon name="LoaderCircle" size={22} className="spin text-foreground/70" />
            <div className="mt-3 text-[12.5px] font-medium">Searching your library…</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Ranking by reuse and relevance
            </div>
          </div>
        ) : (
          <>
            <div className="px-1 text-[11px] text-muted-foreground">
              Most reusable components for your next pipeline:
            </div>
            {top.map((it) => (
              <button
                key={it.name}
                onClick={() => {
                  onPick && onPick(it);
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-xl bg-surface-2 p-2.5 text-left ring-1 ring-border transition-colors hover:bg-accent/50 hover:ring-border-strong"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface ring-1 ring-border">
                  <WIcon name="Boxes" size={13} className="text-foreground/70" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold tracking-tightish">
                    {it.name}
                  </div>
                  <div className="truncate text-[10.5px] text-muted-foreground">{it.meta}</div>
                </div>
                <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border">
                  used {it.used}×
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </Modal>
  );
}

/* =============================== Skill detail drawer =============================== */
function SkillDetailDrawer({ skill, onClose, onDelete, notify }) {
  const manifest = `---
name: ${skill.name}
source: ${skill.src}
operation: ${skill.op}
io: ${skill.io}
---
# ${skill.name}
${skill.desc}`;
  return (
    <Modal w={480} onClose={onClose}>
      <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2">
          <WIcon name="Sparkles" size={15} className="text-foreground/75" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-[13px] font-semibold">{skill.name}</div>
          <div className="text-[10.5px] text-muted-foreground">imported from {skill.src}</div>
        </div>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-foreground/80">
          {skill.src}
        </span>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          <WIcon name="X" size={15} />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <p className="text-[12px] leading-relaxed text-foreground/85">{skill.desc}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-border">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Powers
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium">
              <WIcon name="Cpu" size={13} className="text-foreground/70" /> {skill.op}
            </div>
          </div>
          <div className="rounded-xl bg-surface-2 p-3 ring-1 ring-border">
            <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              Used in
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium">
              <WIcon name="GitBranch" size={13} className="text-foreground/70" /> {skill.used}{" "}
              pipeline{skill.used !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <div>
          <WLabel>Data contract</WLabel>
          <div className="rounded-xl bg-surface-2 px-3 py-2 font-mono text-[11.5px] ring-1 ring-border">
            {skill.io}
          </div>
        </div>
        <div>
          <WLabel>Manifest</WLabel>
          <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-mono text-[10.5px] leading-relaxed text-foreground/80 ring-1 ring-border">
            {manifest}
          </pre>
        </div>
        <button
          onClick={() => notify && notify(`Assigning ${skill.name} to an operation…`)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-surface-2 py-2 text-[12.5px] font-medium ring-1 ring-border hover:bg-accent/60"
        >
          <WIcon name="Plus" size={13} /> Assign to an operation
        </button>
      </div>
      <div className="border-t border-border/70 px-4 py-3">
        <button
          onClick={() => onDelete && onDelete(skill)}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[12.5px] font-medium text-destructive ring-1 ring-border hover:bg-destructive/10"
        >
          <WIcon name="Trash2" size={13} /> Delete skill
        </button>
      </div>
    </Modal>
  );
}

Object.assign(window, {
  AddConnectorWizard,
  ManageConnectorDrawer,
  ImportSkillWizard,
  ConfigureAgentDrawer,
  FindForMeModal,
  SkillDetailDrawer,
});
