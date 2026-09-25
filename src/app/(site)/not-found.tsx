import { NotFoundContent } from "@/components/pages/NotFoundContent";

/** Branded 404 inside the marketing layout (site nav + footer). Unknown URLs reach it via `[...slug]`. */
export default function SiteNotFound() {
  return <NotFoundContent />;
}
