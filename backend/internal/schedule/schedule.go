package schedule

import (
	"context"
	"net/http"
	"time"

	"estudo/internal/platform/httpx"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Item struct {
	ID             int64  `json:"id"`
	TopicID        int64  `json:"topicId"`
	TopicTitle     string `json:"topicTitle"`
	TopicPriority  string `json:"topicPriority"`
	Date           string `json:"date"`
	PlannedMinutes int    `json:"plannedMinutes"`
	Done           bool   `json:"done"`
	Note           string `json:"note"`
}

type createInput struct {
	TopicID        int64  `json:"topicId"`
	Date           string `json:"date"`
	PlannedMinutes int    `json:"plannedMinutes"`
	Note           string `json:"note"`
}

type patchInput struct {
	Done           *bool   `json:"done"`
	PlannedMinutes *int    `json:"plannedMinutes"`
	Date           *string `json:"date"`
	Note           *string `json:"note"`
}

const selectItems = `
SELECT i.id, i.topic_id, t.title, t.priority, to_char(i.date,'YYYY-MM-DD'), i.planned_minutes, i.done, i.note
FROM schedule_items i JOIN topics t ON t.id = i.topic_id`

type Store struct{ db *pgxpool.Pool }

func NewStore(db *pgxpool.Pool) *Store { return &Store{db} }

type scanner interface{ Scan(dest ...any) error }

func scan(r scanner) (Item, error) {
	var i Item
	err := r.Scan(&i.ID, &i.TopicID, &i.TopicTitle, &i.TopicPriority, &i.Date, &i.PlannedMinutes, &i.Done, &i.Note)
	return i, err
}

func (s *Store) Range(ctx context.Context, from, to string) ([]Item, error) {
	rows, err := s.db.Query(ctx, selectItems+` WHERE i.date BETWEEN $1::date AND $2::date ORDER BY i.date, i.done, i.id`, from, to)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Item{}
	for rows.Next() {
		it, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}

func (s *Store) Get(ctx context.Context, id int64) (Item, error) {
	return scan(s.db.QueryRow(ctx, selectItems+` WHERE i.id=$1`, id))
}

func validDate(d string) bool {
	_, err := time.Parse("2006-01-02", d)
	return err == nil
}

func Register(mux *http.ServeMux, s *Store) {
	mux.HandleFunc("GET /api/schedule", func(w http.ResponseWriter, r *http.Request) {
		from := r.URL.Query().Get("from")
		to := r.URL.Query().Get("to")
		if to == "" {
			to = from
		}
		if !validDate(from) || !validDate(to) {
			httpx.Error(w, http.StatusBadRequest, "informe from/to no formato YYYY-MM-DD")
			return
		}
		items, err := s.Range(r.Context(), from, to)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusOK, items)
	})
	mux.HandleFunc("POST /api/schedule", func(w http.ResponseWriter, r *http.Request) {
		var in createInput
		if err := httpx.Decode(r, &in); err != nil || in.TopicID == 0 || !validDate(in.Date) {
			httpx.Error(w, http.StatusBadRequest, "topicId e date (YYYY-MM-DD) são obrigatórios")
			return
		}
		if in.PlannedMinutes <= 0 {
			in.PlannedMinutes = 60
		}
		var id int64
		err := s.db.QueryRow(r.Context(),
			`INSERT INTO schedule_items (topic_id, date, planned_minutes, note) VALUES ($1,$2::date,$3,$4) RETURNING id`,
			in.TopicID, in.Date, in.PlannedMinutes, in.Note).Scan(&id)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		it, err := s.Get(r.Context(), id)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusCreated, it)
	})
	mux.HandleFunc("PATCH /api/schedule/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "id inválido")
			return
		}
		var in patchInput
		if err := httpx.Decode(r, &in); err != nil {
			httpx.Error(w, http.StatusBadRequest, "JSON inválido")
			return
		}
		if in.Date != nil && !validDate(*in.Date) {
			httpx.Error(w, http.StatusBadRequest, "data inválida")
			return
		}
		_, err = s.db.Exec(r.Context(), `UPDATE schedule_items SET
			done = COALESCE($2, done),
			planned_minutes = COALESCE($3, planned_minutes),
			date = COALESCE($4::date, date),
			note = COALESCE($5, note)
			WHERE id=$1`, id, in.Done, in.PlannedMinutes, in.Date, in.Note)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		it, err := s.Get(r.Context(), id)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusOK, it)
	})
	mux.HandleFunc("DELETE /api/schedule/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := httpx.PathID(r)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "id inválido")
			return
		}
		if _, err := s.db.Exec(r.Context(), `DELETE FROM schedule_items WHERE id=$1`, id); err != nil {
			httpx.Fail(w, err)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	})
}
