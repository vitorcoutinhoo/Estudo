# Estudo — painel de acompanhamento de estudos

Monorepo com backend em Go, frontend em React e Postgres via Docker.

```
backend/    API Go (net/http + pgx), organizada por feature em internal/
frontend/   React + TypeScript + Vite, organizado por feature em src/features/
docker-compose.yml   Postgres 16
```

## Como rodar

```bash
# 1. banco
docker compose up -d

# 2. API (http://localhost:8081) — as tabelas são criadas automaticamente
cd backend
go run ./cmd/api

# 3. frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Variáveis da API: `DATABASE_URL` (padrão `postgres://estudo:estudo@localhost:5432/estudo?sslmode=disable`) e `PORT` (padrão `8081`).

## Features

| Feature     | Backend                        | Frontend                         |
|-------------|--------------------------------|----------------------------------|
| topics      | `/api/topics` (CRUD)           | lista, filtros, tags editáveis   |
| schedule    | `/api/schedule` (por data)     | cronograma diário + semana       |
| sessions    | `/api/sessions` (horas)        | registrar horas por tópico       |
| exercises   | `/api/exercises` (CRUD)        | enunciado, resolução, resolvido  |
| dashboard   | `/api/dashboard`               | resumo, gráfico de 7 dias        |

**Porcentagem do tópico** = horas estudadas ÷ meta de horas (máx. 100%). Tópicos com status "Concluído" valem 100%.
