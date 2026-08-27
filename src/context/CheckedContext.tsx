import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getChecked, setChecked } from "../lib/checked";

// One provider per trip page, holding every person's checked-state map (the
// page renders everyone's grid at once, not just "your own" — see
// docs/plan.md). Reads localStorage exactly once per person on mount;
// updateChecked is the single call site phase 2/3's REST PATCH + offline
// queue eventually replaces.

type CheckedByPerson = Record<string, Record<string, boolean>>;

interface CheckedContextValue {
  isChecked: (person: string, cellId: string) => boolean;
  updateChecked: (person: string, cellId: string, value: boolean) => void;
}

const CheckedContext = createContext<CheckedContextValue | null>(null);

interface CheckedProviderProps {
  tripSlug: string;
  people: string[];
  children: ReactNode;
}

export function CheckedProvider({ tripSlug, people, children }: CheckedProviderProps) {
  const [checkedByPerson, setCheckedByPerson] = useState<CheckedByPerson>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      people.map((person) => getChecked(tripSlug, person).then((map) => [person, map] as const))
    ).then((entries) => {
      if (!cancelled) setCheckedByPerson(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [tripSlug, people]);

  function isChecked(person: string, cellId: string): boolean {
    return Boolean(checkedByPerson[person]?.[cellId]);
  }

  function updateChecked(person: string, cellId: string, value: boolean): void {
    setCheckedByPerson((prev) => ({
      ...prev,
      [person]: { ...prev[person], [cellId]: value },
    }));
    setChecked(tripSlug, person, cellId, value);
  }

  return (
    <CheckedContext.Provider value={{ isChecked, updateChecked }}>
      {children}
    </CheckedContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- standard Context+hook pairing
export function useChecked(): CheckedContextValue {
  const context = useContext(CheckedContext);
  if (!context) {
    throw new Error("useChecked must be used within a CheckedProvider");
  }
  return context;
}
