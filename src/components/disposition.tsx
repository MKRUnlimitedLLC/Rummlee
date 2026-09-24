import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { errMessage } from "@/lib/rummlee/errors";
import { chooseDisposition } from "@/lib/rummlee/house";

export function DispositionChoice({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const choose = useMutation({
    mutationFn: (choice: "pickup" | "abandon") => chooseDisposition({ data: { orderId, choice } }),
    onSuccess: (_res, choice) => {
      toast.success(
        choice === "abandon"
          ? "Left with Rummlee. You won’t be paid on a resale."
          : "Hold for pickup. It’s still yours.",
      );
      void qc.invalidateQueries({ queryKey: ["inbox"] });
      void qc.invalidateQueries({ queryKey: ["order", orderId] });
      void qc.invalidateQueries({ queryKey: ["bootstrap"] });
    },
    onError: (e) => toast.error(errMessage(e)),
  });

  return (
    <div className="mt-3 space-y-2 text-left">
      <p className="text-sm text-fg">
        The package is at the Fargo official store. The buyer was refunded. Choose one.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={choose.isPending} onClick={() => choose.mutate("pickup")}>
          Hold for pickup
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={choose.isPending}
          onClick={() => {
            if (!window.confirm("Leave it? It becomes Rummlee’s. You are not paid if it resells.")) return;
            choose.mutate("abandon");
          }}
        >
          I don’t want it
        </Button>
      </div>
      <p className="text-xs text-muted">
        Hold for pickup and it’s still yours. Leave it and Rummlee can resell it. Your handle is not on the new
        listing. Half of what Rummlee receives goes to charity.
      </p>
    </div>
  );
}
