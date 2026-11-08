import { useEffect, useRef } from "react";

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmação de ação destrutiva; o botão de confirmar não é o foco inicial. */
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={onCancel}
      aria-labelledby="confirm-titulo"
      className="m-auto w-[min(440px,92vw)] rounded-xs border border-line bg-surface-raised p-0 text-ink backdrop:bg-black/50"
    >
      <div className="bg-line px-5 py-3">
        <h2 id="confirm-titulo" className="text-base font-bold uppercase text-primary">
          {title}
        </h2>
      </div>
      <p className="px-5 py-5 text-sm">{message}</p>
      <div className="flex justify-end gap-2 px-5 pb-5">
        <button type="button" autoFocus onClick={onCancel} className="min-h-12 rounded-xs bg-secondary px-5 text-sm font-bold uppercase text-surface-raised hover:opacity-90">
          Cancelar
        </button>
        <button type="button" onClick={onConfirm} className="min-h-12 rounded-xs bg-error px-5 text-sm font-bold uppercase text-surface-raised hover:opacity-90">
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
