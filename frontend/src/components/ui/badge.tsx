import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 py-0.5 text-[0.625rem] font-medium whitespace-nowrap transition-all duration-150 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-2.5!',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-sm [a]:hover:brightness-110 [a]:active:brightness-95',
        secondary:
          'bg-secondary text-secondary-foreground [a]:hover:bg-[color-mix(in_oklab,var(--secondary)_80%,var(--foreground)_6%)] [a]:active:brightness-95',
        destructive:
          'bg-destructive text-white focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:brightness-110 [a]:active:brightness-95',
        outline:
          'border-border bg-input/20 text-foreground dark:bg-input/30 [a]:hover:bg-muted [a]:hover:text-foreground',
        ghost:
          'bg-transparent text-foreground [a]:hover:bg-secondary [a]:active:bg-[color-mix(in_oklab,var(--secondary)_70%,var(--foreground)_8%)]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'span';

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
