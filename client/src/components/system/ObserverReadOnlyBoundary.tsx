import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { installObserverControls } from "./observer-controls";
import { useLocation } from "wouter";
export function ObserverReadOnlyBoundary({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const [path] = useLocation();
  const form =
    /^(?:\/tickets\/new|\/purchase-orders\/(?:new|edit-draft\/\d+)|\/construction\/projects\/(?:new|\d+\/edit))\/?$/.test(
      path.split(/[?#]/, 1)[0]
    );
  useEffect(() => {
    if (active) return installObserverControls(document);
  }, [active]);
  return (
    <>
      {active && (
        <Badge variant="secondary" className="mb-3">
          المراقب — استعراض فقط
        </Badge>
      )}
      {active && form ? (
        <fieldset disabled className="min-w-0 border-0 p-0">
          {children}
        </fieldset>
      ) : (
        children
      )}
    </>
  );
}
