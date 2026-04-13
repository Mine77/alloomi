import { z } from "zod";

export const authFormSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(8)
    .max(20)
    .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
      message: "Password must include at least one letter and one number.",
    }),
});
