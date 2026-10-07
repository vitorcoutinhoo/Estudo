package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	embeddedpostgres "github.com/fergusstrange/embedded-postgres"
)

// Versão fixa: a biblioteca recria o diretório de dados se a versão mudar.
const embeddedVersion = embeddedpostgres.V16

const (
	embeddedUser     = "estudo"
	embeddedPassword = "estudo"
	embeddedDB       = "estudo"
)

func EmbeddedURL(port uint32) string {
	return fmt.Sprintf("postgres://%s:%s@localhost:%d/%s?sslmode=disable", embeddedUser, embeddedPassword, port, embeddedDB)
}

// StartEmbedded sobe um Postgres local com os dados em dataDir. Os binários são baixados
// na primeira execução (~30 MB) e ficam em cache em dataDir/cache.
// Se já houver um Postgres nosso respondendo na porta (ex.: sobra de uma execução
// encerrada à força), ele é reaproveitado e stop vira no-op.
func StartEmbedded(ctx context.Context, dataDir string, port uint32) (stop func(), err error) {
	if pool, err := connectQuick(ctx, EmbeddedURL(port)); err == nil {
		pool.Close()
		log.Printf("Postgres já em execução na porta %d, reaproveitando", port)
		return func() {}, nil
	}

	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		return nil, err
	}
	logFile, err := os.Create(filepath.Join(dataDir, "postgres.log"))
	if err != nil {
		return nil, err
	}

	pg := embeddedpostgres.NewDatabase(embeddedpostgres.DefaultConfig().
		Version(embeddedVersion).
		Port(port).
		Username(embeddedUser).
		Password(embeddedPassword).
		Database(embeddedDB).
		CachePath(filepath.Join(dataDir, "cache")).
		RuntimePath(filepath.Join(dataDir, "runtime")).
		DataPath(filepath.Join(dataDir, "pgdata")).
		StartTimeout(60 * time.Second).
		Logger(logFile))

	log.Printf("iniciando Postgres embutido (dados em %s)", dataDir)
	if err := pg.Start(); err != nil {
		logFile.Close()
		return nil, err
	}
	return func() {
		if err := pg.Stop(); err != nil {
			log.Printf("parar Postgres: %v", err)
		}
		logFile.Close()
	}, nil
}
