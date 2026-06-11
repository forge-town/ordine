/* ——— shell.jsx · MacWindow + Sidebar + App router + app-chrome (notifications, global search, sign-out) ——— */
const { useState: useStateS, useEffect: useEffectS, useRef: useRefS, useMemo: useMemoS } = React;
const useState = useStateS, useEffect = useEffectS, useRef = useRefS, useMemo = useMemoS;
const { Icon: SIcon, Btn: SBtn } = window;

const NAV = [
  { title: "Assembly", items: [
    { key: "pipelines", label: "Pipelines", icon: "Workflow", badgeKey: "pipelines" },
    { key: "components", label: "Components", icon: "Boxes", badgeKey: "components" },
  ]},
  { title: "Monitor", items: [
    { key: "jobs", label: "Jobs", icon: "ListChecks", badge: "3" },
    { key: "usage", label: "Usage", icon: "Gauge" },
  ]},
  { title: "Capabilities", collapsible: true, items: [
    { key: "agents", label: "Local Agents", icon: "Cpu", badge: "3" },
    { key: "skills", label: "Skills", icon: "Sparkles", badge: "14" },
    { key: "connectors", label: "Connectors", icon: "Plug", badge: "6" },
  ]},
];

/* lightweight dismiss-on-outside-click hook */
function useOutside(onOut) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onOut(); };
    window.addEventListener("pointerdown", h);
    return () => window.removeEventListener("pointerdown", h);
  }, []);
  return ref;
}

/* relative time-ago for notifications */
function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return s + "s ago";
  const m = Math.round(s / 60); if (m < 60) return m + "m ago";
  const h = Math.round(m / 60); if (h < 24) return h + "h ago";
  return Math.round(h / 24) + "d ago";
}

/* ============================== global search ============================== */
/* builds a flat, searchable corpus from the data the other modules export to window */
function useSearchCorpus() {
  return useMemo(() => {
    const S = window.SEARCH || {};
    const out = [];
    (S.pipes || []).forEach((p) => out.push({ type: "Pipeline", label: p.name, sub: p.desc, route: "workspace", icon: p.draft ? "MessageSquare" : "Workflow" }));
    Object.keys(S.comps || {}).forEach((cat) =>
      (S.comps[cat].items || []).forEach((it) =>
        out.push({ type: "Component", label: it.name, sub: it.meta || cat, route: "components", icon: S.comps[cat].icon })
      )
    );
    (window.PIPE_NODES || []).forEach((n) => out.push({ type: "Node", label: n.title, sub: n.kind + " · in Textbook → Quiz", route: "workspace", icon: n.icon }));
    (S.jobs || []).forEach((j) => out.push({ type: "Job", label: j.pipe, sub: j.id + " · " + j.status, route: "jobs", icon: "ListChecks" }));
    (S.skills || []).forEach((s) => out.push({ type: "Skill", label: s.name, sub: s.desc, route: "skills", icon: "Sparkles" }));
    (S.conns || []).forEach((c) => out.push({ type: "Connector", label: c.name, sub: c.method + " · " + c.scopes, route: "connectors", icon: "Plug" }));
    (S.agents || []).forEach((a) => out.push({ type: "Agent", label: a.name, sub: a.models, route: "agents", icon: "Cpu" }));
    return out;
  }, []);
}

