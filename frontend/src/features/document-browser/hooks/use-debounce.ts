import { useEffect, useState } from 'react';

/**
 * Debounce utility hook for auto-save functionality.
 * Returns a debounced value that updates after the specified delay.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
