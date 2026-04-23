import { z } from "zod";

export const NAME_REGEX = /^[A-Za-z][A-Za-z0-9_-]*$/;

export const NameSchema = z
  .string()
  .regex(NAME_REGEX, "Invalid name: must start with a letter and contain only letters, digits, _ or -");
