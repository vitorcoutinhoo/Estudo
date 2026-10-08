package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"estudo/internal/dashboard"
	"estudo/internal/exercises"
	"estudo/internal/platform/config"
	"estudo/internal/platform/database"
	"estudo/internal/platform/httpx"
	"estudo/internal/schedule"
	"estudo/internal/sessions"
	"estudo/internal/topics"
	"estudo/internal/web"
)

// version é gravada no build (build.ps1 -Version, que o workflow de release preenche com a tag).
var version = "dev"

func main() {
	if err := run(); err != nil {
		log.Printf("erro: %v", err)
		if runtime.GOOS == "windows" {
			// Mantém a janela aberta quando o exe é aberto com dois cliques.
			fmt.Print("\nPressione Enter para sair...")
			fmt.Scanln()
		}
		os.Exit(1)
	}
}

func run() error {
	cfg, path, err := config.Load()
	if err != nil {
		return fmt.Errorf("config: %w", err)
	}
	if path != "" {
		log.Printf("config: %s", path)
	}

	// Fechar a janela do console no Windows também chega como SIGTERM.
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	dbURL := cfg.Database.URL
	if cfg.Database.Mode == "embedded" {
		stop, err := database.StartEmbedded(ctx, cfg.Database.Embedded.DataDir, cfg.Database.Embedded.Port)
		if err != nil {
			return fmt.Errorf("Postgres embutido: %w", err)
		}
		defer stop()
		dbURL = database.EmbeddedURL(cfg.Database.Embedded.Port)
	}

	pool, err := database.Connect(ctx, dbURL)
	if err != nil {
		return fmt.Errorf("banco de dados: %w", err)
	}
	defer pool.Close()
	if err := database.Migrate(ctx, pool); err != nil {
		return fmt.Errorf("migrations: %w", err)
	}

	mux := http.NewServeMux()
	topics.Register(mux, topics.NewStore(pool))
	schedule.Register(mux, schedule.NewStore(pool))
	sessions.Register(mux, sessions.NewStore(pool))
	exercises.Register(mux, exercises.NewStore(pool))
	dashboard.Register(mux, pool)
	mux.Handle("/", web.Handler())

	ln, err := listen(cfg.Server.Host, cfg.Server.Port, web.Available())
	if err != nil {
		return err
	}
	url := "http://" + browserHost(cfg.Server.Host) + fmt.Sprintf(":%d", ln.Addr().(*net.TCPAddr).Port)
	log.Printf("Estudo %s rodando em %s (Ctrl+C para sair)", version, url)
	if cfg.Server.OpenBrowser && web.Available() {
		openBrowser(url)
	}

	srv := &http.Server{Handler: httpx.CORS(mux)}
	errc := make(chan error, 1)
	go func() { errc <- srv.Serve(ln) }()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
	}
	log.Print("encerrando...")
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancelShutdown()
	if err := srv.Shutdown(shutdownCtx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// listen tenta a porta configurada. Se estiver ocupada, usa uma livre qualquer só quando
// fallback é true (exe com frontend embutido); em dev o proxy do Vite depende da porta fixa.
func listen(host string, port int, fallback bool) (net.Listener, error) {
	ln, err := net.Listen("tcp", net.JoinHostPort(host, fmt.Sprint(port)))
	if err == nil {
		return ln, nil
	}
	if !fallback {
		return nil, fmt.Errorf("porta %d ocupada (outra instância do Estudo aberta?): %w", port, err)
	}
	log.Printf("porta %d indisponível (%v), escolhendo outra", port, err)
	return net.Listen("tcp", net.JoinHostPort(host, "0"))
}

func browserHost(host string) string {
	if host == "" || host == "0.0.0.0" || host == "::" {
		return "localhost"
	}
	return host
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		log.Printf("abrir navegador: %v", err)
	}
}
