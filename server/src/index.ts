// src/index.ts
import express from 'express';

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/ping', (_req, res) => {
  res.send('pong');
});

app.get('/', (_req, res) => {
  res.send('Server is running!');
});

app.listen(PORT, () => {
  console.log(`🚀 Listening on port ${PORT}`);
});
