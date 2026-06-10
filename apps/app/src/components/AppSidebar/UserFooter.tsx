import { Keyboard, LogOut, Moon, Settings, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Icon } from "@/components/primitives";
import { signOut, useSession } from "@/integrations/better-auth-client";

const useOutsidePointerDown = (onOutside: () => void) => {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;

      onOutside();
    };

    globalThis.addEventListener("pointerdown", handlePointerDown);

    return () => globalThis.removeEventListener("pointerdown", handlePointerDown);
  }, [onOutside]);

  return ref;
};

const getInitial = (value?: string | null) => {
  return value?.trim().slice(0, 1).toUpperCase() || "W";
};

export const UserFooter = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: session } = useSession();
  const userName = session?.user.name || "Wei Chen";
  const userEmail = session?.user.email || "local@ordine.local";
  const ref = useOutsidePointerDown(() => setOpen(false));

  const handleOpenToggle = () => {
    setOpen((value) => !value);
  };
  const handleMenuClose = () => {
    setOpen(false);
  };
  const handleSignOutClick = async () => {
    await signOut();
    await navigate({ to: "/login" });
  };

  return (
    <div ref={ref} className="relative border-t border-border/70 p-2">
      {open ? (
        <div className="fade-rise absolute bottom-full left-2 right-2 z-40 mb-1 rounded-xl bg-surface p-1.5 shadow-float ring-1 ring-border-strong">
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-accent/60"
            type="button"
            onClick={handleMenuClose}
          >
            <Icon className="text-muted-foreground" icon={User} size={13} />
            Account settings
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-accent/60"
            type="button"
            onClick={handleMenuClose}
          >
            <Icon className="text-muted-foreground" icon={Keyboard} size={13} />
            Keyboard shortcuts
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-accent/60"
            type="button"
            onClick={handleMenuClose}
          >
            <Icon className="text-muted-foreground" icon={Moon} size={13} />
            Appearance
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-accent/60"
            type="button"
            onClick={handleSignOutClick}
          >
            <Icon className="text-muted-foreground" icon={LogOut} size={13} />
            Sign out
          </button>
        </div>
      ) : null}
      <div className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-accent/60">
        <button
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          type="button"
          onClick={handleOpenToggle}
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold">
            {getInitial(userName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-medium leading-tight">{userName}</div>
            <div className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              {userEmail}
            </div>
          </div>
        </button>
        <Link
          aria-label="Settings"
          className="rounded p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          to="/settings"
          onClick={handleMenuClose}
        >
          <Icon icon={Settings} size={14} />
        </Link>
      </div>
    </div>
  );
};
