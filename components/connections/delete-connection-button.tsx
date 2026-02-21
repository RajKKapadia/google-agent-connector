"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteConnection } from "@/lib/actions/connections";

interface DeleteConnectionButtonProps {
  connectionId: string;
  connectionName: string;
}

export function DeleteConnectionButton({
  connectionId,
  connectionName,
}: DeleteConnectionButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const result = await deleteConnection(connectionId);
      if (result.success) {
        toast.success("Connection deleted");
        router.push("/connections");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to delete connection");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Connection</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{connectionName}&quot;? This will
            stop all incoming messages from being processed. This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete Connection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
