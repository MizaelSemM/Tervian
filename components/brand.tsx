import Link from "next/link";

import { cn } from "cn";

/**
 * Palavra-marca do Tervian. O ponto cobalto é a assinatura: um “toque” depois
 * do nome, como a próxima ação que o produto ajuda a não perder.
 */
export function Brand({
  href = "/",
  tone = "default",
  className,
}: {
  href?: string;
  tone?: "default" | "inverted";
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-brand inline-flex items-baseline text-[21px] leading-none font-bold",
        tone === "inverted" ? "text-primary-foreground" : "text-foreground",
        className,
      )}
    >
      Tervian
      <span
        className={cn(
          "ml-0.5 inline-block size-[5px] rounded-[1px]",
          tone === "inverted" ? "bg-primary-foreground" : "bg-primary",
        )}
        aria-hidden
      />
    </Link>
  );
}
