import express from 'express'
import { z } from 'zod'

const router = express.Router()

const OrderItem = z.object({
  id: z.number(),
  name: z.string(),
  price: z.number().nonnegative(),
  qty: z.number().int().positive()
})
const CreateOrderDto = z.object({
  items: z.array(OrderItem).min(1)
})
const Order = z.object({
  id: z.number(),
  items: z.array(OrderItem),
  total: z.number().nonnegative()
})

router.post('/orders', (req: express.Request, res: express.Response) => {
  const parse = CreateOrderDto.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ message: 'Invalid payload', issues: parse.error.issues })

  const total = parse.data.items.reduce((s, i) => s + i.price * i.qty, 0)
  const out = Order.parse({ id: Date.now(), items: parse.data.items, total })
  res.json(out)
})

export const ordersRouter = router


