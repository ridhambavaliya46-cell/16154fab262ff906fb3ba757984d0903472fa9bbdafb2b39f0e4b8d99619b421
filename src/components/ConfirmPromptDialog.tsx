import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle } from 'lucide-react';
import { useDialogA11y } from '../hooks/useDialogA11y.js';

export interface ConfirmPromptDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  /**
   * When provided, the dialog collects a value (native `prompt()` behaviour).
   * When omitted it is a plain yes/no confirmation (native `confirm()`).
   */
  inputLabel?: string;
  inputInitialValue?: string;
  inputPlaceholder?: string;
  /** Submitted unchanged when the field is empty, mirroring `prompt() || fallback`. */
  inputFallback?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions. */
  destructive?: boolean;
  /** Runs with the entered value (or the fallback) on confirm. */
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * In-app replacement for `window.prompt` / `window.confirm`.
 *
 * Native dialogs cannot be styled, do not match the app's accessibility
 * contract (no focus trap, no Escape handling through `useDialogA11y`), and
 * `window.prompt` in particular is blocked outright inside some embedded
 * browsers — which silently turned a ban or a delete into a no-op or a
 * default-valued action. This dialog keeps the same call sites' semantics
 * while behaving like the rest of the app's modals.
 */
export const ConfirmPromptDialog: React.FC<ConfirmPromptDialogProps> = ({
  isOpen,
  title,
  message,
  inputLabel,
  inputInitialValue = '',
  inputPlaceholder,
  inputFallback = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}) => {
  const [value, setValue] = useState(inputInitialValue);
  const panelRef = useDialogA11y<HTMLFormElement>(isOpen, onCancel);
  const isPrompt = Boolean(inputLabel);

  useEffect(() => {
    if (isOpen) setValue(inputInitialValue);
  }, [isOpen, inputInitialValue]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    onConfirm(isPrompt ? value.trim() || inputFallback : '');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onCancel}
            className="fixed inset-0 bg-[#0B2545]/50 backdrop-blur-xs"
          />

          <div className="flex min-h-full items-center justify-center p-3 sm:p-4 text-center">
            <motion.form
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.97, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.22 }}
              onSubmit={submit}
              onClick={(event) => event.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="confirm-prompt-dialog-title"
              tabIndex={-1}
              className="relative w-full max-w-md bg-white/95 backdrop-blur-2xl rounded-2xl sm:rounded-3xl shadow-[0_24px_64px_rgba(11,37,69,0.18)] border border-white/80 p-6 z-10 text-left my-auto focus:outline-none"
            >
              <button
                type="button"
                onClick={onCancel}
                className="absolute top-4 right-4 p-2 rounded-xl text-[#627D98] hover:text-[#0B2545] hover:bg-surface cursor-pointer transition-colors"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>

              <div className="space-y-4">
                <div>
                  {destructive && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-danger-soft border border-danger-border/70 mb-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-danger" />
                      <span className="text-[11px] font-bold text-danger uppercase tracking-wider">
                        Destructive Action
                      </span>
                    </div>
                  )}
                  <h3
                    id="confirm-prompt-dialog-title"
                    className="text-lg sm:text-xl font-extrabold text-[#0B2545] tracking-tight mt-1 pr-8"
                  >
                    {title}
                  </h3>
                </div>

                <p className="text-xs sm:text-sm text-[#334E68] leading-relaxed">{message}</p>

                {isPrompt && (
                  <div>
                    <label
                      htmlFor="confirm-prompt-dialog-input"
                      className="block text-xs font-semibold text-[#0B2545] mb-1.5"
                    >
                      {inputLabel}
                    </label>
                    <input
                      id="confirm-prompt-dialog-input"
                      type="text"
                      value={value}
                      onChange={(event) => setValue(event.target.value)}
                      placeholder={inputPlaceholder}
                      autoFocus
                      className="w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-[#0B2545] text-xs focus:outline-none focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#1D4ED8]/20 placeholder:text-[#8DA9C4] transition-colors"
                    />
                  </div>
                )}

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="w-1/2 py-2.5 rounded-xl text-xs font-semibold text-[#334E68] border border-line hover:bg-canvas transition-colors cursor-pointer"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    type="submit"
                    className={`w-1/2 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-colors cursor-pointer shadow-xs ${
                      destructive ? 'bg-danger hover:bg-danger-strong' : 'bg-[#1D4ED8] hover:bg-[#1E40AF]'
                    }`}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </div>
            </motion.form>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmPromptDialog;
