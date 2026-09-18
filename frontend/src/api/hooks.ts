import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/src/api/client";

export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: () => apiGet("/reports/dashboard") });
}

export function useOrders(params: Record<string, string | undefined> = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as any).toString();
  return useQuery({ queryKey: ["orders", params], queryFn: () => apiGet(`/orders?${qs}`) });
}

export function useOrder(id?: string) {
  return useQuery({ queryKey: ["order", id], queryFn: () => apiGet(`/orders/${id}`), enabled: !!id });
}

export function useOrderActivity(id?: string) {
  return useQuery({ queryKey: ["order-activity", id], queryFn: () => apiGet(`/orders/${id}/activity`), enabled: !!id });
}

export function useFollowups(bucket: string) {
  return useQuery({ queryKey: ["followups", bucket], queryFn: () => apiGet(`/followups?bucket=${bucket}`) });
}

export function useNotifications() {
  return useQuery({ queryKey: ["notifications"], queryFn: () => apiGet("/notifications") });
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ["unread"],
    queryFn: () => apiGet("/notifications/unread-count"),
    refetchInterval: 30000,
  });
}

export function useUsers(role?: string) {
  return useQuery({ queryKey: ["users", role], queryFn: () => apiGet(`/users${role ? `?role=${role}` : ""}`) });
}

export function useRequests(status?: string) {
  return useQuery({ queryKey: ["requests", status], queryFn: () => apiGet(`/requests${status ? `?status=${status}` : ""}`) });
}

export function useRequest(id?: string) {
  return useQuery({ queryKey: ["request", id], queryFn: () => apiGet(`/requests/${id}`), enabled: !!id });
}

/** Generic action mutation that invalidates a set of query keys on success. */
export function useAction(invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body, method = "POST" }: { path: string; body?: any; method?: "POST" | "PATCH" }) =>
      apiPost(path, body).catch(async (e) => {
        throw e;
      }),
    onSuccess: () => {
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}
