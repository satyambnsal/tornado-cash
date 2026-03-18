# Navigation Button Component Examples

## Basic Usage

```tsx
<NavigationButton>Account</NavigationButton>
```

## With Icon

```tsx
<NavigationButton icon={<GoogleLogoIcon />}>Google</NavigationButton>
```

## With Sub Label

```tsx
<NavigationButton
  subLabel={
    <div className="ui-bg-white/10 ui-px-1.5 ui-py-0.5 ui-rounded-[4px] ui-text-xs ui-font-bold">
      <span className="ui-text-white/80">xionji...46hez</span>
    </div>
  }
>
  Account
</NavigationButton>
```

## With Right Arrow and Sub Label

```tsx
<NavigationButton
  rightArrow
  subLabel={
    <div className="ui-flex ui-items-center ui-gap-3">
      <div className="ui-flex ui-items-center ui-gap-0.5">
        <GithubLogoIcon />
        <DiscordLogoIcon />
      </div>
      <span className="ui-text-xs ui-text-secondary-text">5+</span>
    </div>
  }
>
  Other socials
</NavigationButton>
```
