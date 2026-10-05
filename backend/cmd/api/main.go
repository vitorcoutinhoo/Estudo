package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"estudo/internal/dashboard"
	"estudo/internal/exercises"
	"estudo/internal/platform/database"
	"estudo/internal/platform/httpx"
	"estudo/internal/schedule"
	"estudo/internal/sessions"
	"estudo/internal/topics"
)

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	ctx := context.Background()
	pool, err := database.Connect(ctx, env("DATABASE_URL", "postgres://estudo:estudo@localhost:5432/estudo?sslmode=disable"))
	if err != nil {
		log.Fatalf("banco de dados: %v", err)
	}
	defer pool.Close()
	if err := database.Migrate(ctx, pool); err != nil {
		log.Fatalf("migrations: %v", err)
	}

	mux := http.NewServeMux()
	topics.Register(mux, topics.NewStore(pool))
	schedule.Register(mux, schedule.NewStore(pool))
	sessions.Register(mux, sessions.NewStore(pool))
	exercises.Register(mux, exercises.NewStore(pool))
	dashboard.Register(mux, pool)

	addr := ":" + env("PORT", "8081")
	log.Printf("API ouvindo em %s", addr)
	log.Fatal(http.ListenAndServe(addr, httpx.CORS(mux)))
}
