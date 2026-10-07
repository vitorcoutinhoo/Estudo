package schedule

import (
	"context"
	"net/http"
	"strconv"
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
	StartTime      string `json:"startTime"` // "HH:MM" ou "" quando sem horário
	EndTime        string `json:"endTime"`
	PlannedMinutes int    `json:"plannedMinutes"`
	Done           bool   `json:"done"`
	Note           string `json:"note"`
}

// input é usado na criação e na edição completa de um item (período de estudo).
type input struct {
	TopicID        int64  `json:"topicId"`
	Date           string `json:"date"`
	StartTime      string `json:"startTime"`
	EndTime        string `json:"endTime"`
	PlannedMinutes int    `json:"plannedMinutes"`
	Note           string `json:"note"`
	Done           bool   `json:"done"`
}

type patchInput struct {
	Done           *bool   `json:"done"`
	PlannedMinutes *int    `json:"plannedMinutes"`
	Date           *string `json:"date"`
	Note           *string `json:"note"`
}

const selectItems = `
SELECT i.id, i.topic_id, t.title, t.priority, to_char(i.date,'YYYY-MM-DD'),
  COALESCE(to_char(i.start_time,'HH24:MI'),''), COALESCE(to_char(i.end_time,'HH24:MI'),''),
  i.planned_minutes, i.done, i.note
FROM schedule_items i JOIN topics t ON t.id = i.topic_id`

type Store struct{ db *pgxpool.Pool }

func NewStore(db *pgxpool.Pool) *Store { return &Store{db} }

type scanner interface{ Scan(dest ...any) error }

func scan(r scanner) (Item, error) {
	var i Item
	err := r.Scan(&i.ID, &i.TopicID, &i.TopicTitle, &i.TopicPriority, &i.Date, &i.StartTime, &i.EndTime,
		&i.PlannedMinutes, &i.Done, &i.Note)
	return i, err
}

func (s *Store) query(ctx context.Context, where string, args ...any) ([]Item, error) {
	rows, err := s.db.Query(ctx, selectItems+where, args...)
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

func (s *Store) Range(ctx context.Context, from, to string) ([]Item, error) {
	return s.query(ctx, ` WHERE i.date BETWEEN $1::date AND $2::date ORDER BY i.date, i.start_time NULLS LAST, i.done, i.id`, from, to)
}

func (s *Store) ByTopic(ctx context.Context, topicID int64) ([]Item, error) {
	return s.query(ctx, ` WHERE i.topic_id = $1 ORDER BY i.date, i.start_time NULLS LAST, i.id`, topicID)
}

func (s *Store) Get(ctx context.Context, id int64) (Item, error) {
	return scan(s.db.QueryRow(ctx, selectItems+` WHERE i.id=$1`, id))
}

func validDate(d string) bool {
	_, err := time.Parse("2006-01-02", d)
	return err == nil
}

func clock(v string) (time.Time, bool) {
	t, err := time.Parse("15:04", v)
	return t, err == nil
}

// validate confere o item e, quando há horário, calcula os minutos planejados a partir dele.
func (in *input) validate() string {
	if in.TopicID == 0 || !validDate(in.Date) {
		return "topicId e date (YYYY-MM-DD) são obrigatórios"
	}
	if in.StartTime == "" && in.EndTime == "" {
		if in.PlannedMinutes <= 0 {
			in.PlannedMinutes = 60
		}
		return ""
	}
	start, ok1 := clock(in.StartTime)
	end, ok2 := clock(in.EndTime)
	if !ok1 || !ok2 {
		return "informe início e fim no formato HH:MM"
	}
	d := int(end.Sub(start).Minutes())
	if d <= 0 {
		d += 24 * 60 // atravessa a meia-noite
	}
	in.PlannedMinutes = d
	return ""
}

// nullable converte "" em NULL para as colunas de horário.
func nullable(v string) *string {
	if v == "" {
		return nil
	}
	return &v
}

func Register(mux *http.ServeMux, s *Store) {
	// GET /api/schedule?from=&to=  → itens no intervalo
	// GET /api/schedule?topicId=   → todos os períodos de um tópico
	mux.HandleFunc("GET /api/schedule", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if q.Get("topicId") != "" {
			topicID, err := strconv.ParseInt(q.Get("topicId"), 10, 64)
			if err != nil {
				httpx.Error(w, http.StatusBadRequest, "topicId inválido")
				return
			}
			items, err := s.ByTopic(r.Context(), topicID)
			if err != nil {
				httpx.Fail(w, err)
				return
			}
			httpx.JSON(w, http.StatusOK, items)
			return
		}
		from, to := q.Get("from"), q.Get("to")
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
			`INSERT INTO schedule_items (topic_id, date, start_time, end_time, planned_minutes, note, done)
			 VALUES ($1,$2::date,$3::time,$4::time,$5,$6,$7) RETURNING id`,
			in.TopicID, in.Date, nullable(in.StartTime), nullable(in.EndTime), in.PlannedMinutes, in.Note, in.Done).Scan(&id)
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
	mux.HandleFunc("PUT /api/schedule/{id}", func(w http.ResponseWriter, r *http.Request) {
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
		tag, err := s.db.Exec(r.Context(), `UPDATE schedule_items SET
			topic_id=$2, date=$3::date, start_time=$4::time, end_time=$5::time, planned_minutes=$6, note=$7, done=$8
			WHERE id=$1`,
			id, in.TopicID, in.Date, nullable(in.StartTime), nullable(in.EndTime), in.PlannedMinutes, in.Note, in.Done)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		if tag.RowsAffected() == 0 {
			httpx.Error(w, http.StatusNotFound, "não encontrado")
			return
		}
		it, err := s.Get(r.Context(), id)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		httpx.JSON(w, http.StatusOK, it)
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
