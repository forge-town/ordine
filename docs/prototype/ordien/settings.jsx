/* ——— settings.jsx · Settings content (one panel at a time; the group nav lives in the app Sidebar) ——— */
const { useState: useStateST, useEffect: useEffectST, useRef: useRefST } = React;
const { Icon: STIcon, Btn: STBtn, PageHeader: STPageHeader } = window;

const SETTINGS_KEY = "ordine.settings";
const SETTINGS_DEFAULT = {
  lang: "en",
  startup: "workspace",
  defaultRuntime: "Claude Code",
  defaultModel: "Sonnet 4.6",
  apiKey: "sk-ord-2f9a••••••••••••3b71",
  outputPath: "~/ordine/out",
};
function loadSettings() {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) return { ...SETTINGS_DEFAULT, ...JSON.parse(s) };
  } catch (e) {}
  return { ...SETTINGS_DEFAULT };
}

const SETTINGS_GROUPS = [
  {
    key: "general",
    label: "General",
    icon: "Settings2",
    sub: "Language, appearance, and where Ordine opens.",
  },
  {
    key: "defaults",
    label: "Defaults",
    icon: "Sliders",
    sub: "What the Agent Bar reaches for first when assembling an executor.",
  },
  {
    key: "project",
    label: "Project",
    icon: "FolderKanban",
    sub: "Name, description, and lifecycle for this workspace.",
  },
  {
    key: "keyboard",
    label: "Keyboard",
    icon: "Keyboard",
    sub: "Canvas shortcuts. Read-only for now.",
  },
  {
    key: "account",
    label: "Account",
    icon: "User",
    sub: "Local-mode identity — no cloud account.",
  },
  {
    key: "advanced",
    label: "Advanced",
    icon: "Wrench",
    sub: "Storage, data version, and maintenance.",
  },
];

/* ------------------------------- small controls ------------------------------- */
function StRow({ title, hint, children, danger }) {
  return (
    <div className="flex items-start gap-4 py-3.5">
      <div className="min-w-0 flex-1 pt-0.5">
        <div
          className={`text-[12.5px] font-medium tracking-tightish ${danger ? "text-destructive" : ""}`}
        >
          {title}
        </div>
        {hint && (
          <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</div>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
function Panel({ children }) {
  return (
    <div className="divide-y divide-border/70 rounded-2xl bg-surface px-4 ring-1 ring-border shadow-soft">
      {children}
    </div>
  );
}
function StSeg({ options, value, onChange }) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors ${value === o.v ? "bg-surface text-foreground shadow-soft ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}
        >
          {o.icon && <STIcon name={o.icon} size={13} />} {o.label}
        </button>
      ))}
    </div>
  );
}
function StSelect({ value, onChange, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none rounded-xl bg-surface-2 py-1.5 pl-3 pr-8 text-[12px] font-medium ring-1 ring-border focus:outline-none focus:ring-border-strong"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <STIcon
        name="ChevronDown"
        size={13}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  );
}
function StText({ value, onChange, mono, w = 220, placeholder }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: w }}
      className={`rounded-xl bg-surface-2 px-3 py-1.5 text-[12px] ring-1 ring-border focus:outline-none focus:ring-border-strong ${mono ? "font-mono text-[11.5px]" : ""}`}
    />
  );
}

const ROUTE_LABELS = ["Open pipeline", "Pipelines", "Jobs", "Usage"];
const SHORTCUTS = [
  [
    "Editing",
    [
      ["Undo", "⌘ Z"],
      ["Redo", "⌘ ⇧ Z"],
      ["Copy nodes", "⌘ C"],
      ["Paste nodes", "⌘ V"],
      ["Duplicate", "⌘ D"],
      ["Delete selection", "⌫ / Del"],
    ],
  ],
  [
    "Navigation",
    [
      ["Drill out of compound", "Esc"],
      ["Clear selection", "Esc"],
      ["Box-select", "drag on canvas"],
      ["Pan", "Space-drag / middle-drag"],
      ["Zoom", "⌘ scroll"],
    ],
  ],
];

