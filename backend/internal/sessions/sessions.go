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

func (s *Store) Get(ctx context.Context, id int64) (Session, error) {
	var out Session
	err := s.db.QueryRow(ctx, selectSessions+` WHERE s.id=$1`, id).
		Scan(&out.ID, &out.TopicID, &out.TopicTitle, &out.Date, &out.Minutes, &out.Note)
	return out, err
}

// syncStatus ajusta o status do tópico com meta às horas registradas
// (tópicos sem meta são avulsos e não têm status):
// atingiu a meta → concluído; começou a estudar → em andamento;
// estava concluído mas as horas caíram abaixo da meta (edição/remoção) → em andamento.
func (s *Store) syncStatus(ctx context.Context, topicID int64) error {
	_, err := s.db.Exec(ctx, `
		WITH st AS (SELECT COALESCE(SUM(minutes),0) AS studied FROM study_sessions WHERE topic_id=$1)
		UPDATE topics t SET status = CASE
			WHEN t.target_minutes > 0 AND st.studied >= t.target_minutes THEN 'done'
			WHEN t.status = 'todo' AND st.studied > 0 THEN 'in_progress'
			WHEN t.status = 'done' AND st.studied < t.target_minutes THEN 'in_progress'
			ELSE t.status END
		FROM st WHERE t.id=$1 AND t.target_minutes > 0`, topicID)
	return err
}

// validate preenche a data padrão e confere os campos obrigatórios.
func (in *input) validate() string {
	if in.TopicID == 0 || in.Minutes <= 0 {
		return "topicId e minutes (> 0) são obrigatórios"
	}
	if in.Date == "" {
		in.Date = time.Now().Format("2006-01-02")
	} else if _, err := time.Parse("2006-01-02", in.Date); err != nil {
		return "data inválida"
	}
	return ""
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
		if err := httpx.Decode(r, &in); err != nil {
			httpx.Error(w, http.StatusBadRequest, "JSON inválido")
			return
		}
		if msg := in.validate(); msg != "" {
			httpx.Error(w, http.StatusBadRequest, msg)
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
		if err := s.syncStatus(r.Context(), in.TopicID); err != nil {
			httpx.Fail(w, err)
			return
		}
		out, err := s.Get(r.Context(), id)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, out)
	})
	mux.HandleFunc("PUT /api/sessions/{id}", func(w http.ResponseWriter, r *http.Request) {
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
		var oldTopic int64
		err = s.db.QueryRow(r.Context(),
			`UPDATE study_sessions n SET topic_id=$2, date=$3::date, minutes=$4, note=$5
			 FROM study_sessions o WHERE n.id=$1 AND o.id=$1 RETURNING o.topic_id`,
			id, in.TopicID, in.Date, in.Minutes, in.Note).Scan(&oldTopic)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		for _, t := range []int64{oldTopic, in.TopicID} {
			if err := s.syncStatus(r.Context(), t); err != nil {
				httpx.Fail(w, err)
				return
			}
		}
		out, err := s.Get(r.Context(), id)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusOK, out)
	})
	mux.HandleFunc("DELETE /api/sessions/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "id inválido")
			return
		}
		var topicID int64
		err = s.db.QueryRow(r.Context(), `DELETE FROM study_sessions WHERE id=$1 RETURNING topic_id`, id).Scan(&topicID)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		if err := s.syncStatus(r.Context(), topicID); err != nil {
			httpx.Fail(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
