package exercises

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"estudo/internal/platform/httpx"
)

const maxPDF = 25 << 20 // 25 MB

// registerPDF expõe o PDF anexado ao exercício (ex.: uma lista de questões).
func registerPDF(mux *http.ServeMux, s *Store) {
	mux.HandleFunc("GET /api/exercises/{id}/pdf", func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "id inválido")
			return
		}
		var name string
		var data []byte
		if err := s.db.QueryRow(r.Context(), `SELECT pdf_name, pdf_data FROM exercises WHERE id=$1`, id).Scan(&name, &data); err != nil {
			httpx.Fail(w, err)
			return
		}
		if data == nil {
			httpx.Error(w, http.StatusNotFound, "exercício sem PDF")
			return
		}
		w.Header().Set("Content-Type", "application/pdf")
		w.Header().Set("Content-Disposition", mime.FormatMediaType("inline", map[string]string{"filename": name}))
		w.Header().Set("Content-Length", fmt.Sprint(len(data)))
		_, _ = w.Write(data)
	})
	mux.HandleFunc("PUT /api/exercises/{id}/pdf", func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "id inválido")
			return
		}
		r.Body = http.MaxBytesReader(w, r.Body, maxPDF+1<<20)
		file, header, err := r.FormFile("file")
		if err != nil {
			var tooBig *http.MaxBytesError
			if errors.As(err, &tooBig) {
				httpx.Error(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("PDF maior que %d MB", maxPDF>>20))
				return
			}
			httpx.Error(w, http.StatusBadRequest, "envie o PDF no campo \"file\"")
			return
		}
		defer file.Close()
		data, err := io.ReadAll(io.LimitReader(file, maxPDF+1))
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		if len(data) > maxPDF {
			httpx.Error(w, http.StatusRequestEntityTooLarge, fmt.Sprintf("PDF maior que %d MB", maxPDF>>20))
			return
		}
		if !bytes.HasPrefix(data, []byte("%PDF-")) {
			httpx.Error(w, http.StatusBadRequest, "o arquivo não é um PDF")
			return
		}
		name := strings.TrimSpace(filepath.Base(header.Filename))
		if name == "" || name == "." {
			name = "lista.pdf"
		}
		tag, err := s.db.Exec(r.Context(), `UPDATE exercises SET pdf_name=$2, pdf_data=$3 WHERE id=$1`, id, name, data)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.Error(w, http.StatusNotFound, "não encontrado")
			return
		}
		e, err := s.Get(r.Context(), id)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusOK, e)
	})
	mux.HandleFunc("DELETE /api/exercises/{id}/pdf", func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "id inválido")
			return
		}
		if _, err := s.db.Exec(r.Context(), `UPDATE exercises SET pdf_name='', pdf_data=NULL WHERE id=$1`, id); err != nil {
			httpx.Fail(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
