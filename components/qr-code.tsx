"use client";

import qrcode from "qrcode-generator";
import { useMemo } from "react";

/**
 * QR code local (sem serviço externo e sem canvas), usado no link da bio do
 * Instagram. Gera um SVG a partir dos módulos para escalar sem perder nitidez.
 */
export function QrCode({
  value,
  size = 180,
  label,
}: {
  value: string;
  size?: number;
  label?: string;
}) {
  const { count, path } = useMemo(() => {
    const code = qrcode(0, "M");
    code.addData(value);
    code.make();

    const modules = code.getModuleCount();
    let d = "";
    for (let row = 0; row < modules; row += 1) {
      for (let col = 0; col < modules; col += 1) {
        if (code.isDark(row, col)) d += `M${col},${row}h1v1h-1z`;
      }
    }
    return { count: modules, path: d };
  }, [value]);

  return (
    <svg
      role="img"
      aria-label={label ?? "QR code do formulário"}
      width={size}
      height={size}
      viewBox={`0 0 ${count} ${count}`}
      shapeRendering="crispEdges"
      className="rounded-lg border border-border bg-white"
    >
      <rect width={count} height={count} fill="#ffffff" />
      <path d={path} fill="#111111" />
    </svg>
  );
}
