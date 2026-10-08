package exercises

import (
	"context"
	"net/http"
	"strconv"
	"strings"

	"estudo/internal/platform/httpx"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Exercise struct {
	ID         int64  `json:"id"`
	TopicID    int64  `json:"topicId"`
	TopicTitle string `json:"topicTitle"`
	Title      string `json:"title"`
	Statement  string `json:"statement"`
	Solution   string `json:"solution"`
	Solved     bool   `json:"solved"`
	PdfName    string `json:"pdfName"`
	PdfSize    int64  `json:"pdfSize"`
}

type input struct {
	TopicID   int64  `json:"topicId"`
	Title     string `json:"title"`
	Statement string `json:"statement"`
	Solution  string `json:"solution"`
	Solved    bool   `json:"solved"`
}

const selectExercises = `
SELECT e.id, e.topic_id, t.title, e.title, e.statement, e.solution, e.solved,
       e.pdf_name, COALESCE(octet_length(e.pdf_data), 0)
FROM exercises e JOIN topics t ON t.id = e.topic_id`

type Store struct{ db *pgxpool.Pool }

func NewStore(db *pgxpool.Pool) *Store { return &Store{db} }

type scanner interface{ Scan(dest ...any) error }

func scan(r scanner) (Exercise, error) {
	var e Exercise
	err := r.Scan(&e.ID, &e.TopicID, &e.TopicTitle, &e.Title, &e.Statement, &e.Solution, &e.Solved, &e.PdfName, &e.PdfSize)
	return e, err
}

func (s *Store) List(ctx context.Context, topicID int64) ([]Exercise, error) {
	rows, err := s.db.Query(ctx, selectExercises+` WHERE ($1::bigint = 0 OR e.topic_id = $1) ORDER BY e.solved, e.id DESC`, topicID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Exercise{}
	for rows.Next() {
		e, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) Get(ctx context.Context, id int64) (Exercise, error) {
	return scan(s.db.QueryRow(ctx, selectExercises+` WHERE e.id=$1`, id))
}

func Register(mux *http.ServeMux, s *Store) {
	mux.HandleFunc("GET /api/exercises", func(w http.ResponseWriter, r *http.Request) {
		topicID, _ := strconv.ParseInt(r.URL.Query().Get("topicId"), 10, 64)
		list, err := s.List(r.Context(), topicID)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusOK, list)
	})
	mux.HandleFunc("POST /api/exercises", func(w http.ResponseWriter, r *http.Request) {
		var in input
		if err := httpx.Decode(r, &in); err != nil || in.TopicID == 0 || strings.TrimSpace(in.Title) == "" {
			httpx.Error(w, http.StatusBadRequest, "topicId e title são obrigatórios")
			return
		}
		var id int64
		err := s.db.QueryRow(r.Context(),
			`INSERT INTO exercises (topic_id, title, statement, solution, solved) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
			in.TopicID, strings.TrimSpace(in.Title), in.Statement, in.Solution, in.Solved).Scan(&id)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		e, err := s.Get(r.Context(), id)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, e)
	})
	mux.HandleFunc("PUT /api/exercises/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "id inválido")
			return
		}
		var in input
		if err := httpx.Decode(r, &in); err != nil || in.TopicID == 0 || strings.TrimSpace(in.Title) == "" {
			httpx.Error(w, http.StatusBadRequest, "topicId e title são obrigatórios")
			return
		}
		tag, err := s.db.Exec(r.Context(),
			`UPDATE exercises SET topic_id=$2, title=$3, statement=$4, solution=$5, solved=$6 WHERE id=$1`,
			id, in.TopicID, strings.TrimSpace(in.Title), in.Statement, in.Solution, in.Solved)
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
	mux.HandleFunc("DELETE /api/exercises/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "id inválido")
			return
		}
		if _, err := s.db.Exec(r.Context(), `DELETE FROM exercises WHERE id=$1`, id); err != nil {
			httpx.Fail(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
	registerPDF(mux, s)
}
