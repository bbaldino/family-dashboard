import { z } from 'zod'
import { defineIntegration } from '@/platform'

export const drivingTimeIntegration = defineIntegration({
  id: 'driving-time',
  name: 'Driving Time',
  schema: z.object({
    home_address: z.string().min(1, 'Home address is required'),
    // `z.coerce.number()` alone turns a *blank* string into `0`, not the
    // default — only an absent key hits `.default()`. Clearing the admin
    // field produces a blank string, not an absent key, so without this
    // preprocess step a cleared field would silently zero the buffer
    // instead of falling back to 5 like the deleted Rust's
    // `get_or("buffer_minutes", "5")` did.
    buffer_minutes: z.preprocess(
      (v) => (v === '' ? undefined : v),
      // `.default(5)` lives on the *inner* schema, not chained after
      // `preprocess` — `ZodDefault` only substitutes when the value handed
      // to it is `undefined`, and that check happens at the node it's
      // attached to. Chaining `.default(5)` after `preprocess` would check
      // the raw (pre-preprocess) input, which is `''` for a cleared field,
      // not `undefined` — so the substitution would never fire for that
      // case, exactly the bug being fixed here.
      z.coerce.number().int().nonnegative().default(5),
    ),
  }),
  fields: {
    home_address: {
      label: 'Home Address',
      description: 'Your home address for driving time calculations',
    },
    buffer_minutes: {
      label: 'Buffer Minutes',
      description: 'Extra minutes to add before leave-by time',
    },
  },
})
