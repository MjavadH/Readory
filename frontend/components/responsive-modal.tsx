import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

const MOBILE_BREAKPOINT = 768;

/** Matches the app menu breakpoint: below `md` we use a Drawer, above we use a Dialog. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}

export type ResponsiveModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  /** Sticky footer (actions). */
  footer?: React.ReactNode;
  className?: string;
};

export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={cn('max-h-[92vh]', className)}>
          <DrawerHeader className="text-start">
            <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
            {description ? (
              <DrawerDescription className="text-xs">{description}</DrawerDescription>
            ) : null}
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>

          {footer ? (
            <div className="sticky bottom-0 border-t border-border bg-background/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
              {footer}
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:w-full sm:max-w-lg',
          className,
        )}
      >
        <DialogHeader className="space-y-1 border-b border-border px-6 pb-4 pt-6 text-start">
          <DialogTitle className="text-start text-lg font-semibold">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-start text-sm">{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="max-h-[65vh] overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <div className="border-t border-border bg-muted/30 px-6 py-4">{footer}</div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
