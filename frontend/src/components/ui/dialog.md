# Base Button Component Examples

## Basic Usage

```tsx
<Dialog>
  <DialogTrigger>
    <div>
      <h1>Empty Dialog</h1>
    </div>
  </DialogTrigger>
  <DialogContent overApp={true}>
    <DialogHeader>
      <DialogTitle>Practice Area</DialogTitle>
      <DialogDescription>Practice area description</DialogDescription>
    </DialogHeader>
    <div className="ui-flex ui-flex-col ui-gap-4 ui-w-full ui-h-20 ui-justify-center ui-items-center">
      <h5>Practice Area</h5>
    </div>
    <DialogFooter>
      <Button>Close</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Multiple Accounts Example

```tsx
<Dialog>
  <DialogTrigger>
    <div>
      <h1>Accounts Example</h1>
    </div>
  </DialogTrigger>
  <DialogContent overApp={true}>
    <DialogHeader>
      <DialogTitle>Accounts</DialogTitle>
      <DialogDescription>Choose an account to continue</DialogDescription>
    </DialogHeader>
    <div className="ui-flex ui-flex-col ui-gap-2.5 ui-w-full">
      <NavigationButton
        subLabel={
          <div className="ui-bg-white/10 ui-px-1.5 ui-py-0.5 ui-rounded-[4px] ui-text-xs ui-font-bold">
            <span className="ui-text-white/80">xionji...46hez</span>
          </div>
        }
      >
        Account 1
      </NavigationButton>
      <NavigationButton
        subLabel={
          <div className="ui-bg-white/10 ui-px-1.5 ui-py-0.5 ui-rounded-[4px] ui-text-xs ui-font-bold">
            <span className="ui-text-white/80">xionji...46hez</span>
          </div>
        }
      >
        Account 2
      </NavigationButton>
    </div>
    <DialogFooter>
      <div className="ui-flex ui-gap-4 ui-w-full">
        <BaseButton
          variant="secondary"
          size="icon-large"
          className="ui-group/basebutton"
        >
          <div className="ui-flex ui-items-center ui-justify-center">
            <ChevronRightIcon className="ui-fill-white/50 ui-rotate-180 group-hover/basebutton:ui-fill-white" />
            <ChevronRightIcon className="ui-fill-white/50 ui-rotate-180 group-hover/basebutton:ui-fill-white" />
          </div>
        </BaseButton>
        <BaseButton variant="destructive" className="ui-w-full">
          DISCONNECT
        </BaseButton>
      </div>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

## Welcome Example

```tsx
<Dialog>
  <DialogTrigger>
    <div>
      <h1>Welcome Example</h1>
    </div>
  </DialogTrigger>
  <DialogContent overApp={true} className="ui-gap-8">
    <DialogHeader>
      <DialogTitle>Welcome!</DialogTitle>
      <DialogDescription>Log in or sign up with your email</DialogDescription>
    </DialogHeader>
    <div className="ui-flex ui-flex-col ui-gap-6 ui-w-full">
      <div className="ui-flex ui-flex-col ui-gap-4">
        <Input
          baseInputClassName="!ui-text-[16px]"
          placeholder="Email"
          value={email}
          onChange={handleEmailChange}
          error={emailError}
          onBlur={validateEmail}
          onKeyDown={(e) => e.key === "Enter" && handleEmail()}
        />
        <BaseButton>LOG IN / SIGN UP</BaseButton>
      </div>
      <div className="ui-flex ui-items-center ui-justify-center ui-gap-3">
        <span className="ui-h-px ui-bg-border ui-w-full" />
        <h6 className="ui-text-xs ui-text-secondary-text">OR</h6>
        <span className="ui-h-px ui-bg-border ui-w-full" />
      </div>
    </div>
    <div className="ui-flex ui-flex-col ui-gap-2">
      <NavigationButton icon={<GoogleLogoIcon />}>Google</NavigationButton>
      <NavigationButton icon={<TikTokLogoIcon />}>TikTok</NavigationButton>
    </div>
    <div className="ui-w-full ui-mb-12 sm:ui-mb-0 ui-flex ui-flex-col ui-gap-3">
      <button
        className="ui-flex ui-text-white ui-text-sm ui-w-full ui-items-center ui-gap-3"
        onClick={() => setShowAdvanced((showAdvanced) => !showAdvanced)}
      >
        <span className="ui-text-base">Advanced Options</span>
        {/* Down Caret */}
        <ChevronRightIcon
          className={cn(
            "ui-fill-white/50 ui-rotate-180 group-hover/basebutton:ui-fill-white",
            showAdvanced ? "-ui-rotate-[90deg]" : "ui-rotate-90",
          )}
        />
      </button>
      {showAdvanced ? (
        <div className="ui-flex ui-w-full ui-gap-2">
          <BaseButton variant="secondary" size="icon-large">
            <img
              src={okxLogo}
              height={82}
              width={50}
              alt="OKX Logo"
              className="ui-min-w-7"
            />
          </BaseButton>
          <BaseButton variant="secondary" size="icon-large">
            <KeplrLogo className="ui-min-w-6 ui-min-h-6" />
          </BaseButton>
          <BaseButton variant="secondary" size="icon-large">
            <MetamaskLogo className="ui-min-w-7 ui-min-h-7" />
          </BaseButton>
        </div>
      ) : null}
    </div>
  </DialogContent>
</Dialog>
```
