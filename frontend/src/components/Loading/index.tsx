import React from "react";
import {
  Button,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui";
import SpinnerV2 from "../ui/icons/SpinnerV2";

interface LoadingProps {
  header: string;
  message: string;
}

export const Loading = ({ header, message }: LoadingProps) => {
  return (
    <div className="ui-flex ui-flex-col ui-justify-center ui-items-center ui-gap-10 ui-w-full">
      <DialogHeader>
        <DialogTitle>{header}</DialogTitle>
        <DialogDescription>{message}</DialogDescription>
      </DialogHeader>
      <div className="ui-flex ui-w-full ui-items-center ui-justify-center ui-text-text-primary">
        <SpinnerV2 size="lg" color="black" />
      </div>

      <DialogFooter>
        <Button className="ui-w-full" disabled={true}>
          SET UP AUTHENTICATOR
        </Button>
      </DialogFooter>
    </div>
  );
};
