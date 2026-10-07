import React, { useEffect, useRef } from 'react';

interface ToastProps {
  message: string;
  visible: boolean;
}

export function Toast({ message, visible }: ToastProps) {
  return (
    <div className={`toast${visible ? ' show' : ''}`} aria-live="polite">
      {message}
    </div>
  );
}

export function useToast() {
  const [state, setState] = React.useState({ message: '', visible: false });
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const show = (message: string, duration = 2500) => {
    clearTimeout(timerRef.current);
    setState({ message, visible: true });
    timerRef.current = setTimeout(() => setState((s) => ({ ...s, visible: false })), duration);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { toast: state, show };
}
