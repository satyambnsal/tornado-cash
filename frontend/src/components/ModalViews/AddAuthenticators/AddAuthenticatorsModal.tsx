import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTrigger } from "../../ui";
import { AddAuthenticatorsForm } from "./AddAuthenticatorsForm";

export default function AddAuthenticatorsModal({
  trigger,
}: {
  trigger: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingOAuthJwt, setPendingOAuthJwt] = useState<{
    oAuthToken: string;
    provider: string;
  } | null>(null);

  useEffect(() => {
    const checkPendingOAuth = () => {
      const pendingData = sessionStorage.getItem("captured_oauth_add");
      if (pendingData) {
        try {
          const parsed = JSON.parse(pendingData);
          setPendingOAuthJwt(parsed);
          setTimeout(() => setIsOpen(true), 100);
        } catch (e) {
          console.error("Failed to parse pending OAuth data:", e);
          sessionStorage.removeItem("captured_oauth_add");
        }
      }
    };

    checkPendingOAuth();
  }, []);

  return (
    <Dialog modal onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className="ui-flex ui-flex-col"
        onPointerDownOutside={(e) => e.preventDefault()}
        closeButton
      >
        <AddAuthenticatorsForm
          setIsOpen={setIsOpen}
          pendingOAuthJwt={pendingOAuthJwt}
        />
      </DialogContent>
    </Dialog>
  );
}
