import { redirect } from "next/navigation";

/** A raiz do app é a tela "Hoje" (007); `/hoje` continua sendo a URL canônica. */
export default function HomePage() {
  redirect("/hoje");
}