function GlobalSearchResults({ q, onPick }) {
  const corpus = useSearchCorpus();
  const ql = q.trim().toLowerCase();
  const hits = ql ? corpus.filter((c) => c.label.toLowerCase().includes(ql) || (c.sub || "").toLowerCase().includes(ql)).slice(0, 24) : [];
  const groups = {};
  hits.forEach((h) => { (groups[h.type] = groups[h.type] || []).push(h); });
  const order = ["Pipeline", "Node", "Component", "Job", "Skill", "Connector", "Agent"];
  return (
    <div className="px-2 pb-2">
      {hits.length === 0 ? (
        <div className="px-3 py-6 text-center text-[11.5px] text-muted-foreground">No matches for “{q}”</div>
      ) : (
        order.filter((g) => groups[g]).map((g) => (
          <div key={g} className="mt-2.5 first:mt-0">
            <div className="px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">{g}s<span className="ml-1 text-muted-foreground/60">{groups[g].length}</span></div>
            <ul className="space-y-0.5">
              {groups[g].map((h, i) => (
                <li key={g + i}>
                  <button onClick={() => onPick(h)} className="group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition-colors hover:bg-accent/60">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2"><SIcon name={h.icon} size={12} className="text-foreground/70" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-medium tracking-tightish">{h.label}</span><span className="block truncate text-[10px] text-muted-foreground">{h.sub}</span></span>
                    <SIcon name="ArrowRight" size={12} className="shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

/* ================================== sidebar ================================== */
function Sidebar({ route, onNav, notify, onCollapse, projects, proj, setProj, newProject, newPipeline, onOpenSettings, onSignOut, settingsAnchor, setSettingsAnchor, onExitSettings }) {
  const inSettings = route === "settings";
  const [projOpen, setProjOpen] = useState(false);
  const [setOpen, setSetOpen] = useState(false);
  const [q, setQ] = useState("");
  const activeKey = route === "workspace" ? "pipelines" : route;
  const projRef = useOutside(() => setProjOpen(false));
  const setRef = useOutside(() => setSetOpen(false));
  const cur = projects.find((p) => p.id === proj) || projects[0];

  const badgeCounts = useMemo(() => {
    const S = window.SEARCH || {};
    const compTotal = Object.keys(S.comps || {}).reduce((n, c) => n + (S.comps[c].items || []).length, 0);
    return { pipelines: (S.pipes || []).length || 12, components: compTotal || 38 };
  }, []);

  const searching = q.trim().length > 0;
  const pick = (hit) => { setQ(""); onNav(hit.route); notify(`Opened ${hit.type.toLowerCase()} · ${hit.label}`); };

  const userMenu = [
    ["User", "Account settings", () => onOpenSettings("account")],
    ["Keyboard", "Keyboard shortcuts", () => onOpenSettings("keyboard")],
    ["Moon", "Appearance", () => onOpenSettings("general")],
    ["LogOut", "Sign out", () => onSignOut()],
  ];

  return (
    <aside className="flex h-full w-full shrink-0 flex-col bg-surface">
      {inSettings ? (
        <div className="px-3 pt-3">
          <div className="flex items-center gap-1.5">
            <button onClick={onExitSettings} title="Back" className="flex flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[13px] font-medium text-foreground/80 transition-colors hover:bg-accent/60 hover:text-foreground">
              <SIcon name="ArrowLeft" size={16} className="text-muted-foreground" /> Back
            </button>
            <button onClick={onCollapse} title="Collapse sidebar" className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"><SIcon name="PanelLeft" size={15} /></button>
          </div>
          <div className="mt-2 flex items-center gap-2 px-2.5">
            <SIcon name="Settings" size={15} className="text-foreground/70" />
            <span className="text-[15px] font-semibold tracking-tightish">Settings</span>
          </div>
        </div>
      ) : (
      <div className="relative px-3 pt-3">
        <div className="flex items-center gap-1.5">
          <div ref={projRef} className="relative min-w-0 flex-1">
            <button onClick={() => { setProjOpen((v) => !v); setSetOpen(false); }}
              className="flex min-w-0 w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-accent/60">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-[12px] font-bold text-primary-foreground">{cur.name[0]}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold leading-tight tracking-tightish">{cur.name}</div>
                <div className="truncate text-[10.5px] text-muted-foreground">{cur.sub}</div>
              </div>
              <SIcon name="ChevronsUpDown" size={13} className="shrink-0 text-muted-foreground" />
            </button>
            {projOpen && (
              <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-xl bg-surface p-1.5 shadow-float ring-1 ring-border-strong fade-rise">
                <div className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Switch project</div>
                {projects.map((p) => (
                  <button key={p.id} onClick={() => { setProj(p.id); setProjOpen(false); notify(`Switched to “${p.name}”`); }}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-accent/60">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-2 text-[11px] font-bold">{p.name[0]}</div>
                    <div className="min-w-0 flex-1"><div className="truncate text-[12px] font-medium">{p.name}</div><div className="truncate text-[10px] text-muted-foreground">{p.sub}</div></div>
                    {p.id === proj && <SIcon name="Check" size={13} className="text-foreground" />}
                  </button>
                ))}
                <div className="my-1 h-px bg-border" />
                <button onClick={() => { setProjOpen(false); newProject(); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-accent/60">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-surface-2"><SIcon name="Plus" size={13} /></div> New project
                </button>
              </div>
            )}
          </div>
          <button onClick={onCollapse} title="Collapse sidebar" className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"><SIcon name="PanelLeft" size={15} /></button>
        </div>

        <button onClick={newPipeline} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl bg-foreground px-2.5 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90">
          <SIcon name="Plus" size={14} /> New Pipeline
        </button>
        <div className="relative mt-2.5">
          <SIcon name="Search" size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything…"
            className="w-full rounded-xl bg-surface-2 py-1.5 pl-8 pr-7 text-[12px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border-strong" />
          {q && <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:bg-accent"><SIcon name="X" size={12} /></button>}
        </div>
      </div>
      )}

      <nav className="mt-3.5 flex-1 overflow-y-auto px-2 pb-2 no-bar">
        {inSettings ? (
          <ul className="space-y-0.5">
            {(window.SETTINGS_GROUPS || []).map((g) => {
              const on = (settingsAnchor || "general") === g.key;
              return (
                <li key={g.key}>
                  <button onClick={() => setSettingsAnchor(g.key)}
                    className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-colors ${on ? "bg-accent text-foreground" : "text-foreground/85 hover:bg-accent/55"}`}>
                    <SIcon name={g.icon} size={15} className="text-foreground/70" />
                    <span className="flex-1 text-left tracking-tightish">{g.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : searching ? (
          <GlobalSearchResults q={q} onPick={pick} />
        ) : (
          NAV.map((g) => (
            <div key={g.title} className="mt-3.5 first:mt-0">
              <div className="flex w-full items-center justify-between px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground">
                <span>{g.title}</span>
              </div>
              <ul className="mt-1 space-y-0.5">
                {g.items.map((it) => {
                  const active = activeKey === it.key;
                  const badge = it.badgeKey ? badgeCounts[it.badgeKey] : it.badge;
                  return (
                    <li key={it.key}>
                      <button onClick={() => onNav(it.key)}
                        className={`group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] transition-colors ${active ? "bg-accent text-foreground" : "text-foreground/85 hover:bg-accent/55"}`}>
                        <SIcon name={it.icon} size={15} className="text-foreground/70" />
                        <span className="flex-1 text-left tracking-tightish">{it.label}</span>
                        {badge && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{badge}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </nav>

      <div ref={setRef} className="relative border-t border-border/70 p-2">
        {setOpen && (
          <div className="absolute bottom-full left-2 right-2 z-40 mb-1 rounded-xl bg-surface p-1.5 shadow-float ring-1 ring-border-strong fade-rise">
            {userMenu.map(([ic, label, act]) => (
              <button key={label} onClick={() => { setSetOpen(false); act(); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-accent/60 ${label === "Sign out" ? "text-destructive" : ""}`}>
                <SIcon name={ic} size={13} className={label === "Sign out" ? "" : "text-muted-foreground"} /> {label}
              </button>
            ))}
          </div>
        )}
        <div className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-accent/60">
          <button onClick={() => { setSetOpen((v) => !v); setProjOpen(false); }} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold">W</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] font-medium leading-tight">Wei Chen</div>
              <div className="flex items-center gap-1 truncate text-[10px] text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-success" /> Local mode · 3 agents</div>
            </div>
          </button>
          <button onClick={() => onOpenSettings("general")} title="Settings" className="shrink-0 rounded-lg p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><SIcon name="Settings" size={14} /></button>
        </div>
      </div>
    </aside>
  );
}

/* ============================ notification center ============================ */
function NotifBell({ notifs, onToggle }) {
  const unread = notifs.filter((n) => !n.read).length;
  return (
    <button onClick={onToggle} title="Notifications" className="pointer-events-auto relative rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground">
      <SIcon name="Bell" size={15} />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-foreground px-1 text-[8.5px] font-bold text-primary-foreground">{unread}</span>}
    </button>
  );
}
const NOTIF_ICON = { success: ["CircleCheck", "var(--c-success)"], error: ["CircleAlert", "var(--c-destructive)"], warn: ["TriangleAlert", "color-mix(in oklab, var(--c-warning) 80%, var(--c-fg))"], info: ["Info", "var(--c-muted-fg)"] };
function NotifCenter({ notifs, onClose, onClear, onMarkRead, onNav }) {
  const ref = useOutside(onClose);
  return (
    <div ref={ref} className="absolute right-3 top-10 z-50 w-[320px] overflow-hidden rounded-2xl bg-surface shadow-win ring-1 ring-border-strong fade-rise">
      <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5">
        <SIcon name="Bell" size={14} className="text-foreground/75" />
        <span className="text-[12.5px] font-semibold tracking-tightish">Notifications</span>
        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground">{notifs.length}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={onMarkRead} title="Mark all read" className="rounded-lg px-1.5 py-1 text-[10.5px] text-muted-foreground hover:bg-accent/60 hover:text-foreground">Mark read</button>
          <button onClick={onClear} title="Clear all" className="rounded-lg p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground"><SIcon name="Trash2" size={13} /></button>
        </div>
      </div>
      <div className="max-h-[360px] overflow-y-auto py-1">
        {notifs.length === 0 ? (
          <div className="grid place-items-center px-4 py-10 text-center"><SIcon name="BellOff" size={20} className="text-muted-foreground/50" /><div className="mt-2 text-[12px] font-medium">All clear</div><div className="mt-0.5 text-[11px] text-muted-foreground">Run, self-heal & connector events show here.</div></div>
        ) : notifs.map((n) => {
          const [ic, color] = NOTIF_ICON[n.kind] || NOTIF_ICON.info;
          return (
            <button key={n.id} onClick={() => { if (n.route) onNav(n.route); onClose(); }}
              className={`flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-accent/40 ${n.read ? "opacity-65" : ""}`}>
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"><SIcon name={ic} size={14} style={{ color }} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] leading-snug text-foreground/90">{n.msg}</span>
                <span className="mt-0.5 block text-[10px] text-muted-foreground">{timeAgo(n.ts)}{n.route ? " · open" : ""}</span>
              </span>
              {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------- mac window ------------------------------- */
function MacWindow({ children, rightSlot }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[14px] bg-background shadow-win ring-1 ring-black/10" style={{ width: 1380, height: 858 }}>
      <div className="relative flex h-9 shrink-0 items-center bg-surface px-4">
        <div className="group flex items-center gap-2">
          <button title="Close" className="h-3 w-3 rounded-full bg-[#ff5f57] transition-transform hover:scale-110" />
          <button title="Minimize" className="h-3 w-3 rounded-full bg-[#febc2e] transition-transform hover:scale-110" />
          <button title="Zoom" className="h-3 w-3 rounded-full bg-[#28c840] transition-transform hover:scale-110" />
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11.5px] font-medium text-muted-foreground">
          Ordine — Local
        </div>
        <div className="pointer-events-none relative z-10 ml-auto flex items-center">{rightSlot}</div>
      </div>
      <div className="flex min-h-0 flex-1">{children}</div>
    </div>
  );
}

/* draggable column divider. Delta is divided by the stage scale so it tracks the cursor 1:1. */
function ResizeHandle({ side, onDelta, onCommit, onCollapse, line = true }) {
  const start = useRef(null);
  const down = (e) => {
    e.preventDefault(); e.stopPropagation();
    start.current = { x: e.clientX, collapsed: false };
    const move = (ev) => {
      const sc = window.__ordineScale || 1;
      let dx = (ev.clientX - start.current.x) / sc;
      if (side === "right") dx = -dx;          // right panel grows when dragging left
      onDelta(dx, (collapsed) => { start.current.collapsed = collapsed; });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      onCommit && onCommit();
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return (
    <div onPointerDown={down} onDoubleClick={onCollapse}
      className="group relative z-30 h-full w-1.5 shrink-0 cursor-col-resize"
      title="Drag to resize · double-click to collapse">
      {/* widened invisible grab zone — doesn't affect layout */}
      <div className="absolute inset-y-0 -left-1 -right-1" />
      {line && <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-border-strong" />}
      <div className="absolute inset-y-6 left-1/2 w-1 -translate-x-1/2 rounded-full opacity-0 transition-opacity group-hover:opacity-100" style={{ background: "color-mix(in oklab, var(--c-fg) 24%, transparent)" }} />
    </div>
  );
}

function ScaledStage({ children }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => { const s = Math.min(1, (window.innerWidth - 40) / 1380, (window.innerHeight - 40) / 858); setScale(s); window.__ordineScale = s; };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div className="grid min-h-screen place-items-center p-5">
      <div style={{ width: 1380 * scale, height: 858 * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}>{children}</div>
      </div>
    </div>
  );
}

/* tiny global toast */
function ShellToast({ msg, kind }) {
  if (!msg) return null;
  const [ic, color] = NOTIF_ICON[kind] || NOTIF_ICON.success;
  return (
    <div className="pointer-events-none absolute bottom-5 left-1/2 z-[60] -translate-x-1/2">
      <div className="flex items-center gap-2 rounded-full bg-foreground px-3.5 py-2 text-[11.5px] text-primary-foreground shadow-win fade-rise">
        <SIcon name={kind === "error" ? "CircleAlert" : "Check"} size={13} /> {msg}
      </div>
    </div>
  );
}

/* ------------------------------ sign-out overlay ------------------------------ */
function SignedOut({ onBack }) {
  return (
    <div className="absolute inset-0 z-[70] grid place-items-center bg-background">
      <div className="flex max-w-[300px] flex-col items-center text-center fade-rise">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground text-primary-foreground shadow-float"><SIcon name="Lock" size={20} /></div>
        <div className="mt-4 text-[15px] font-semibold tracking-tightish">Signed out of local mode</div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">Your pipelines and conversations stay on this machine. Sign back in to pick up where you left off.</p>
        <button onClick={onBack} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-foreground px-3.5 py-2 text-[12.5px] font-medium text-primary-foreground hover:opacity-90">
          <SIcon name="LogIn" size={14} /> Re-enter workspace
        </button>
      </div>
    </div>
  );
}

/* ---------------------------------- app ----------------------------------- */
const SEED_NOTIFS = [
  { kind: "success", msg: "job_69f7 completed · 20 questions exported to Notion", t: 8 },
  { kind: "info", msg: "Self-heal · Parse & Extract retried at a 4k chunk", t: 9 },
  { kind: "error", msg: "Notion connector needs a token to finish export", t: 12, route: "connectors" },
  { kind: "success", msg: "Repo → Changelog ran on its 06:00 routine", t: 46 },
  { kind: "info", msg: "Distilled “Textbook → Notion Quiz” into a Pipeline Skill", t: 70, route: "components" },
];

function App() {
  const [route, setRoute] = useState("workspace");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [agentOpen, setAgentOpen] = useState(true);
  const [leftW, setLeftW] = useState(236);
  const [rightW, setRightW] = useState(360);
  const leftRef = useRef(236);
  const [toast, setToast] = useState(null);
  const [toastKind, setToastKind] = useState("success");
  const [projects, setProjects] = useState([
    { id: "p1", name: "Ordine · Studio", sub: "Personal workspace", desc: "Personal automation studio — textbook pipelines, research briefs, changelogs." },
    { id: "p2", name: "Acme Research", sub: "Team · 4 members", desc: "Shared research workspace for the Acme growth team." },
    { id: "p3", name: "Side Projects", sub: "Personal workspace", desc: "Weekend experiments and one-off runs." },
  ]);
  const [proj, setProj] = useState("p1");
  const [notifs, setNotifs] = useState(() => SEED_NOTIFS.map((n, i) => ({ id: "seed" + i, kind: n.kind, msg: n.msg, ts: Date.now() - n.t * 60000, route: n.route, read: i > 1 })));
  const [notifOpen, setNotifOpen] = useState(false);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem("ordine.theme") || "light"; } catch (e) { return "light"; } });
  const [settingsAnchor, setSettingsAnchor] = useState("general");
  const [prevRoute, setPrevRoute] = useState("workspace");
  const [signedOut, setSignedOut] = useState(false);
  const [openPipe, setOpenPipe] = useState({ id: "textbook-quiz", name: "Textbook → Quiz Pipeline", fresh: false });

  const notify = (msg, kind = "success") => {
    setToast(msg); setToastKind(kind);
    setNotifs((ns) => [{ id: "n" + Date.now() + Math.random().toString(36).slice(2, 5), kind, msg, ts: Date.now(), read: false }, ...ns].slice(0, 60));
    window.clearTimeout(notify._t); notify._t = window.setTimeout(() => setToast(null), 2400);
  };

  useEffect(() => { try { localStorage.setItem("ordine.theme", theme); } catch (e) {} document.documentElement.setAttribute("data-theme", theme); }, [theme]);

  const Pages = window.Pages || {};
  const openSettings = (anchor) => { if (route !== "settings") setPrevRoute(route); setSettingsAnchor(anchor || "general"); setRoute("settings"); };
  const newProject = () => {
    const id = "p" + Date.now();
    setProjects((ps) => [...ps, { id, name: "Untitled project", sub: "Personal workspace", desc: "" }]);
    setProj(id); notify("Created “Untitled project”");
  };
  const newPipeline = () => { setOpenPipe({ id: "pipe" + Date.now(), name: "Untitled pipeline", fresh: true }); setRoute("workspace"); notify("New pipeline — describe a goal in the Agent Bar"); };
  const openPipeline = (name) => { setOpenPipe({ id: "pipe-" + (name || "demo").toLowerCase().replace(/[^a-z0-9]+/g, "-"), name: name || "Pipeline", fresh: false }); setRoute("workspace"); };

  const onLeftDrag = (dx) => {
    const next = leftRef.current + dx;
    if (next < 168) { setSidebarOpen(false); return; }
    setLeftW(Math.max(200, Math.min(360, next)));
  };

  let main;
  if (route === "workspace") main = <window.Workspace key={openPipe.id} pipe={openPipe} onRename={(name) => setOpenPipe((p) => ({ ...p, name }))} agentOpen={agentOpen} setAgentOpen={setAgentOpen} rightW={rightW} setRightW={setRightW} ResizeHandle={ResizeHandle} notify={notify} onNav={setRoute} />;
  else if (route === "settings" && window.SettingsPage) {
    main = <window.SettingsPage notify={notify} onNav={setRoute} theme={theme} setTheme={setTheme} anchor={settingsAnchor}
      projects={projects} proj={proj} setProjects={setProjects} onSignOut={() => setSignedOut(true)} onClearNotifs={() => { setNotifs([]); notify("Notification history cleared"); }} />;
  }
  else if (Pages[route]) {
    const P = Pages[route];
    main = <P onOpen={() => setRoute("workspace")} onOpenPipeline={openPipeline} onNewPipeline={newPipeline} onNav={setRoute} notify={notify} />;
  } else main = <div className="grid flex-1 place-items-center text-muted-foreground">Coming soon</div>;

  return (
    <ScaledStage>
      <div className="relative">
        <MacWindow rightSlot={<NotifBell notifs={notifs} onToggle={() => setNotifOpen((v) => !v)} />}>
          {sidebarOpen && (
            <div className="flex h-full shrink-0 panel-in" style={{ width: leftW }} onPointerDownCapture={() => { leftRef.current = leftW; }}>
              <div className="h-full min-w-0 flex-1 overflow-hidden">
                <Sidebar route={route} onNav={setRoute} notify={notify} onCollapse={() => setSidebarOpen(false)}
                  projects={projects} proj={proj} setProj={setProj} newProject={newProject} newPipeline={newPipeline}
                  onOpenSettings={openSettings} onSignOut={() => setSignedOut(true)}
                  settingsAnchor={settingsAnchor} setSettingsAnchor={setSettingsAnchor} onExitSettings={() => setRoute(prevRoute)} />
              </div>
            </div>
          )}
          {sidebarOpen && <ResizeHandle side="left" onDelta={onLeftDrag} onCollapse={() => setSidebarOpen(false)} />}
          <main key={route} className="min-w-0 flex-1 overflow-hidden bg-background page-swap">
            {main}
          </main>
        </MacWindow>
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} title="Show sidebar"
            className="group absolute left-0 top-1/2 z-40 flex h-14 w-[22px] -translate-y-1/2 items-center justify-center rounded-r-xl bg-surface shadow-float ring-1 ring-l-0 ring-border-strong transition-all hover:w-7">
            <SIcon name="PanelLeft" size={14} className="text-muted-foreground transition-colors group-hover:text-foreground" />
          </button>
        )}
        {notifOpen && <NotifCenter notifs={notifs} onClose={() => setNotifOpen(false)} onClear={() => { setNotifs([]); }} onMarkRead={() => setNotifs((ns) => ns.map((n) => ({ ...n, read: true })))} onNav={setRoute} />}
        {signedOut && <SignedOut onBack={() => setSignedOut(false)} />}
        <ShellToast msg={toast} kind={toastKind} />
      </div>
    </ScaledStage>
  );
}

window.App = App;
