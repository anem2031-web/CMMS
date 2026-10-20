import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';

// تسجيل Service Worker لـ PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => registration.update().catch(() => {}))
      .catch(() => {});
  });
}
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import { createReadTransport } from "@/lib/read-transport";
import App from "@/App";
import { getLoginUrlWithReturn } from "@/const";
import "@/index.css";
import { getQueryKey } from "@trpc/react-query";
import { observerReadOnlyLink } from "@/lib/observer-link";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized =
    error.data?.code === "UNAUTHORIZED" && error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  const currentPath = window.location.pathname + window.location.search;
  window.location.href = getLoginUrlWithReturn(currentPath);
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    observerReadOnlyLink(() => queryClient.getQueryData<{role:string}>(getQueryKey(trpc.auth.me, undefined, "query"))?.role),
    createReadTransport(),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
