import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: AlertCircle, warning: AlertTriangle, info: Info };
const TITLES = { success: 'Success', error: 'Something went wrong', warning: 'Please confirm', info: 'Notice' };
const DEFAULT_DURATION = { success: 4000, info: 5000, warning: 7000, error: 7000 };
const MAX_VISIBLE = 4;

let nextId = 1;

function ToastItem({ toast, onDismiss }) {
  const Icon = ICONS[toast.type] || Info;
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    if (!toast.duration || paused) return undefined;
    startedAt.current = Date.now();
    const timer = window.setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [toast.id, toast.duration, paused, onDismiss]);

  return (
    <div
      className={`toast toast-${toast.type}`}
      role={toast.type === 'error' || toast.type === 'warning' ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon size={18} className="toast-icon" aria-hidden="true" />
      <div className="toast-body">
        <b>{toast.title || TITLES[toast.type]}</b>
        <p>{toast.message}</p>
        {toast.actions?.length > 0 && (
          <div className="toast-actions">
            {toast.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                className={action.primary ? 'toast-action primary' : 'toast-action'}
                onClick={() => { action.onClick?.(); onDismiss(toast.id, true); }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={() => onDismiss(toast.id)}>
        <X size={14} />
      </button>
      {toast.duration > 0 && <span className="toast-progress" style={{ animationDuration: `${toast.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }} />}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const onCloseHandlers = useRef(new Map());

  const dismiss = useCallback((id, handled = false) => {
    const onClose = onCloseHandlers.current.get(id);
    onCloseHandlers.current.delete(id);
    if (onClose && !handled) onClose();
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((type, message, options = {}) => {
    const id = nextId++;
    const duration = options.duration ?? DEFAULT_DURATION[type] ?? 5000;
    if (options.onClose) onCloseHandlers.current.set(id, options.onClose);
    setToasts((current) => {
      const next = [...current, { id, type, message, title: options.title, actions: options.actions, duration }];
      const overflow = next.slice(0, Math.max(0, next.length - MAX_VISIBLE));
      overflow.forEach((toast) => onCloseHandlers.current.get(toast.id)?.());
      overflow.forEach((toast) => onCloseHandlers.current.delete(toast.id));
      return next.slice(-MAX_VISIBLE);
    });
    return id;
  }, []);

  const api = useMemo(() => ({
    success: (message, options) => show('success', message, options),
    error: (message, options) => show('error', message, options),
    warning: (message, options) => show('warning', message, options),
    info: (message, options) => show('info', message, options),
    dismiss,
    // Non-blocking replacement for window.confirm: resolves true when the user confirms.
    confirm: (message, { confirmLabel = 'Confirm', cancelLabel = 'Cancel', title } = {}) => new Promise((resolve) => {
      show('warning', message, {
        title,
        duration: 0,
        onClose: () => resolve(false),
        actions: [
          { label: cancelLabel, onClick: () => resolve(false) },
          { label: confirmLabel, primary: true, onClick: () => resolve(true) },
        ],
      });
    }),
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}
