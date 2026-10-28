import { toast } from "sonner";

console.log("toast:", Object.keys(toast));
try {
  const t = toast.error(undefined as any);
  console.log("toast.error(undefined) returned:", t);
} catch (e) {
  console.error("error:", e);
}

try {
  const t2 = toast.error({} as any);
  console.log("toast.error({}) returned:", t2);
} catch (e) {
  console.error("error:", e);
}
