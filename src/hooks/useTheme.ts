import { useEffect } from "react";
import { useStore } from "@/store";

export function useTheme(): ["dark" | "light", () => void] {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = theme;
  }, [theme]);

  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  return [theme, toggle];
}
