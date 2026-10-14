import { useEffect, useState } from "react";

// Matches the original's auto breakpoints: phone < 768, tablet < 1280, else desktop.
export function useLayout() {
  const get = () => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1440;
    return w < 768 ? "phone" : w < 1280 ? "tablet" : "desktop";
  };
  const [layout, setLayout] = useState(get);
  useEffect(() => {
    const onResize = () => setLayout(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return layout;
}
