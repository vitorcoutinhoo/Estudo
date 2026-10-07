package config

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strconv"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   Server   `yaml:"server"`
	Database Database `yaml:"database"`
}

type Server struct {
	Host        string `yaml:"host"`
	Port        int    `yaml:"port"`
	OpenBrowser bool   `yaml:"open_browser"`
}

type Database struct {
	// Mode é "embedded" (Postgres embutido) ou "external" (usa URL).
	Mode     string   `yaml:"mode"`
	URL      string   `yaml:"url"`
	Embedded Embedded `yaml:"embedded"`
}

type Embedded struct {
	Port    uint32 `yaml:"port"`
	DataDir string `yaml:"data_dir"`
}

func defaults() Config {
	return Config{
		Server: Server{Host: "127.0.0.1", Port: 8080, OpenBrowser: true},
		Database: Database{
			Mode:     "embedded",
			URL:      "postgres://estudo:estudo@localhost:5432/estudo?sslmode=disable",
			Embedded: Embedded{Port: 54329},
		},
	}
}

// Load lê o config.yaml (ESTUDO_CONFIG, ao lado do executável ou no diretório atual),
// aplica os overrides de ambiente (PORT, DATABASE_URL) e preenche os padrões.
// Sem arquivo, usa só os padrões.
func Load() (Config, string, error) {
	cfg := defaults()
	path := find()
	if path != "" {
		data, err := os.ReadFile(path)
		if err != nil {
			return cfg, path, err
		}
		if err := yaml.Unmarshal(data, &cfg); err != nil {
			return cfg, path, fmt.Errorf("%s: %w", path, err)
		}
	}

	if v := os.Getenv("PORT"); v != "" {
		p, err := strconv.Atoi(v)
		if err != nil {
			return cfg, path, fmt.Errorf("PORT inválida: %q", v)
		}
		cfg.Server.Port = p
	}
	if v := os.Getenv("DATABASE_URL"); v != "" {
		cfg.Database.Mode = "external"
		cfg.Database.URL = v
	}

	if cfg.Database.Mode != "embedded" && cfg.Database.Mode != "external" {
		return cfg, path, fmt.Errorf("database.mode deve ser embedded ou external, não %q", cfg.Database.Mode)
	}
	if cfg.Database.Embedded.DataDir == "" {
		dir, err := os.UserConfigDir()
		if err != nil {
			return cfg, path, err
		}
		cfg.Database.Embedded.DataDir = filepath.Join(dir, "Estudo")
	}
	return cfg, path, nil
}

func find() string {
	candidates := []string{os.Getenv("ESTUDO_CONFIG")}
	if exe, err := os.Executable(); err == nil {
		candidates = append(candidates, filepath.Join(filepath.Dir(exe), "config.yaml"))
	}
	candidates = append(candidates, "config.yaml")
	for _, c := range candidates {
		if c == "" {
			continue
		}
		if _, err := os.Stat(c); err == nil || !errors.Is(err, fs.ErrNotExist) {
			return c
		}
	}
	return ""
}
