## Conventions for building with this design system

This is a Korean university community-board app's shadcn/ui-based component set (Button, Dialog, Table, Sidebar, etc.), all styled with Tailwind CSS v4 utility classes driven by CSS custom-property tokens — not a prop/theme-object system and not CSS-in-JS.

### Wrapping and setup

No global root provider is required for styling — tokens live as CSS custom properties on `:root`/`.dark` and are already inlined into `styles.css`; just import the component and use it.

A few components DO need local composition:
- **Tooltip** already wraps itself in its own `TooltipProvider` internally — just use `<Tooltip><TooltipTrigger>…</TooltipTrigger><TooltipContent>…</TooltipContent></Tooltip>` directly, no outer provider needed.
- **Sidebar** needs `<SidebarProvider>` as its parent (it supplies collapse/mobile state via context): `<SidebarProvider><Sidebar>…</Sidebar><SidebarInset>…</SidebarInset></SidebarProvider>`.
- **Form** wraps `react-hook-form` — spread a real `useForm()` return value into it: `<Form {...form}><FormField control={form.control} name="…" render={({field}) => <FormItem><FormLabel/><FormControl><Input {...field}/></FormControl><FormMessage/></FormItem>} /></Form>`.

**Known composition pitfall — do not use `asChild` with `<Button>` inside a Popper-anchored trigger.** This app's `Button` is a plain function component, not `React.forwardRef`-wrapped. Radix triggers that measure/position a floating panel via a ref (`DropdownMenuTrigger`, `PopoverTrigger`, `HoverCardTrigger`, `TooltipTrigger`, `ContextMenuTrigger`, `MenubarTrigger` submenu triggers, `SelectTrigger`-style anchors) will silently fail to open their content if given `asChild` wrapping a `<Button>` — no error, the panel just never appears. **Instead, style the trigger element directly**: `<DropdownMenuTrigger className={buttonVariants({variant:"outline"})}>텍스트</DropdownMenuTrigger>` (import `buttonVariants` alongside `Button`). Fixed/centered/slide-positioned overlays (`Dialog`, `AlertDialog`, `Sheet`, `Drawer`) are unaffected — `asChild`+`Button` is fine there since they don't measure an anchor rect.

### The styling idiom

Tailwind utility classes composed with `class-variance-authority` (cva) variant maps, referencing these real CSS custom-property tokens (defined in `styles.css`, which `@import`s the full token set):

`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--destructive-foreground`, `--border`, `--input`, `--input-background`, `--ring`, `--radius`, `--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`, `--sidebar-border`, `--chart-1` … `--chart-5`.

**This app's real brand theme is dark-navy, not light** — `--background` is a near-black navy (`#0a0f1f`-ish), `--foreground` near-white, `--primary` a bright blue (~`#3b82f6`). When composing a new screen, put a `bg-background text-foreground` (or the equivalent CSS-variable) container around the whole layout rather than leaving the default browser-white canvas — components that only style text via tokens (e.g. `Button`'s `ghost`/`link` variants) will misrender (invisible or wrong-contrast text) against a plain white background that doesn't match this DS's real environment.

Class-variance-authority variant props to reach for by name, not raw classes: `variant` (`default`/`secondary`/`destructive`/`outline`/`ghost`/`link` on `Button`; `default`/`destructive` on `Alert`; `default`/`secondary`/`destructive`/`outline` on `Badge`), `size` (`default`/`sm`/`lg`/`icon`).

### Where the truth lives

`styles.css` (imports the full token + component CSS closure — `_ds_bundle.css` is the compiled Tailwind output) and each component's own `.prompt.md`/`.d.ts` for its exact prop surface.

### One idiomatic build snippet

```tsx
<div className="bg-background text-foreground p-6 flex flex-col gap-4">
  <Card className="w-[360px]">
    <CardHeader>
      <CardTitle>강의평 작성</CardTitle>
      <CardDescription>수강한 강의에 대한 솔직한 후기를 남겨주세요.</CardDescription>
    </CardHeader>
    <CardContent>
      <Textarea placeholder="강의 후기를 입력하세요" />
    </CardContent>
    <CardFooter className="gap-2">
      <Button variant="outline">취소</Button>
      <Button>등록하기</Button>
    </CardFooter>
  </Card>
</div>
```
