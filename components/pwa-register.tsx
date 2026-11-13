"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Registra o service worker e oferece "Atualizar" quando uma versão nova
 * termina de instalar (tarefa 012). Em dev não registra para não atrapalhar o
 * hot reload.
 */
export function PwaRegister() {
  const reloadedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const hadController = navigator.serviceWorker.controller !== null;
    let registration: ServiceWorkerRegistration | null = null;
    let cancelled = false;

    function promptUpdate() {
      if (!registration?.waiting) return;
      toast("Nova versão disponível", {
        description: "Atualize para receber as correções mais recentes.",
        duration: 15000,
        action: {
          label: "Atualizar",
          onClick: () => registration?.waiting?.postMessage("SKIP_WAITING"),
        },
      });
    }

    function handleControllerChange() {
      if (!hadController || reloadedRef.current) return;
      reloadedRef.current = true;
      window.location.reload();
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        if (cancelled) return;
        registration = reg;

        if (reg.waiting && hadController) promptUpdate();

        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              promptUpdate();
            }
          });
        });
      })
      .catch((error) => {
        console.error("[pwa] Falha ao registrar service worker:", error);
      });

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);

  return null;
}
