package topics

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"estudo/internal/platform/httpx"

	"github.com/jackc/pgx/v5/pgxpool"
)

var errNotFound = errors.New("not found")

type Topic struct {
	ID              int64     `json:"id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	Priority        string    `json:"priority"`
	Status          string    `json:"status"`
	TargetMinutes   int       `json:"targetMinutes"`
	StudiedMinutes  int       `json:"studiedMinutes"`
	Progress        int       `json:"progress"`
	ExercisesTotal  int       `json:"exercisesTotal"`
	ExercisesSolved int       `json:"exercisesSolved"`
	CreatedAt       time.Time `json:"createdAt"`
}

type input struct {
	Title         string `json:"title"`
	Description   string `json:"description"`
	Priority      string `json:"priority"`
	Status        string `json:"status"`
	TargetMinutes int    `json:"targetMinutes"`
}

func (in *input) validate() string {
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" {
		return "título é obrigatório"
	}
	if in.Priority == "" {
		in.Priority = "medium"
	}
	if in.Status == "" {
		in.Status = "todo"
	}
	switch in.Priority {
	case "low", "medium", "high":
	default:
		return "prioridade inválida"
	}
	switch in.Status {
	case "todo", "in_progress", "done":
	default:
		return "status inválido"
	}
	if in.TargetMinutes < 0 {
		return "meta de horas inválida"
	}
	return ""
}

const selectTopics = `
SELECT t.id, t.title, t.description, t.priority, t.status, t.target_minutes,
  COALESCE((SELECT SUM(minutes) FROM study_sessions s WHERE s.topic_id = t.id), 0)::int,
  (SELECT COUNT(*) FROM exercises e WHERE e.topic_id = t.id)::int,
  (SELECT COUNT(*) FROM exercises e WHERE e.topic_id = t.id AND e.solved)::int,
  t.created_at
FROM topics t`

type Store struct{ db *pgxpool.Pool }

func NewStore(db *pgxpool.Pool) *Store { return &Store{db} }

type scanner interface{ Scan(dest ...any) error }

func scan(row scanner) (Topic, error) {
	var t Topic
	err := row.Scan(&t.ID, &t.Title, &t.Description, &t.Priority, &t.Status, &t.TargetMinutes,
		&t.StudiedMinutes, &t.ExercisesTotal, &t.ExercisesSolved, &t.CreatedAt)
	t.Progress = progress(t)
	return t, err
}

// progress: tópico concluído = 100%; senão, horas estudadas / meta de horas.
func progress(t Topic) int {
	if t.Status == "done" {
		return 100
	}
	if t.TargetMinutes <= 0 {
		return 0
	}
	return min(100, t.StudiedMinutes*100/t.TargetMinutes)
}

func (s *Store) List(ctx context.Context) ([]Topic, error) {
	rows, err := s.db.Query(ctx, selectTopics+` ORDER BY
	  CASE t.status WHEN 'in_progress' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END,
	  CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Topic{}
	for rows.Next() {
		t, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) Get(ctx context.Context, id int64) (Topic, error) {
	return scan(s.db.QueryRow(ctx, selectTopics+` WHERE t.id = $1`, id))
}

func (s *Store) Create(ctx context.Context, in input) (Topic, error) {
	var id int64
	err := s.db.QueryRow(ctx,
		`INSERT INTO topics (title, description, priority, status, target_minutes)
		 VALUES ($1,$2,$3,$4,$5) RETURNING id`,
		in.Title, in.Description, in.Priority, in.Status, in.TargetMinutes).Scan(&id)
	if err != nil {
		return Topic{}, err
	}
	return s.Get(ctx, id)
}

func (s *Store) Update(ctx context.Context, id int64, in input) (Topic, error) {
	tag, err := s.db.Exec(ctx,
		`UPDATE topics SET title=$2, description=$3, priority=$4, status=$5, target_minutes=$6 WHERE id=$1`,
		id, in.Title, in.Description, in.Priority, in.Status, in.TargetMinutes)
	if err != nil {
		return Topic{}, err
	}
	if tag.RowsAffected() == 0 {
		return Topic{}, errNotFound
	}
	return s.Get(ctx, id)
}

func (s *Store) Delete(ctx context.Context, id int64) error {
	_, err := s.db.Exec(ctx, `DELETE FROM topics WHERE id=$1`, id)
	return err
}

func Register(mux *http.ServeMux, s *Store) {
	registerImport(mux, s)
	mux.HandleFunc("GET /api/topics", func(w http.ResponseWriter, r *http.Request) {
		list, err := s.List(r.Context())
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusOK, list)
	})
	mux.HandleFunc("POST /api/topics", func(w http.ResponseWriter, r *http.Request) {
		var in input
		if err := httpx.Decode(r, &in); err != nil {
			httpx.Error(w, http.StatusBadRequest, "JSON inválido")
			return
		}
		if msg := in.validate(); msg != "" {
			httpx.Error(w, http.StatusBadRequest, msg)
			return
		}
		t, err := s.Create(r.Context(), in)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, t)
	})
	mux.HandleFunc("PUT /api/topics/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "id inválido")
			return
		}
		var in input
		if err := httpx.Decode(r, &in); err != nil {
			httpx.Error(w, http.StatusBadRequest, "JSON inválido")
			return
		}
		if msg := in.validate(); msg != "" {
			httpx.Error(w, http.StatusBadRequest, msg)
			return
		}
		t, err := s.Update(r.Context(), id, in)
		if errors.Is(err, errNotFound) {
			httpx.Error(w, http.StatusNotFound, "não encontrado")
			return
		}
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusOK, t)
	})
	mux.HandleFunc("DELETE /api/topics/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "id inválido")
			return
		}
		if err := s.Delete(r.Context(), id); err != nil {
			httpx.Fail(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
