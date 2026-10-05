package dashboard

import (
	"net/http"
	"time"

	"estudo/internal/platform/httpx"

	"github.com/jackc/pgx/v5/pgxpool"
)

type DayMinutes struct {
	Date    string `json:"date"`
	Minutes int    `json:"minutes"`
}

type Summary struct {
	TotalMinutes     int          `json:"totalMinutes"`
	TodayMinutes     int          `json:"todayMinutes"`
	TodayPlanned     int          `json:"todayPlanned"`
	TodayItems       int          `json:"todayItems"`
	TodayItemsDone   int          `json:"todayItemsDone"`
	Topics           int          `json:"topics"`
	TopicsDone       int          `json:"topicsDone"`
	TopicsInProgress int          `json:"topicsInProgress"`
	ExercisesTotal   int          `json:"exercisesTotal"`
	ExercisesSolved  int          `json:"exercisesSolved"`
	Last7Days        []DayMinutes `json:"last7Days"`
}

func Register(mux *http.ServeMux, db *pgxpool.Pool) {
	mux.HandleFunc("GET /api/dashboard", func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()
		// o cliente envia "today" para respeitar o fuso horário do navegador
		today := r.URL.Query().Get("today")
		if _, err := time.Parse("2006-01-02", today); err != nil {
			today = time.Now().Format("2006-01-02")
		}
		var s Summary
		err := db.QueryRow(ctx, `SELECT
			COALESCE((SELECT SUM(minutes) FROM study_sessions),0)::int,
			COALESCE((SELECT SUM(minutes) FROM study_sessions WHERE date=$1::date),0)::int,
			COALESCE((SELECT SUM(planned_minutes) FROM schedule_items WHERE date=$1::date),0)::int,
			(SELECT COUNT(*) FROM schedule_items WHERE date=$1::date)::int,
			(SELECT COUNT(*) FROM schedule_items WHERE date=$1::date AND done)::int,
			(SELECT COUNT(*) FROM topics)::int,
			(SELECT COUNT(*) FROM topics WHERE status='done')::int,
			(SELECT COUNT(*) FROM topics WHERE status='in_progress')::int,
			(SELECT COUNT(*) FROM exercises)::int,
			(SELECT COUNT(*) FROM exercises WHERE solved)::int`, today).
			Scan(&s.TotalMinutes, &s.TodayMinutes, &s.TodayPlanned, &s.TodayItems, &s.TodayItemsDone,
				&s.Topics, &s.TopicsDone, &s.TopicsInProgress, &s.ExercisesTotal, &s.ExercisesSolved)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		rows, err := db.Query(ctx, `
			SELECT to_char(d::date,'YYYY-MM-DD'), COALESCE(SUM(s.minutes),0)::int
			FROM generate_series($1::date - 6, $1::date, interval '1 day') d
			LEFT JOIN study_sessions s ON s.date = d::date
			GROUP BY d ORDER BY d`, today)
		if err != nil {
			httpx.Fail(w, err)
			return
		}
		defer rows.Close()
		s.Last7Days = []DayMinutes{}
		for rows.Next() {
			var d DayMinutes
			if err := rows.Scan(&d.Date, &d.Minutes); err != nil {
				httpx.Fail(w, err)
				return
			}
			s.Last7Days = append(s.Last7Days, d)
		}
		httpx.JSON(w, http.StatusOK, s)
	})
}
