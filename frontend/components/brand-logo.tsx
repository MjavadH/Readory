import Link from "next/link";
import Image from "next/image";

type BrandLogoProps = {
    height?: number;
    priority?: boolean;
    className?: string;
    withLink?: boolean;
};

export function BrandLogo({
                              height = 32,
                              priority = false,
                              className,
                              withLink = false,
                          }: BrandLogoProps) {
    const logo = (
        <Image
            src="Logo.svg"
            alt="Readory"
            width={Math.round(height * 4)}
            height={height}
            priority={priority}
            className={className}
        />
    );

    return withLink ? (
        <Link href="/" aria-label="Go to homepage">
            {logo}
        </Link>
    ) : (
        logo
    );
}
