import { useEffect, useState } from "react";

export default function useLocalStorageState(key, initialValue, options = {}) {
  const { serializer = JSON.stringify, parser = JSON.parse } = options;

  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) return parser(raw);
    } catch {
      // ignore broken storage and use initial value
    }
    return typeof initialValue === "function" ? initialValue() : initialValue;
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, serializer(value));
    } catch {
      // ignore quota / privacy mode errors
    }
  }, [key, serializer, value]);

  return [value, setValue];
}
