import { iconRegistry, IconKey } from "@/lib/iconRegistry";

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
