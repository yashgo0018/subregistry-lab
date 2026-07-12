import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  labReducer,
  loadState,
  saveState,
  type LabAction,
  type LabState,
  type SessionData,
} from "./labSession";

type LabContextValue = {
  state: LabState;
  session?: SessionData;
  dispatch: Dispatch<LabAction>;
};

const LabContext = createContext<LabContextValue | null>(null);

export function LabProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(labReducer, undefined, loadState);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const session = state.activeKey ? state.sessions[state.activeKey] : undefined;

  return (
    <LabContext.Provider value={{ state, session, dispatch }}>
      {children}
    </LabContext.Provider>
  );
}

export function useLab(): LabContextValue {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error("useLab must be used inside LabProvider");
  return ctx;
}
