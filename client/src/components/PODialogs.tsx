import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, AlertCircle } from "lucide-react";

interface RevisionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
  isPending: boolean;
  title: string;
  desc: string;
  label: string;
  placeholder: string;
  confirmText: string;
}

/**
 * OPTIMIZATION: Isolated Revision Dialog (Phase 2)
 * Localizes state to prevent parent re-renders while typing.
 */
export const RevisionDialog = React.memo(({ 
  isOpen, 
  onClose, 
  onConfirm, 
  isPending, 
  title, 
  desc, 
  label, 
  placeholder, 
  confirmText 
}: RevisionDialogProps) => {
  const [note, setNote] = useState("");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">{desc}</p>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{label}</Label>
            <Textarea 
              placeholder={placeholder}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            إلغاء
          </Button>
          <Button 
            onClick={() => onConfirm(note)} 
            disabled={isPending || !note.trim()}
            variant="destructive"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

interface ItemReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
  title: string;
  label: string;
  confirmText: string;
}

/**
 * OPTIMIZATION: Isolated Item Review Dialog (Phase 2)
 * Localizes state to prevent parent re-renders while typing.
 */
export const ItemReviewDialog = React.memo(({
  isOpen,
  onClose,
  onConfirm,
  isPending,
  title,
  label,
  confirmText
}: ItemReviewDialogProps) => {
  const [reason, setReason] = useState("");

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{label}</Label>
            <Textarea 
              placeholder="..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            إلغاء
          </Button>
          <Button onClick={() => onConfirm(reason)} disabled={isPending || !reason.trim()}>
            {isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
