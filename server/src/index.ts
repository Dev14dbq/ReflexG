import express from 'express'
import cors from 'cors'
import { z } from 'zod'

const app = express()
app.use(cors())
app.use(express.json())

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

app.post('/api/orders', (req: express.Request, res: express.Response) => {
  const parse = CreateOrderDto.safeParse(req.body)
  if (!parse.success) return res.status(400).json({ message: 'Invalid payload', issues: parse.error.issues })

  const total = parse.data.items.reduce((s, i) => s + i.price * i.qty, 0)
  const out = Order.parse({ id: Date.now(), items: parse.data.items, total })
  res.json(out)
})

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ message: 'Internal error' })
})

const port = process.env.PORT || 3001
app.listen(port, () => console.log(`API on :${port}`))
