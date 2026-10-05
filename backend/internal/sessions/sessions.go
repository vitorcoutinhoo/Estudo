package sessions

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"estudo/internal/platform/httpx"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Session struct {
	ID         int64  `json:"id"`
	TopicID    int64  `json:"topicId"`
	TopicTitle string `json:"topicTitle"`
	Date       string `json:"date"`
	Minutes    int    `json:"minutes"`
	Note       string `json:"note"`
}

type input struct {
	TopicID int64  `json:"topicId"`
	Date    string `json:"date"`
	Minutes int    `json:"minutes"`
	Note    string `json:"note"`
}

const selectSessions = `
SELECT s.id, s.topic_id, t.title, to_char(s.date,'YYYY-MM-DD'), s.minutes, s.note
FROM study_sessions s JOIN topics t ON t.id = s.topic_id`

type Store struct{ db *pgxpool.Pool }

func NewStore(db *pgxpool.Pool) *Store { return &Store{db} }

func (s *Store) List(ctx context.Context, topicID int64) ([]Session, error) {
	rows, err := s.db.Query(ctx, selectSessions+`
		WHERE ($1::bigint = 0 OR s.topic_id = $1) ORDER BY s.date DESC, s.id DESC LIMIT 200`, topicID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Session{}
	for rows.Next() {
		var x Session
		if err := rows.Scan(&x.ID, &x.TopicID, &x.TopicTitle, &x.Date, &x.Minutes, &x.Note); err != nil {
			return nil, err
		}
		out = append(out, x)
	}
	return out, rows.Err()
}

func Register(mux *http.ServeMux, s *Store) {
	mux.HandleFunc("GET /api/sessions", func(w http.ResponseWriter, r *http.Request) {
		topicID, _ := strconv.ParseInt(r.URL.Query().Get("topicId"), 10, 64)
		list, err := s.List(r.Context(), topicID)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusOK, list)
	})
	mux.HandleFunc("POST /api/sessions", func(w http.ResponseWriter, r *http.Request) {
		var in input
		if err := httpx.Decode(r, &in); err != nil || in.TopicID == 0 || in.Minutes <= 0 {
			httpx.Error(w, http.StatusBadRequest, "topicId e minutes (> 0) são obrigatórios")
			return
		}
		if in.Date == "" {
			in.Date = time.Now().Format("2006-01-02")
		} else if _, err := time.Parse("2006-01-02", in.Date); err != nil {
			httpx.Error(w, http.StatusBadRequest, "data inválida")
			return
		}
		var id int64
		err := s.db.QueryRow(r.Context(),
			`INSERT INTO study_sessions (topic_id, date, minutes, note) VALUES ($1,$2::date,$3,$4) RETURNING id`,
			in.TopicID, in.Date, in.Minutes, in.Note).Scan(&id)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		var out Session
		err = s.db.QueryRow(r.Context(), selectSessions+` WHERE s.id=$1`, id).
			Scan(&out.ID, &out.TopicID, &out.TopicTitle, &out.Date, &out.Minutes, &out.Note)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, out)
	})
	mux.HandleFunc("DELETE /api/sessions/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "id inválido")
			return
		}
		if _, err := s.db.Exec(r.Context(), `DELETE FROM study_sessions WHERE id=$1`, id); err != nil {
			httpx.Fail(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
