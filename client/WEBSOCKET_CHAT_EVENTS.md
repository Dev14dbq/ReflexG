# WebSocket Events для чатов

## Канал: `chats`

### 1. Пользователь зашел/вышел в сеть

**Событие:** `userOnline` / `userOffline`

```json
{
  "ch": "chats",
  "t": "userOnline", // или "userOffline"
  "data": {
    "userId": "string",
    "chatId": "string", 
    "isOnline": true, // или false
    "lastSeen": "2024-01-01T12:00:00Z" // опционально
  }
}
```

### 2. Создан новый чат

**Событие:** `chatCreated`

```json
{
  "ch": "chats",
  "t": "chatCreated",
  "data": {
    "chat": {
      "id": "string",
      "title": "string | null",
      "avatarUrl": "string | null",
      "message": {
        "last": "string | null",
        "time": "string | null"
      },
      "unreadCount": 0,
      "isRead": true,
      "isOnline": false, // опционально
      "lastSeen": "string" // опционально
    }
  }
}
```

### 3. Чат удален

**Событие:** `chatDeleted`

```json
{
  "ch": "chats",
  "t": "chatDeleted",
  "data": {
    "chatId": "string"
  }
}
```

### 4. Чат обновлен (изменение данных)

**Событие:** `chatUpdated`

```json
{
  "ch": "chats",
  "t": "chatUpdated",
  "data": {
    "chat": {
      "id": "string",
      "title": "string | null",
      "avatarUrl": "string | null",
      "message": {
        "last": "string | null",
        "time": "string | null"
      },
      "unreadCount": 0,
      "isRead": true,
      "isOnline": false, // опционально
      "lastSeen": "string" // опционально
    }
  }
}
```

### 5. Новое сообщение в чате

**Событие:** `newMessage`

```json
{
  "ch": "chats",
  "t": "newMessage",
  "data": {
    "chatId": "string",
    "message": {
      "id": "string",
      "senderId": "string",
      "text": "string",
      "createdAt": "2024-01-01T12:00:00Z"
    },
    "unreadCount": 1
  }
}
```

## Когда отправлять события:

### `userOnline` / `userOffline`
- При входе/выходе пользователя из системы
- При изменении статуса активности пользователя
- Отправлять всем участникам чатов с этим пользователем

### `chatCreated`
- При создании нового чата (матч, новый диалог)
- Отправлять всем участникам нового чата

### `chatDeleted`
- При удалении чата одним из участников
- При блокировке пользователя
- Отправлять всем участникам удаляемого чата

### `chatUpdated`
- При изменении названия чата
- При изменении аватара пользователя
- При изменении настроек чата
- Отправлять всем участникам чата

### `newMessage`
- При получении нового сообщения
- Отправлять всем участникам чата
- Обновлять счетчик непрочитанных для получателей

## Примеры использования:

```javascript
// Пользователь зашел в сеть
ws.send(JSON.stringify({
  ch: "chats",
  t: "userOnline",
  data: {
    userId: "123",
    chatId: "chat_456",
    isOnline: true,
    lastSeen: new Date().toISOString()
  }
}))

// Новое сообщение
ws.send(JSON.stringify({
  ch: "chats", 
  t: "newMessage",
  data: {
    chatId: "chat_456",
    message: {
      id: "msg_789",
      senderId: "123",
      text: "Привет!",
      createdAt: new Date().toISOString()
    },
    unreadCount: 1
  }
}))
```
