export type InitialThemePreference = "dark" | "light" | "system";

export const resolveInitialThemeIsDark = (
  preference: InitialThemePreference,
  prefersDark: boolean,
) => preference === "dark" || (preference === "system" && prefersDark);

export const themeInitializationScript = `(()=>{try{const raw=localStorage.getItem("ordine.theme");const parsed=raw?JSON.parse(raw):null;const preference=parsed?.state?.preference??"system";const dark=preference==="dark"||(preference==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light"}catch{}})();`;
