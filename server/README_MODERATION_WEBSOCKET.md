# Вебсокет модерации

## Подключение

Подключитесь к вебсокету по адресу:
```
ws://localhost:3001/ws/moderation?initData=<telegram_init_data>
```

## Аутентификация

Требуется роль `MODERATOR` или `ADMIN`. Передайте `initData` от Telegram в query параметрах.

## Сообщения

### Отправка действия модерации

```json
{
  "ch": "moderation",
  "t": "action",
  "cid": "unique_request_id",
  "data": {
    "itemId": "moderation_item_id",
    "action": "APPROVE" | "REJECT" | "DISCREPANT",
    "reason": "Причина (опционально)",
    "banUser": true | false (только для REJECT)
  }
}
```

### Ответы

#### Успешное действие
```json
{
  "ch": "moderation",
  "t": "action_success",
  "cid": "unique_request_id",
  "data": {
    "itemId": "moderation_item_id",
    "status": "APPROVED" | "REJECTED" | "DISCREPANT",
    "reason": "Причина",
    "banned": false
  }
}
```

#### Ошибка
```json
{
  "ch": "moderation",
  "t": "error",
  "cid": "unique_request_id",
  "data": {
    "message": "Описание ошибки"
  }
}
```

## Действия модерации

### 1. APPROVE - Одобрение
- Анкета одобрена
- Пользователь получает уведомление об одобрении
- Статус профиля обновляется

### 2. REJECT - Отклонение (два пути)

#### Путь 1: Отклонение без бана
- `banUser: false` или не указан
- Данные анкеты очищаются
- Пользователь получает уведомление с просьбой заполнить заново
- Статус профиля сбрасывается в PENDING

#### Путь 2: Отклонение с баном
- `banUser: true`
- Пользователь блокируется
- Устанавливается причина бана и время
- Пользователь получает уведомление о блокировке

### 3. DISCREPANT - Некорректные данные
- Анкета отклонена из-за некорректных данных
- Данные не очищаются
- Пользователь получает уведомление с указанием проблемы
- Пользователь может исправить данные и отправить повторно

## Уведомления пользователей

Все уведомления отправляются через Telegram бота:

- **APPROVE**: "✅ Ваша анкета одобрена! Теперь вы можете пользоваться сервисом."
- **REJECT (без бана)**: "❌ Ваша анкета отклонена. Причина: [причина]. Пожалуйста, заполните анкету заново."
- **REJECT (с баном)**: "🚫 Ваша анкета отклонена. Вы заблокированы. Причина: [причина]"
- **DISCREPANT**: "⚠️ В вашей анкете обнаружены некорректные данные. Проблема: [описание]. Пожалуйста, исправьте указанные данные и отправьте анкету на повторную проверку."

## Проверка бана

Все API запросы автоматически проверяются на бан пользователя. Заблокированные пользователи получают ошибку 403:

```json
{
  "error": "USER_BANNED",
  "message": "Ваш аккаунт заблокирован",
  "reason": "Причина бана",
  "bannedAt": "2024-08-24T20:08:44.000Z"
}
```

## Пример использования

```javascript
const ws = new WebSocket('ws://localhost:3001/ws/moderation?initData=' + telegramInitData)

// Одобрить анкету
ws.send(JSON.stringify({
  ch: 'moderation',
  t: 'action',
  cid: '1',
  data: {
    itemId: 'abc123',
    action: 'APPROVE'
  }
}))

// Отклонить анкету без бана
ws.send(JSON.stringify({
  ch: 'moderation',
  t: 'action',
  cid: '2',
  data: {
    itemId: 'abc123',
    action: 'REJECT',
    reason: 'Неполная информация'
  }
}))

// Отклонить анкету с баном
ws.send(JSON.stringify({
  ch: 'moderation',
  t: 'action',
  cid: '3',
  data: {
    itemId: 'abc123',
    action: 'REJECT',
    reason: 'Нарушение правил',
    banUser: true
  }
}))

// Отметить некорректные данные
ws.send(JSON.stringify({
  ch: 'moderation',
  t: 'action',
  cid: '4',
  data: {
    itemId: 'abc123',
    action: 'DISCREPANT',
    reason: 'Возраст указан некорректно'
  }
}))
```
