import { z } from 'zod'

export const DeploySchema = z.object({
  site: z.string(),
  branch: z.string().trim().min(1, 'Branch is required'),
  migrate: z.boolean()
})

export type DeployState = z.infer<typeof DeploySchema>
