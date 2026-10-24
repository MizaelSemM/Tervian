import { RequestResetForm } from "./request-reset-form";

export const metadata = { title: "Recuperar senha — Tervian" };

/** Pedido de recuperação de senha (RF-01). */
export default function RequestResetPage() {
  return <RequestResetForm />;
}
