import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ThemeApplier, ThemeStoreProvider } from "../../store/themeStore";

export type AuthShellProps = {
  children: ReactNode;
};

export const AuthShell = ({ children }: AuthShellProps) => {
  const { t } = useTranslation();

  return (
    <ThemeStoreProvider>
      <ThemeApplier />
      <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-canvas px-4 py-8 sm:px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,var(--border)_1px,transparent_1px)] bg-size-[24px_24px] opacity-45 [mask-image:linear-gradient(to_bottom,black,transparent_78%)]"
        />
        <div className="relative w-full max-w-[400px]">
          <div className="mb-5 flex items-center justify-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground shadow-soft">
              O
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-[-0.01em]">Ordine Studio</div>
              <div className="text-[10.5px] text-muted-foreground">{t("auth.workspace")}</div>
            </div>
          </div>
          {children}
          <p className="mt-4 text-center text-[11px] text-muted-foreground/80">
            {t("auth.secureWorkspace")}
          </p>
        </div>
      </main>
    </ThemeStoreProvider>
  );
};