/* ---------------------------------- page ---------------------------------- */
function SettingsPage({
  notify,
  onNav,
  theme,
  setTheme,
  anchor,
  projects,
  proj,
  setProjects,
  onSignOut,
  onClearNotifs,
}) {
  const [s, setS] = useState(loadSettings);
  const [keyShown, setKeyShown] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const set = (patch) =>
    setS((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch (e) {}
      return next;
    });

  const project = (projects || []).find((p) => p.id === proj) ||
    (projects || [])[0] || { id: "p1", name: "Project", desc: "" };
  const setProject = (patch) =>
    setProjects &&
    setProjects((ps) => ps.map((p) => (p.id === project.id ? { ...p, ...patch } : p)));

  const active = anchor || "general";
  const group = SETTINGS_GROUPS.find((g) => g.key === active) || SETTINGS_GROUPS[0];
  const ConfirmDialog = window.ConfirmDialog;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <STPageHeader
        eyebrow="Settings"
        title={group.label}
        sub={active === "project" ? `Editing “${project.name}”.` : group.sub}
      />
      <div className="min-h-0 flex-1 overflow-y-auto px-7 pb-12">
        <div className="max-w-2xl">
          {active === "general" && (
            <Panel>
              <StRow title="Interface language" hint="Applies across the whole app.">
                <StSeg
                  value={s.lang}
                  onChange={(v) => {
                    set({ lang: v });
                    notify(v === "zh" ? "界面语言切换为中文" : "Language set to English");
                  }}
                  options={[
                    { v: "en", label: "English" },
                    { v: "zh", label: "中文" },
                  ]}
                />
              </StRow>
              <StRow
                title="Appearance"
                hint={
                  theme === "light"
                    ? "Light theme is fully styled."
                    : "Dark theme is in preview — the surface stays light for now."
                }
              >
                <div className="flex flex-col items-end gap-1.5">
                  <StSeg
                    value={theme}
                    onChange={(v) => {
                      setTheme(v);
                      notify(
                        v === "light"
                          ? "Light appearance"
                          : v === "dark"
                            ? "Dark — preview"
                            : "Following system",
                      );
                    }}
                    options={[
                      { v: "light", label: "Light", icon: "Sun" },
                      { v: "dark", label: "Dark", icon: "Moon" },
                      { v: "system", label: "System", icon: "Monitor" },
                    ]}
                  />
                  {theme !== "light" && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <STIcon name="Hammer" size={10} /> dark surfaces coming soon
                    </span>
                  )}
                </div>
              </StRow>
              <StRow title="Startup page" hint="Where the window lands when you open Ordine.">
                <StSelect
                  value={s.startup}
                  onChange={(v) => set({ startup: v })}
                  options={ROUTE_LABELS}
                />
              </StRow>
            </Panel>
          )}

          {active === "defaults" && (
            <Panel>
              <StRow
                title="Default Local Agent"
                hint="Used for new Operations unless you pick another."
              >
                <StSelect
                  value={s.defaultRuntime}
                  onChange={(v) => set({ defaultRuntime: v })}
                  options={window.CANVAS_AGENTS || ["Claude Code", "Codex", "Hermes"]}
                />
              </StRow>
              <StRow title="Default model">
                <StSelect
                  value={s.defaultModel}
                  onChange={(v) => set({ defaultModel: v })}
                  options={["Sonnet 4.6", "Opus 4.1", "gpt-5.1-codex", "hermes-4 · 70B"]}
                />
              </StRow>
              <StRow title="API key" hint="Stored locally and masked. Reset to rotate it.">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-xl bg-surface-2 px-3 py-1.5 font-mono text-[11.5px] ring-1 ring-border">
                    {keyShown ? "sk-ord-2f9a-LIVE-key-3b71" : s.apiKey}
                  </span>
                  <button
                    onClick={() => setKeyShown((v) => !v)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    title={keyShown ? "Hide" : "Reveal"}
                  >
                    <STIcon name={keyShown ? "EyeOff" : "Eye"} size={14} />
                  </button>
                  <button
                    onClick={() => {
                      set({
                        apiKey:
                          "sk-ord-" +
                          Math.random().toString(36).slice(2, 6) +
                          "••••••••••••" +
                          Math.random().toString(36).slice(2, 6),
                      });
                      setKeyShown(false);
                      notify("API key rotated");
                    }}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    title="Reset key"
                  >
                    <STIcon name="RefreshCw" size={14} />
                  </button>
                </div>
              </StRow>
              <StRow
                title="Default output path"
                hint="Where runs write artifacts when no destination is set."
              >
                <StText
                  value={s.outputPath}
                  onChange={(v) => set({ outputPath: v })}
                  mono
                  w={220}
                />
              </StRow>
            </Panel>
          )}

          {active === "project" && (
            <Panel>
              <StRow title="Project name">
                <StText value={project.name} onChange={(v) => setProject({ name: v })} w={260} />
              </StRow>
              <StRow title="Description" hint="Shown in the project switcher.">
                <StText
                  value={project.desc || ""}
                  onChange={(v) => setProject({ desc: v })}
                  placeholder="What this workspace is for…"
                  w={300}
                />
              </StRow>
              <StRow
                title="Archive project"
                hint="Hides it from the switcher. You can restore it later."
              >
                <button
                  onClick={() => notify(`“${project.name}” archived`)}
                  className="rounded-xl bg-surface-2 px-3 py-1.5 text-[12px] font-medium ring-1 ring-border hover:bg-accent/60"
                >
                  Archive
                </button>
              </StRow>
            </Panel>
          )}

          {active === "keyboard" && (
            <Panel>
              <div className="py-3">
                <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                  {SHORTCUTS.map(([grp, rows]) => (
                    <div key={grp}>
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                        {grp}
                      </div>
                      <div className="space-y-1.5">
                        {rows.map(([label, keys]) => (
                          <div key={label} className="flex items-center justify-between gap-3">
                            <span className="text-[12px] text-foreground/85">{label}</span>
                            <kbd className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted-foreground ring-1 ring-border">
                              {keys}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          )}

          {active === "account" && (
            <Panel>
              <StRow title="Identity" hint="Shown on annotations and run history.">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-[13px] font-semibold text-primary-foreground">
                    W
                  </span>
                  <div className="text-[12.5px]">
                    <div className="font-medium">Wei Chen</div>
                    <div className="text-[10.5px] text-muted-foreground">
                      Local mode · this machine
                    </div>
                  </div>
                </div>
              </StRow>
              <StRow
                title="Sign out"
                hint="Ends this local session. Your data stays on the machine."
              >
                <button
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-destructive ring-1 ring-border hover:bg-destructive/10"
                >
                  <STIcon name="LogOut" size={13} /> Sign out
                </button>
              </StRow>
            </Panel>
          )}

          {active === "advanced" && (
            <Panel>
              <StRow
                title="Data directory"
                hint="All local pipelines, runs, and conversations live here."
              >
                <span className="rounded-xl bg-surface-2 px-3 py-1.5 font-mono text-[11.5px] text-muted-foreground ring-1 ring-border">
                  ~/Library/Ordine
                </span>
              </StRow>
              <StRow title="Schema version" hint="Local database migration version.">
                <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  M1 · v7
                </span>
              </StRow>
              <StRow
                title="Clear conversation history"
                hint="Removes saved Agent Bar threads. Pipelines are kept."
              >
                <button
                  onClick={onClearNotifs}
                  className="rounded-xl bg-surface-2 px-3 py-1.5 text-[12px] font-medium ring-1 ring-border hover:bg-accent/60"
                >
                  Clear
                </button>
              </StRow>
              <StRow
                danger
                title="Reset all local data"
                hint="Deletes every pipeline, run, and setting on this machine. Cannot be undone."
              >
                <button
                  onClick={() => setConfirm("reset")}
                  className="rounded-xl px-3 py-1.5 text-[12px] font-medium text-primary-foreground hover:opacity-90"
                  style={{ background: "var(--c-destructive)" }}
                >
                  Reset…
                </button>
              </StRow>
            </Panel>
          )}
        </div>
      </div>

      {confirm === "reset" && ConfirmDialog && (
        <ConfirmDialog
          title="Reset all local data?"
          body="This permanently deletes every pipeline, run, conversation, and setting stored on this machine. There is no undo."
          confirmLabel="Reset everything"
          onConfirm={() => {
            setConfirm(null);
            notify("Local data reset (demo — nothing was actually deleted)", "warn");
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

window.SettingsPage = SettingsPage;
window.SETTINGS_GROUPS = SETTINGS_GROUPS;
