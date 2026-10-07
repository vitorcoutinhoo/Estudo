// Package web serve o build do frontend embutido no binário.
// O build.ps1 copia frontend/dist para internal/web/dist antes do go build.
package web

import (
	"embed"
	"io/fs"
	"net/http"
	"strings"
)

//go:embed all:dist
var embedded embed.FS

var dist, _ = fs.Sub(embedded, "dist")

// Available indica se o binário foi gerado com o frontend embutido.
func Available() bool {
	_, err := fs.Stat(dist, "index.html")
	return err == nil
}

// Handler serve os arquivos estáticos; rotas desconhecidas caem no index.html (SPA).
func Handler() http.Handler {
	files := http.FileServerFS(dist)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") {
			http.NotFound(w, r)
			return
		}
		if !Available() {
			http.Error(w, "frontend não embutido neste binário: use npm run dev ou gere com build.ps1", http.StatusNotFound)
			return
		}
		name := strings.TrimPrefix(r.URL.Path, "/")
		if _, err := fs.Stat(dist, name); name != "" && err != nil {
			r = r.Clone(r.Context())
			r.URL.Path = "/"
		}
		files.ServeHTTP(w, r)
	})
}
