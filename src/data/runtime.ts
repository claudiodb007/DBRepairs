export const isServerMode = typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);
