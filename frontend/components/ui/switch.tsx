'use client';

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

function Switch({
  className,
  size = 'default',
  ...props
}: React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & {
  size?: 'sm' | 'default';
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        'shrink-0 rounded-full border border-transparent shadow-xs peer group/switch relative inline-flex items-center transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input dark:data-[state=unchecked]:bg-input/80',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 aria-invalid:ring-[3px]',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        'data-[size=default]:h-[18.4px] data-[size=default]:w-[32px]',
        'data-[size=sm]:h-[14px] data-[size=sm]:w-[24px]',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          'pointer-events-none block rounded-full ring-0 transition-transform',
          'bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground',
          'group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3',
          'group-data-[size=default]/switch:data-[state=checked]:translate-x-[calc(100%-2px)]',
          'rtl:group-data-[size=default]/switch:data-[state=checked]:-translate-x-[calc(100%-2px)]',
          'group-data-[size=sm]/switch:data-[state=checked]:translate-x-[calc(100%-2px)]',
          'group-data-[size=default]/switch:data-[state=unchecked]:translate-x-0',
          'group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
