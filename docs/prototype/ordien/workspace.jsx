/* ——— workspace.jsx · the open-pipeline view: Agent Bar + Workspace orchestrator.
       Annotations are unified into the conversation as node-anchored messages (Lovable-style
       select-to-context). Canvas + all canvas interactions live in canvas.jsx. ——— */
const { useState, useEffect, useRef } = React;
const { Icon, StatusPill, Dot, Btn } = window;

const KIND_ICON = { node: "Box", edge: "ArrowRightLeft" };
function refIcon(r) {
  return r.type === "edge" ? "ArrowRightLeft" : "Box";
}

/* a row of @-reference chips — hover highlights the node on canvas, click fits to it */
function RefChips({ refs, onHover, onFocus, onRemove, small }) {
  if (!refs || !refs.length) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${small ? "" : "pb-1.5"}`}>
      {refs.map((r) => (
        <span
          key={r.id}
          onMouseEnter={() => onHover && onHover(r.id)}
          onMouseLeave={() => onHover && onHover(null)}
          onClick={() => onFocus && onFocus(r)}
          className={`group inline-flex max-w-[180px] cursor-pointer items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium ring-1 ring-transparent transition-all hover:ring-border-strong ${small ? "bg-foreground/10" : ""}`}
          title="Hover to highlight · click to focus on canvas"
        >
          <Icon name={refIcon(r)} size={9} className="shrink-0 text-foreground/60" />
          <span className="truncate">{r.label}</span>
          {onRemove && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(r.id);
              }}
              className="ml-0.5 shrink-0 rounded-full p-0.5 hover:bg-foreground/10"
            >
              <Icon name="X" size={9} />
            </button>
          )}
        </span>
      ))}
    </div>
  );
}

function Bubble({ m, onHover, onFocus }) {
  return (
    <div className="flex flex-col items-end gap-1">
      {m.atts && m.atts.length > 0 && (
        <div className="flex max-w-[88%] flex-wrap justify-end gap-1">
          {m.atts.map((a, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[10px] text-muted-foreground ring-1 ring-border"
            >
              <Icon name="Paperclip" size={9} /> {a.name}
            </span>
          ))}
        </div>
      )}
      <div className="max-w-[88%] rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-[12px] leading-relaxed text-primary-foreground">
        {m.text}
      </div>
      {m.refs && m.refs.length > 0 && (
        <div className="max-w-[88%]">
          <RefChips refs={m.refs} onHover={onHover} onFocus={onFocus} small />
        </div>
      )}
    </div>
  );
}
function Assistant({ children }) {
  return <div className="text-[12px] leading-relaxed text-foreground/90">{children}</div>;
}

/* minimal (Codex-style) body — same phases as AgentBody, zero card chrome */
function AgentBodyMin({ phase, setPhase, onRevise, onReject, onOpenSkill, onReverse, onNav }) {
  const [healOpen, setHealOpen] = useState(false);
  const A = Assistant;

  if (phase === "empty") {
    return (
      <>
        <A>
          New canvas — tell me what to make, or drop a finished sample and I’ll reverse-engineer the
          pipeline behind it.
        </A>
        <div className="space-y-0.5">
          {[
            ["Turn my textbook PDFs into a Notion quiz", false],
            ["Summarize a GitHub repo into a changelog", false],
            ["Upload a finished sample → reverse-engineer it", true],
          ].map(([s, rev]) => (
            <button
              key={s}
              onClick={() =>
                rev ? (onReverse ? onReverse() : setPhase("reversing")) : setPhase("clarify")
              }
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] text-foreground/75 transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              <Icon
                name={rev ? "FileUp" : "CornerDownRight"}
                size={12}
                className="shrink-0 text-muted-foreground"
              />
              <span className="flex-1">{s}</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  const userMsg = (
    <Bubble
      m={{
        text: "I want to turn the textbook PDFs in this folder into a vocabulary quiz that lives in my Notion study DB.",
      }}
    />
  );

  if (phase === "reversing") {
    return (
      <>
        <div className="flex justify-end">
          <div className="max-w-[88%] rounded-2xl rounded-br-md bg-foreground px-3 py-2 text-[12px] leading-relaxed text-primary-foreground">
            <div className="mb-1 flex items-center gap-1.5 text-[10.5px] opacity-80">
              <Icon name="FileCheck2" size={11} /> vocab-quiz-sample.pdf
            </div>
            Here’s a finished quiz I made by hand — can you rebuild the pipeline that produces this?
          </div>
        </div>
        <A>Reading the sample — inferring the steps that produce it.</A>
        <div className="space-y-1 border-l border-border pl-3 text-[11px]">
          {[
            ["Read structure", "20 MCQs · 4 options · source citations", true],
            ["Inferred steps", "parse → generate → verify → export", true],
            ["Matched components", "2 reusable from your library", true],
            ["Drafting pipeline", "5 nodes · 4 edges", false],
          ].map(([a, b, done]) => (
            <div key={a} className="flex items-center gap-1.5">
              {done ? (
                <Icon
                  name="Check"
                  size={11}
                  className="shrink-0"
                  style={{ color: "var(--c-success)" }}
                />
              ) : (
                <Icon
                  name="LoaderCircle"
                  size={11}
                  className="spin shrink-0 text-muted-foreground"
                />
              )}
              <span className="font-medium">{a}</span>
              <span className="truncate text-muted-foreground">— {b}</span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setPhase("proposal")}
          className="inline-flex items-center gap-1 text-[11.5px] font-medium underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
        >
          See the proposed pipeline <Icon name="ArrowRight" size={11} />
        </button>
      </>
    );
  }

  if (phase === "clarify") {
    return (
      <>
        {userMsg}
        <A>
          Before I draft it — vocab only, or <strong>vocab + grammar</strong>? And do you want an{" "}
          <strong>adversarial verify step</strong> before it lands in Notion?
        </A>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["Vocab only", 0],
            ["Vocab + grammar", 1],
            ["+ Verify step", 1],
            ["Skip verify", 0],
          ].map(([c, on], i) => (
            <button
              key={c + i}
              onClick={() => setPhase("proposal")}
              className={`rounded-full px-2.5 py-1 text-[11px] ring-1 transition-colors ${on ? "bg-accent ring-border-strong" : "bg-surface ring-border hover:bg-accent/60"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </>
    );
  }

  if (phase === "proposal") {
    return (
      <>
        {userMsg}
        <A>
          Here’s a 5-node pipeline that does it end-to-end — it reuses your{" "}
          <strong>Parse PDF</strong> and <strong>Notion DB</strong> components. Preview is on the
          canvas.
        </A>
        <div className="space-y-1 border-l border-border pl-3 text-[11.5px]">
          {[
            ["Source · Textbook PDFs", "Input · Folder"],
            ["Parse & Extract", "Op · parser.skill on Claude Code"],
            ["Generate Vocab Quiz", "Op · Codex"],
            ["Adversarial Verify", "Compound · Generator ↔ Critic"],
            ["Export to Notion", "Connector · notion-mcp"],
          ].map(([a, b]) => (
            <div key={a}>
              <span className="font-medium">{a}</span>
              <span className="text-muted-foreground"> — {b}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <button
            onClick={() => setPhase("applied")}
            className="rounded-lg bg-foreground px-3 py-1.5 text-[11.5px] font-medium text-primary-foreground hover:opacity-90"
          >
            Apply
          </button>
          <button
            onClick={onRevise}
            className="rounded-lg px-2.5 py-1.5 text-[11.5px] text-foreground/80 ring-1 ring-border hover:bg-accent/60"
          >
            Revise
          </button>
          <button
            onClick={onReject}
            className="rounded-lg px-2 py-1.5 text-[11.5px] text-muted-foreground hover:bg-accent/60"
          >
            Reject
          </button>
        </div>
      </>
    );
  }

  if (phase === "applied") {
    return (
      <>
        {userMsg}
        <A>
          Applied — 5 nodes are on the canvas, yours to edit. <strong>Click any node</strong> to
          reference it here, double-click Verify to drill into the generate-critic loop, or hit{" "}
          <strong>Run</strong>.
        </A>
      </>
    );
  }

  if (phase === "running") {
    return (
      <>
        {userMsg}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Dot tone="muted" ping /> <span className="font-mono">job_8f2a</span> · step 3/5 · 14.6s ·
          $0.14
        </div>
        <div>
          <button
            onClick={() => setHealOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 text-left text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon name="RefreshCw" size={11} /> Self-healed the Parse step · round 2{" "}
            <Icon name={healOpen ? "ChevronDown" : "ChevronRight"} size={11} />
          </button>
          {healOpen && (
            <ol className="mt-1.5 space-y-1 border-l border-border pl-3 text-[11px] text-muted-foreground">
              <li>① 8k chunk → context overflow on file 3.</li>
              <li>② Switched to 4k chunk → succeeded, kept the operation.</li>
              <li className="text-foreground">✓ Continuing with the working configuration.</li>
            </ol>
          )}
        </div>
        <A>
          <strong>Notion connector needs a token</strong> — the Export step can’t reach your study
          DB yet.{" "}
          <button
            onClick={() => onNav && onNav("connectors")}
            className="font-medium underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
          >
            Connect Notion
          </button>{" "}
          and I’ll pick it back up.
        </A>
      </>
    );
  }

  return (
    <>
      {userMsg}
      <A>
        Done in 41.3s · $0.31 — exported <strong>20 vocabulary + grammar questions</strong> to
        Notion → <span className="font-mono text-muted-foreground">Study Materials</span>. Verify
        caught 3 weak distractors and rewrote them.
      </A>
      <button
        onClick={onOpenSkill}
        className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icon name="Sparkles" size={11} /> Saved as a Pipeline Skill — open in Components{" "}
        <Icon name="ArrowRight" size={11} />
      </button>
    </>
  );
}

/* a composer-driven conversation turn (also used inside a node thread, with a resolve action) */
function ConvoTurn({ m, idx, onHover, onFocus, thread, onResolve }) {
  if (m.role === "user") {
    return (
      <div className="group/turn relative">
        <Bubble m={m} onHover={onHover} onFocus={onFocus} />
        {thread && !m.resolved && (
          <button
            onClick={() => onResolve(idx)}
            title="Resolve"
            className="absolute -left-1 top-1 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/turn:opacity-100"
          >
            <Icon name="Check" size={12} />
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="group/turn relative space-y-1.5">
      <div className="text-[12px] leading-relaxed text-foreground/90">
        {m.thinking ? (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <Icon name="LoaderCircle" size={11} className="spin" /> {m.text}
          </span>
        ) : (
          m.text
        )}
      </div>
      {m.refs && m.refs.length > 0 && (
        <RefChips refs={m.refs} onHover={onHover} onFocus={onFocus} small />
      )}
      {thread && !m.resolved && !m.thinking && (
        <button
          onClick={() => onResolve(idx)}
          title="Resolve"
          className="absolute -left-1 top-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover/turn:opacity-100"
        >
          <Icon name="Check" size={12} />
        </button>
      )}
    </div>
  );
}

/* Spec 3.3 · context payload carried with every message — now driven by real selection + anchors */
function ContextStrip({ phase, refs, anchorCount, hasConvo }) {
  const [open, setOpen] = useState(false);
  const running = phase === "running";
  const refLabel = refs.length ? refs.map((r) => r.label).join(", ") : "";
  const items = [
    { label: "Project info", rule: "always", on: true, dim: false },
    { label: "Pipeline snapshot", rule: "always", on: true, dim: running },
    { label: "Conversation thread", rule: "windowed", on: true, dim: false },
    {
      label: refs.length ? `Selection · ${refLabel}` : "Selection",
      rule: "when selected",
      on: refs.length > 0,
      dim: false,
    },
    {
      label: anchorCount ? `Canvas annotations · ${anchorCount}` : "Canvas annotations",
      rule: "when present",
      on: anchorCount > 0,
      dim: false,
    },
    {
      label: "Run state · job_8f2a",
      rule: "run-time priority",
      on: running,
      dim: false,
      hot: running,
    },
    { label: "Node runtime", rule: "run-time priority", on: running, dim: false, hot: running },
    { label: "Memory summary", rule: "always · compressed", on: hasConvo, dim: true },
  ];
  const active = items.filter((i) => i.on);
  return (
    <div className="px-3 pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[10px] text-muted-foreground hover:bg-accent/50"
      >
        <Icon name="Layers" size={11} />
        <span className="font-medium">Context</span>
        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[9px]">
          {active.length} items
        </span>
        <span className="truncate text-foreground/45">
          {running
            ? "prioritizing run + runtime"
            : refs.length
              ? "+ selection"
              : anchorCount
                ? "+ annotations"
                : "canvas + thread"}
        </span>
        <Icon name={open ? "ChevronDown" : "ChevronUp"} size={11} className="ml-auto" />
      </button>
      {open && (
        <div className="mt-1 space-y-0.5 rounded-xl bg-surface-2 p-2 ring-1 ring-border fade-rise">
          {items.map((it) => (
            <div
              key={it.label}
              className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-[10.5px] ${it.on ? "" : "opacity-40"}`}
            >
              <span className="flex h-3 w-3 items-center justify-center">
                {it.on ? (
                  <span
                    className="h-[7px] w-[7px] rounded-full"
                    style={{
                      background: it.hot
                        ? "var(--c-fg)"
                        : it.dim
                          ? "color-mix(in oklab, var(--c-fg) 35%, transparent)"
                          : "var(--c-success)",
                    }}
                  />
                ) : (
                  <span className="h-[7px] w-[7px] rounded-full ring-1 ring-inset ring-border-strong" />
                )}
              </span>
              <span
                className={`flex-1 truncate ${it.hot ? "font-medium text-foreground" : "text-foreground/80"}`}
              >
                {it.label}
              </span>
              <span className="shrink-0 font-mono text-[9px] text-muted-foreground/70">
                {it.rule}
              </span>
            </div>
          ))}
          <div className="px-1.5 pt-1 text-[9px] leading-snug text-muted-foreground/70">
            Window budget selects by state ·{" "}
            {running
              ? "run-time prioritizes Run / runtime"
              : "editing prioritizes Canvas / selection"}
            .
          </div>
        </div>
      )}
    </div>
  );
}

function Composer({
  refs,
  phase,
  onRemoveRef,
  onSend,
  onHoverRef,
  onFocusRef,
  focusNonce,
  anchorCount,
  hasConvo,
}) {
  const [text, setText] = useState("");
  const [atts, setAtts] = useState([]);
  const ref = useRef(null);
  const fileRef = useRef(null);
  useEffect(() => {
    if (focusNonce && ref.current) ref.current.focus();
  }, [focusNonce]);
  const submit = () => {
    const t = text.trim();
    if (!t && !atts.length) return;
    onSend(t || "(see attachment)", atts);
    setText("");
    setAtts([]);
    if (ref.current) ref.current.style.height = "auto";
  };
  const onFiles = (e) => {
    const files = Array.from(e.target.files || []).map((f) => ({ name: f.name, size: f.size }));
    if (files.length) setAtts((a) => [...a, ...files]);
    e.target.value = "";
  };
  return (
    <div className="border-t border-border/70">
      <ContextStrip phase={phase} refs={refs} anchorCount={anchorCount} hasConvo={hasConvo} />
      <div className="p-3 pt-2">
        {refs.length > 0 && (
          <RefChips refs={refs} onHover={onHoverRef} onFocus={onFocusRef} onRemove={onRemoveRef} />
        )}
        {atts.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pb-1.5">
            {atts.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[10px] ring-1 ring-border"
              >
                <Icon name="Paperclip" size={9} className="text-muted-foreground" />{" "}
                <span className="max-w-[120px] truncate">{a.name}</span>
                <button
                  onClick={() => setAtts((cur) => cur.filter((_, j) => j !== i))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10"
                >
                  <Icon name="X" size={9} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-end gap-1.5 rounded-2xl bg-surface-2 p-2 ring-1 ring-border focus-within:ring-border-strong">
          <input ref={fileRef} type="file" multiple className="hidden" onChange={onFiles} />
          <button
            title="Attach a file or sample"
            onClick={() => fileRef.current && fileRef.current.click()}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            <Icon name="Paperclip" size={14} />
          </button>
          <textarea
            ref={ref}
            rows={1}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(96, e.target.scrollHeight) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={
              refs.length
                ? "Tell the Agent what to change here…"
                : "Describe a goal, drop a sample, or revise…"
            }
            className="flex-1 resize-none bg-transparent py-1 text-[12px] placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={submit}
            disabled={!text.trim() && !atts.length}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-opacity ${text.trim() || atts.length ? "bg-foreground text-primary-foreground hover:opacity-90" : "bg-surface-3 text-muted-foreground"}`}
          >
            <Icon name="ArrowUp" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function AgentBar({
  phase,
  setPhase,
  onCollapse,
  selRefs,
  convo,
  onSend,
  onRemoveRef,
  onRevise,
  onReject,
  onOpenSkill,
  onClear,
  onReverse,
  onNav,
  onHoverRef,
  onFocusRef,
  focusNonce,
  anchorCount,
  thread,
  onClearThread,
  onResolve,
}) {
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [convo, thread]);
  const sub = {
    empty: "New canvas · no pipeline yet",
    clarify: "Reading · goal · 1 attachment",
    proposal: "Drafting · 5 nodes proposed",
    applied: "Reading · Canvas · 5 nodes",
    running: "Watching · job_8f2a · live",
    done: "Run complete · asset saved",
  }[phase];

  // node-anchored thread view (opened from a node badge)
  const threadMsgs = thread
    ? convo
        .map((m, i) => ({ m, i }))
        .filter(({ m }) => (m.refs || []).some((r) => r.id === thread.id))
    : [];

  return (
    <aside className="flex h-full w-full flex-col bg-surface">
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${phase === "running" ? "animate-pulse bg-foreground" : "bg-success"}`}
          />
          <span className="text-[12px] font-semibold tracking-tightish">Agent</span>
          <span className="truncate text-[10.5px] text-muted-foreground">
            ·{" "}
            {selRefs.length
              ? `${selRefs.length} reference${selRefs.length > 1 ? "s" : ""} selected`
              : sub}
          </span>
        </div>
        <button
          onClick={onCollapse}
          title="Collapse"
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
        >
          <Icon name="ChevronsRight" size={14} />
        </button>
      </div>

      {thread && (
        <div className="mx-3 mb-1 flex items-center gap-2 rounded-xl bg-surface-2 px-2.5 py-1.5 ring-1 ring-border-strong fade-rise">
          <Icon name="MessageSquare" size={12} className="text-foreground/70" />
          <span className="min-w-0 flex-1 truncate text-[11px]">
            <span className="font-medium">Thread</span> · {thread.label}
          </span>
          <button
            onClick={onClearThread}
            className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            <Icon name="X" size={11} /> Show all
          </button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-3.5 overflow-y-auto px-4 py-3">
        {thread ? (
          threadMsgs.length ? (
            threadMsgs.map(({ m, i }) => (
              <ConvoTurn
                key={i}
                m={m}
                idx={i}
                onHover={onHoverRef}
                onFocus={onFocusRef}
                thread
                onResolve={onResolve}
              />
            ))
          ) : (
            <div className="grid place-items-center py-10 text-center">
              <Icon name="MessageSquareDashed" size={20} className="text-muted-foreground/50" />
              <div className="mt-2 text-[12px] font-medium">No open notes here</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                All annotations on this node are resolved.
              </div>
            </div>
          )
        ) : (
          <>
            <AgentBodyMin
              phase={phase}
              setPhase={setPhase}
              onRevise={onRevise}
              onReject={onReject}
              onOpenSkill={onOpenSkill}
              onReverse={onReverse}
              onNav={onNav}
            />
            {convo.map((m, i) => (
              <ConvoTurn key={i} m={m} idx={i} onHover={onHoverRef} onFocus={onFocusRef} />
            ))}
          </>
        )}
      </div>
      <Composer
        refs={selRefs}
        phase={phase}
        onRemoveRef={onRemoveRef}
        onSend={onSend}
        onHoverRef={onHoverRef}
        onFocusRef={onFocusRef}
        focusNonce={focusNonce}
        anchorCount={anchorCount}
        hasConvo={convo.length > 0}
      />
    </aside>
  );
}

/* ----------------------------- the workspace ----------------------------- */
const SEED_THREAD = [
  {
    role: "user",
    text: "Make the distractors harder — they’re too easy to guess.",
    refs: [{ id: "n3", type: "node", label: "Generate Vocab Quiz", kind: "Operation" }],
    ts: Date.now() - 6 * 60000,
  },
  {
    role: "agent",
    text: "Raised difficulty on Generate Vocab Quiz — tighter distractors and 3 inference questions. Open the node to see the revised prompt.",
    refs: [{ id: "n3", type: "node", label: "Generate Vocab Quiz", kind: "Operation" }],
    ts: Date.now() - 6 * 60000 + 800,
  },
];

function Workspace({
  pipe,
  onRename,
  agentOpen,
  setAgentOpen,
  rightW = 360,
  setRightW,
  ResizeHandle,
  notify,
  onNav,
}) {
  const PIPE_ID = (pipe && pipe.id) || "textbook-quiz";
  const fresh = !!(pipe && pipe.fresh);
  const CONVO_KEY = "ordine.convo.v2." + PIPE_ID;
  const [phase, setPhase] = useState(fresh ? "empty" : "applied");
  const [compOpen, setCompOpen] = useState(false);
  const [canvasRefs, setCanvasRefs] = useState([]);
  const [dismissed, setDismissed] = useState([]);
  const [convo, setConvo] = useState(() => {
    try {
      const s = localStorage.getItem(CONVO_KEY);
      if (s) return JSON.parse(s);
    } catch (e) {}
    return fresh ? [] : SEED_THREAD;
  });
  const [hoverRef, setHoverRef] = useState(null);
  const [spotlight, setSpotlight] = useState(null);
  const [thread, setThread] = useState(null);
  const [focusNonce, setFocusNonce] = useState(0);
  const Canvas = window.InteractiveCanvas;
  const rightRef = useRef(rightW);

  useEffect(() => {
    try {
      localStorage.setItem(CONVO_KEY, JSON.stringify(convo.filter((m) => !m.thinking)));
    } catch (e) {}
  }, [convo]);
  const clearConvo = () => {
    setConvo([]);
    setThread(null);
    try {
      localStorage.removeItem(CONVO_KEY);
    } catch (e) {}
    notify && notify("Conversation cleared");
  };

  const onRightDrag = (dx) => {
    const next = rightRef.current + dx;
    if (next < 248) {
      setAgentOpen(false);
      return;
    }
    setRightW && setRightW(Math.max(300, Math.min(520, next)));
  };

  // refs available to the composer = current canvas selection minus the ones the user dismissed
  useEffect(() => {
    setDismissed([]);
  }, [canvasRefs.map((r) => r.id).join("|")]);
  const refs = canvasRefs.filter((r) => !dismissed.includes(r.id));

  // node badge counts = unresolved anchored messages referencing each ref id
  const anchorCounts = React.useMemo(() => {
    const m = {};
    convo.forEach((msg) => {
      if (msg.resolved || msg.thinking) return;
      (msg.refs || []).forEach((r) => {
        m[r.id] = (m[r.id] || 0) + 1;
      });
    });
    return m;
  }, [convo]);
  const composerAnchorCount = refs.reduce((n, r) => n + (anchorCounts[r.id] || 0), 0);

  const reply = (userText, usedRefs) => {
    const r =
      usedRefs && usedRefs.length ? `Updating ${usedRefs.map((x) => x.label).join(", ")} — ` : "";
    const t = userText.toLowerCase();
    if (t.includes("hard") || t.includes("difficult"))
      return `${r}I’ll raise the difficulty: tighter distractors and a few inference questions. Open the node to see the revised prompt.`;
    if (t.includes("notion") || t.includes("connect"))
      return "You’ll need to authorize the Notion connector first — Capabilities → Connectors → Notion → Connect.";
    if (t.includes("add") || t.includes("step"))
      return `${r}Got it — I’ve sketched the extra step on the canvas as a preview node. Apply it when it looks right.`;
    return `${r}On it. I’ll adjust ${usedRefs && usedRefs.length ? "the referenced nodes" : "the pipeline"} and surface a preview on the canvas for you to apply.`;
  };

  // unified send path — composer messages carry the live selection; node "Ask" carries one ref
  const sendMessage = (text, opts = {}) => {
    const usedRefs = opts.refs || refs;
    const userMsg = { role: "user", text, ts: Date.now() };
    if (usedRefs && usedRefs.length)
      userMsg.refs = usedRefs.map((r) => ({
        id: r.id,
        type: r.type,
        label: r.label,
        kind: r.kind,
      }));
    if (opts.atts && opts.atts.length) userMsg.atts = opts.atts;
    setConvo((c) => [...c, userMsg, { role: "agent", thinking: true, text: "Thinking…" }]);
    if (usedRefs && usedRefs.length && !opts.refs)
      setDismissed((d) => [...d, ...usedRefs.map((r) => r.id)]);
    window.setTimeout(
      () =>
        setConvo((c) =>
          c.map((m, i) =>
            i === c.length - 1
              ? { role: "agent", text: reply(text, usedRefs), refs: userMsg.refs, ts: Date.now() }
              : m,
          ),
        ),
      650,
    );
  };
  const onSend = (text, atts) => sendMessage(text, { atts });
  const onAsk = (ref, text) => {
    sendMessage(text, { refs: [ref] });
    notify && notify("Asked the Agent about " + ref.label);
  };

  const onFocusRef = (r) => {
    setSpotlight({ ref: r, nonce: Date.now() });
  };
  const onOpenThread = (ref) => {
    setThread({ id: ref.id, label: ref.label });
    setSpotlight({ ref, nonce: Date.now() });
    if (!agentOpen) setAgentOpen(true);
  };
  const onAskSelection = () => {
    if (!agentOpen) setAgentOpen(true);
    setFocusNonce((n) => n + 1);
  };

  const onRevise = () => {
    setConvo((c) => [
      ...c,
      {
        role: "agent",
        text: "Sure — what should I change? You can also select nodes on the canvas and ask, and I’ll keep up.",
      },
    ]);
    notify && notify("Tell the Agent what to revise");
  };
  const onReject = () => {
    setPhase("clarify");
    setConvo([]);
    setThread(null);
    try {
      localStorage.removeItem(CONVO_KEY);
    } catch (e) {}
    notify && notify("Proposal rejected — back to clarifying");
  };
  const onOpenSkill = () => {
    notify && notify("Opening “Textbook → Notion Quiz” in Components…");
    onNav && onNav("components");
  };
  const resolveMsg = (idx) => {
    setConvo((c) => c.map((m, i) => (i === idx ? { ...m, resolved: true } : m)));
    notify && notify("Annotation resolved");
  };

  return (
    <div className="flex h-full w-full min-w-0">
      <div className="relative h-full min-w-0 flex-1">
        <Canvas
          pipe={pipe}
          onRename={onRename}
          phase={phase}
          setPhase={setPhase}
          agentOpen={agentOpen}
          setAgentOpen={setAgentOpen}
          compOpen={compOpen}
          setCompOpen={setCompOpen}
          onSelRefs={setCanvasRefs}
          anchorCounts={anchorCounts}
          hoverRef={hoverRef}
          spotlight={spotlight}
          onAsk={onAsk}
          onOpenThread={onOpenThread}
          onAskSelection={onAskSelection}
          notify={notify}
        />
      </div>
      {agentOpen && ResizeHandle && (
        <ResizeHandle
          side="right"
          line={false}
          onDelta={onRightDrag}
          onCollapse={() => setAgentOpen(false)}
        />
      )}
      {agentOpen && (
        <div
          className="h-full shrink-0 overflow-hidden panel-in py-1.5 pr-1.5"
          style={{ width: rightW }}
          onPointerDownCapture={() => {
            rightRef.current = rightW;
          }}
        >
          <div className="h-full w-full overflow-hidden rounded-2xl bg-surface ring-1 ring-border-strong shadow-float">
            <AgentBar
              phase={phase}
              setPhase={setPhase}
              onCollapse={() => setAgentOpen(false)}
              selRefs={refs}
              convo={convo}
              onSend={onSend}
              onRemoveRef={(id) => setDismissed((d) => [...d, id])}
              onRevise={onRevise}
              onReject={onReject}
              onOpenSkill={onOpenSkill}
              onClear={clearConvo}
              onNav={onNav}
              onHoverRef={setHoverRef}
              onFocusRef={onFocusRef}
              focusNonce={focusNonce}
              anchorCount={composerAnchorCount}
              thread={thread}
              onClearThread={() => setThread(null)}
              onResolve={resolveMsg}
            />
          </div>
        </div>
      )}
    </div>
  );
}

window.Workspace = Workspace;
