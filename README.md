# Estudo — painel de acompanhamento de estudos

Monorepo com backend em Go, frontend em React e Postgres via Docker.

```
backend/    API Go (net/http + pgx), organizada por feature em internal/
frontend/   React + TypeScript + Vite, organizado por feature em src/features/
docker-compose.yml   Postgres 16
```

## Executável (uso normal)

```powershell
.\build.ps1                # gera release\Estudo.exe + release\config.yaml
.\build.ps1 -OS linux      # ou darwin
```

O executável traz o frontend embutido e sobe um **Postgres embutido**, sem precisar de Docker. É só abrir o `Estudo.exe`: o navegador abre sozinho. Na primeira execução ele baixa os binários do Postgres (~30 MB). Os dados ficam em `%APPDATA%\Estudo`. Para encerrar, feche a janela ou aperte Ctrl+C.

A configuração fica em `config.yaml`, ao lado do executável. Ele não vai para o git: copie `backend/config.example.yaml` para `backend/config.yaml` e ajuste (veja os comentários no arquivo). Sem o arquivo, valem os padrões do exemplo. O build copia o seu config para `release/` sem sobrescrever um que já exista lá. As opções são: porta, host, abrir o navegador, modo do banco e pasta de dados. Se a porta estiver ocupada, ele escolhe outra livre automaticamente.

## Desenvolvimento

```bash
# API (http://localhost:8080): sobe o Postgres embutido e cria as tabelas
cd backend
go run ./cmd/api

# frontend com hot reload (http://localhost:5173, faz proxy de /api para :8080)
cd frontend
npm install
npm run dev
```

Para usar o Postgres do Docker em vez do embutido, rode `docker compose up -d` e inicie a API com `DATABASE_URL=postgres://estudo:estudo@localhost:5432/estudo?sslmode=disable` (ou use `database.mode: external` no `config.yaml`). As variáveis `PORT` e `DATABASE_URL` sempre sobrescrevem o `config.yaml`.

Se mudar a porta da API, avise o Vite com `API_PORT` (ex.: `$env:API_PORT=8095; npm run dev`). Em dev, a API não troca de porta sozinha: se a porta estiver ocupada (por exemplo, pelo `Estudo.exe` aberto), ela para com erro em vez de deixar o Vite falando com a instância errada.

## Features

| Feature     | Backend                        | Frontend                         |
|-------------|--------------------------------|----------------------------------|
| topics      | `/api/topics` (CRUD), `/api/topics/import` (.xlsx) | lista, filtros, tags editáveis, importação |
| schedule    | `/api/schedule` (por data)     | cronograma diário + semana       |
| sessions    | `/api/sessions` (horas)        | registrar horas por tópico       |
| exercises   | `/api/exercises` (CRUD)        | enunciado, resolução, resolvido  |
| dashboard   | `/api/dashboard`               | resumo, gráfico de 7 dias        |

**Porcentagem do tópico** = horas estudadas ÷ meta de horas (máx. 100%). Tópicos com status "Concluído" valem 100%.

**Importação (.xlsx)** — em Tópicos → "Importar .xlsx". A planilha precisa das colunas `Data | Dia | Horário | Área | Tema / Atividade | Prioridade | Concluído` (o modelo pode ser baixado no próprio modal). Cada linha vira um tópico (título = Tema, descrição = Área, meta = duração do horário, ex.: `19h–22h` = 3h, prioridade ALTA/MÉDIA/BAIXA — vazia = média) e um item no cronograma na data. Concluído marcado (`☑`, `x`, `sim`…) importa como concluído. Linhas já importadas (mesmo tema na mesma data) são puladas.
