import { withSession } from "@/lib/session";

import { ImportCsvView } from "./import-csv-view";

export const metadata = { title: "Importar contatos — Tervian" };

export default async function ImportContactsPage() {
  return withSession(async () => <ImportCsvView />);
}
