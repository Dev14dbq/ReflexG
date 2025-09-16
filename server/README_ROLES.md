# Система ролей и прав доступа

## Обзор

В системе реализована трехуровневая система ролей для управления доступом пользователей:

- **USER** - обычный пользователь (по умолчанию)
- **MODERATOR** - модератор с расширенными правами
- **ADMIN** - администратор с полными правами

## Роли и права

### USER (Пользователь)
- Просмотр профилей
- Отправка лайков
- Обмен сообщениями
- Редактирование собственного профиля

### MODERATOR (Модератор)
- Все права USER
- Просмотр элементов модерации
- Одобрение/отклонение профилей
- Одобрение/отклонение описаний
- Одобрение/отклонение фотографий
- Просмотр статистики модерации

### ADMIN (Администратор)
- Все права MODERATOR
- Управление ролями пользователей
- Просмотр списка всех пользователей
- Полная информация о пользователях

## API Endpoints

### Аутентификация и роли

#### GET /profile/me
Получить информацию о текущем пользователе (включая роль)
```json
{
  "ok": true,
  "user": {
    "telegramId": "123456789",
    "username": "username",
    "firstName": "Имя",
    "role": "USER",
    "isModerator": false,
    "isAdmin": false
  }
}
```

### Администрирование (только для ADMIN)

#### GET /admin/users
Получить список всех пользователей с ролями
```json
{
  "ok": true,
  "users": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "pages": 2
  }
}
```

#### GET /admin/user/:telegramId
Получить информацию о конкретном пользователе
```json
{
  "ok": true,
  "user": {
    "telegramId": "123456789",
    "username": "username",
    "firstName": "Имя",
    "role": "USER"
  }
}
```

#### POST /admin/user/role
Обновить роль пользователя
```json
{
  "targetTelegramId": "123456789",
  "newRole": "MODERATOR"
}
```

### Модерация (для MODERATOR и ADMIN)

#### GET /moderation/items
Получить список элементов для модерации
```json
{
  "ok": true,
  "items": [...],
  "pagination": {...}
}
```

#### POST /moderation/item/status
Обновить статус модерации
```json
{
  "itemId": "item_id",
  "status": "APPROVED",
  "reason": "Описание причины (опционально)"
}
```

#### GET /moderation/stats
Получить статистику модерации
```json
{
  "ok": true,
  "stats": {
    "pending": 10,
    "approved": 50,
    "rejected": 5,
    "total": 65
  }
}
```

## Middleware

### requireRole(role)
Проверяет, имеет ли пользователь необходимую роль для доступа к endpoint.

### requireModerator
Проверяет, является ли пользователь модератором или админом.

### requireAdmin
Проверяет, является ли пользователь админом.

## Использование

### Установка первого администратора

1. Убедитесь, что пользователь уже зарегистрирован в системе
2. Запустите скрипт:
```bash
npm run setup-admin <telegram_id>
```

Пример:
```bash
npm run setup-admin 123456789
```

### Проверка ролей в коде

```typescript
import { isModerator, isAdmin, hasPermission } from '@/services/auth'

// Проверка конкретной роли
const isUserModerator = await isModerator(telegramId)
const isUserAdmin = await isAdmin(telegramId)

// Проверка прав доступа
const canModerate = await hasPermission(telegramId, UserRole.MODERATOR)
const canAdmin = await hasPermission(telegramId, UserRole.ADMIN)
```

### Использование middleware в роутах

```typescript
import { requireModerator, requireAdmin } from '@/lib/middleware/roleCheck'

// Только для модераторов и админов
router.get('/moderation/items', requireModerator, async (req, res) => {
  // ...
})

// Только для админов
router.post('/admin/user/role', requireAdmin, async (req, res) => {
  // ...
})
```

## Безопасность

- Все endpoint'ы с проверкой ролей требуют передачи `telegramId`
- `telegramId` передается через заголовок `x-telegram-id` или в body запроса
- Роли проверяются на уровне middleware перед выполнением основного кода
- Доступ к административным функциям ограничен только пользователями с ролью ADMIN

## Миграция базы данных

Система ролей добавляется через миграцию Prisma:

```bash
npx prisma migrate dev --name add_user_roles
```

Это добавит поле `role` в таблицу `User` со значением по умолчанию `USER`.
