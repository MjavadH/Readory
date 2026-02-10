import { iconRegistry } from "@/lib/iconRegistry";
import type { IconKey } from "@shared/icon-keys";

type Props = {
    name?: IconKey | null
    className?: string

};

export function AppIcon({ name, className = "" }: Props) {
    if (!name) return null
    const IconComponent = iconRegistry[name];
    if (!IconComponent) return null;
    return <IconComponent className={className}/>;
}
