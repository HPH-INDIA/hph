import type { ReactNode } from "react";

import { Button } from "./Button";
import { ActionScreen } from "./ActionScreen";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  variant?: "primary" | "danger";
  isLoading?: boolean;
  confirmDisabled?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  variant = "primary",
  isLoading,
  confirmDisabled,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <ActionScreen open={open} onClose={onCancel} title={title} description={description}>
      <div className="max-w-2xl rounded-xl border border-border bg-surface p-6">
        {children}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="button" variant={variant} onClick={onConfirm} isLoading={isLoading} disabled={isLoading || confirmDisabled}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ActionScreen>
  );
}
