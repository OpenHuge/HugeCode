import { ClientOnly } from "@tanstack/react-router";
import { WebPwaLifecycle } from "./WebPwaLifecycle";

export function WebPwaLifecycleMount() {
  return (
    <ClientOnly fallback={null}>
      <WebPwaLifecycle />
    </ClientOnly>
  );
}
