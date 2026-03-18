import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
} from "../ui";
import { Skeleton } from "../ui/skeleton";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "../ui/accordion";
import {
  getPromotedFeatures,
  fetchContractChecksum,
} from "../../utils/migration";
import { useSigningClient } from "../../hooks/useSigningClient";

interface MigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCodeId: number;
  targetCodeId: number;
  onUpgrade: () => void;
}

export const MigrationDialog: React.FC<MigrationDialogProps> = ({
  open,
  onOpenChange,
  targetCodeId,
  onUpgrade,
}) => {
  const { client } = useSigningClient();
  const [isLoading, setIsLoading] = useState(false);
  const [targetChecksum, setTargetChecksum] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTargetChecksum(null);
    }
  }, [open]);

  useEffect(() => {
    const fetchTargetChecksum = async () => {
      if (!client || !open || targetChecksum !== null) return;

      setIsLoading(true);
      try {
        const checksum = await fetchContractChecksum(client, targetCodeId);
        if (checksum) {
          setTargetChecksum(checksum);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchTargetChecksum();
  }, [client, open, targetCodeId, targetChecksum]);

  const migrationFeatures = targetChecksum
    ? getPromotedFeatures(targetChecksum)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeButton>
        <div className="ui-animate-scale-in">
          <DialogHeader>
            <DialogTitle className="ui-text-center">Account Upgrade</DialogTitle>
            <DialogDescription className="ui-text-center">
              We have recently upgraded our accounts. You will need to accept the
              upgrade to get new account features.
            </DialogDescription>
          </DialogHeader>

          <div>
            <h3 className="ui-text-body-lg ui-font-medium ui-mb-4">
              New upgrade features:
            </h3>
            {isLoading ? (
              <div className="ui-space-y-4">
                <Skeleton className="ui-h-6 ui-w-3/4" />
                <Skeleton className="ui-h-4 ui-w-full" />
                <Skeleton className="ui-h-6 ui-w-3/4" />
                <Skeleton className="ui-h-4 ui-w-full" />
              </div>
            ) : (
              <Accordion
                type="multiple"
                className="ui-list-none ui-p-4 ui-bg-surface-page ui-rounded-lg ui-flex ui-flex-col ui-gap-4"
              >
                {migrationFeatures.map((feature, index) => (
                  <AccordionItem
                    key={index}
                    value={`feature-${index}`}
                    className="ui-border-b-0"
                  >
                    <AccordionTrigger className="ui-py-0">
                      {feature.title}
                    </AccordionTrigger>
                    <AccordionContent>{feature.description}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>

          <DialogFooter>
            <div className="ui-p-4 ui-bg-transparent ui-border ui-border-warning ui-rounded-lg ui-text-warning ui-text-body">
              If you don&apos;t migrate nothing will change, but you will not get
              the new account features.
            </div>
            <Button
              onClick={onUpgrade}
              className="ui-w-full"
              disabled={isLoading || !targetChecksum}
            >
              {isLoading ? "Loading..." : "MIGRATE"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
};
