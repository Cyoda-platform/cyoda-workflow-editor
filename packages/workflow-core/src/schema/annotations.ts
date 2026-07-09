import { z } from "zod";

/**
 * Client-owned metadata object (cyoda-go 0.8.1+). Object-only by contract:
 * arrays/primitives/null are rejected. Inner keys/values are arbitrary JSON and
 * are never inspected. Well-known optional keys `displayName`/`description`
 * (strings) are an advisory renderer convention, not enforced here.
 */
export const AnnotationsSchema = z.record(z.string(), z.unknown());
