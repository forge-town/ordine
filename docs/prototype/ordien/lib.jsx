/* ——— lib.jsx · Icon + shared primitives (exported to window) ——— */
const { useState, useEffect, useRef } = React;

/* Icon: renders inline SVG from Lucide UMD icon data, fully React-controlled. */
function Icon({ name, className = "", size = 16, stroke = 2, style }) {
  const lib = (window.lucide && (window.lucide.icons || window.lucide)) || {};
  let data = lib[name];
  // lucide UMD sometimes nests as { default: IconNode } or [tag, attrs, children]
  if (data && data.default) data = data.default;
  let children = data;
  if (Array.isArray(data) && data.length === 3 && data[0] === "svg") children = data[2];
  if (!Array.isArray(children)) {
    return (
      <svg className={className} width={size} height={size} viewBox="0 0 24 24" style={style} />
    );
  }
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      {children.map((c, i) => React.createElement(c[0], { key: i, ...c[1] }))}
    </svg>
  );
}

/* Status → wash class + lucide icon name + label */
const STATUS = {
  idle:           { cls: "status-wash-muted",   icon: "Circle",       label: "Idle" },
  queued:         { cls: "status-wash-muted",   icon: "Clock",        label: "Queued" },
  running:        { cls: "status-wash-muted",   icon: "LoaderCircle", label: "Running", spin: true },
  retrying:       { cls: "status-wash-muted",   icon: "RotateCw",     label: "Retrying", spin: true },
  waitingForUser: { cls: "status-wash-muted",   icon: "CircleDot",    label: "Awaiting you" },
  paused:         { cls: "status-wash-muted",   icon: "Pause",        label: "Paused" },
  done:           { cls: "status-wash-success", icon: "CircleCheck",  label: "Done" },
  completed:      { cls: "status-wash-success", icon: "CircleCheck",  label: "Completed" },
  connected:      { cls: "status-wash-success", icon: "CircleCheck",  label: "Connected" },
  pass:           { cls: "status-wash-success", icon: "CircleCheck",  label: "Passed" },
  failed:         { cls: "status-wash-error",   icon: "CircleAlert",  label: "Failed" },
  error:          { cls: "status-wash-error",   icon: "CircleAlert",  label: "Error" },
  skipped:        { cls: "status-wash-muted",   icon: "SkipForward",  label: "Skipped" },
  cancelled:      { cls: "status-wash-muted",   icon: "Ban",          label: "Cancelled" },
};

function StatusPill({ status, className = "" }) {
  const s = STATUS[status] || STATUS.idle;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${s.cls} ${className}`}>
      <Icon name={s.icon} size={10} className={s.spin ? "spin" : ""} />
      {s.label}
    </span>
  );
}

/* small colored dot (green/red/neutral) */
function Dot({ tone = "muted", ping = false }) {
  const bg = tone === "success" ? "bg-success" : tone === "error" ? "bg-destructive" : "bg-foreground/55";
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {ping && <span className={`absolute inline-flex h-full w-full rounded-full ${bg} opacity-40 ping`} />}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${bg}`} />
    </span>
  );
}

/* page shell header used by all list pages */
function PageHeader({ eyebrow, title, sub, actions, children }) {
  return (
    <div className="flex items-start justify-between gap-4 px-7 pt-6 pb-4">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[21px] font-semibold leading-tight tracking-tightish">{title}</h1>
        {sub && <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">{sub}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* primary / ghost buttons */
function Btn({ children, icon, variant = "ghost", size = "md", className = "", ...p }) {
  const base = "inline-flex items-center gap-1.5 rounded-xl font-medium transition-all select-none";
  const sz = size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3 py-1.5 text-[12.5px]";
  const variants = {
    solid: "bg-foreground text-primary-foreground hover:opacity-90 shadow-sm",
    ghost: "bg-surface text-foreground ring-1 ring-border hover:ring-border-strong hover:bg-accent/40",
    subtle: "bg-surface-2 text-foreground hover:bg-accent",
    quiet: "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
  };
  return (
    <button className={`${base} ${sz} ${variants[variant]} ${className}`} {...p}>
      {icon && <Icon name={icon} size={size === "sm" ? 13 : 14} />}
      {children}
    </button>
  );
}

/* search input */
function SearchInput({ placeholder = "Search…", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <Icon name="Search" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        placeholder={placeholder}
        className="w-full rounded-xl bg-surface-2 py-1.5 pl-8.5 pr-3 text-[12.5px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-border-strong"
        style={{ paddingLeft: "2.1rem" }}
      />
    </div>
  );
}

/* filter chip row */
function Chip({ children, active = false, onClick, count }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] transition-colors ${
        active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      }`}
    >
      {children}
      {count != null && (
        <span className={`rounded-full px-1.5 text-[10px] ${active ? "bg-surface text-foreground" : "bg-surface-2"}`}>{count}</span>
      )}
    </button>
  );
}

/* tiny labelled stat */
function Stat({ label, value, sub, tone }) {
  const valTone = tone === "success" ? "text-success" : tone === "error" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-border shadow-soft">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-[24px] font-semibold leading-none tracking-tightish ${valTone}`}>{value}</div>
      {sub && <div className="mt-1.5 text-[11.5px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

/* tag pill */
function Tag({ children }) {
  return <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-mono text-muted-foreground">{children}</span>;
}

Object.assign(window, { Icon, StatusPill, STATUS, Dot, PageHeader, Btn, SearchInput, Chip, Stat, Tag });
