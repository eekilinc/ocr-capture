import type { ToastState } from "../types";

type StatusToastProps = {
  state: ToastState;
};

export const StatusToast = ({ state }: StatusToastProps) => {
  if (state.kind === "hidden") {
    return null;
  }

  return <aside className={`toast ${state.kind}`}>{state.message}</aside>;
};
