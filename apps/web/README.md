# SiftDIK Web

Сайт на React и TypeScript с Vite+ 1.1.0. Использует Tailwind CSS,
TanStack Router с автоматической генерацией маршрутов и React Compiler через Babel.

Зависимости устанавливаются из корня репозитория:

```sh
vp install
vp run dev:web
```

Dev-сервер запускается на `http://localhost:3000`. Без глобального `vp`
используйте `bun install` и `bun run dev:web` из корня.

Из `apps/web` доступны команды:

```sh
bun run check       # форматирование, lint и типы
bun run typecheck   # TypeScript для приложения и конфига
bun run build       # проверка типов и production-сборка в dist
bun run preview     # просмотр production-сборки
bun run lint        # Vite+ / Oxlint
bun run format      # Vite+ / Oxfmt
```

Общие настройки lint и форматирования находятся в корневом `vite.config.ts`.
Настройки React, Tailwind CSS, React Compiler, путей и TanStack Router —
в `apps/web/vite.config.ts`. Файл `src/app/routeTree.gen.ts` генерируется
плагином маршрутизации при запуске и сборке.
