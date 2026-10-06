package topics

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"estudo/internal/platform/httpx"

	"github.com/xuri/excelize/v2"
)

// Modelo de importação (uma linha por atividade do cronograma):
//
//	Data | Dia | Horário | Área | Tema / Atividade | Prioridade | Concluído
//
// Cada linha vira um tópico (título = Tema, descrição = Área, meta = duração do horário)
// e um item no cronograma na data indicada. "Dia" é ignorado (derivado da data).
// Prioridade aceita ALTA, MÉDIA ou BAIXA (vazia = média).
var templateHeaders = []string{"Data", "Dia", "Horário", "Área", "Tema / Atividade", "Prioridade", "Concluído"}

type ImportRow struct {
	Line      int    `json:"line"`
	Date      string `json:"date"`
	Time      string `json:"time"`
	Area      string `json:"area"`
	Title     string `json:"title"`
	Priority  string `json:"priority"`
	Minutes   int    `json:"minutes"`
	Done      bool   `json:"done"`
	Duplicate bool   `json:"duplicate"`
}

type ImportResult struct {
	Sheet    string      `json:"sheet"`
	Rows     []ImportRow `json:"rows"`
	Errors   []string    `json:"errors"`
	Imported int         `json:"imported"`
}

type columns struct{ date, time, area, title, priority, done int }

var accents = strings.NewReplacer("á", "a", "à", "a", "â", "a", "ã", "a", "é", "e", "ê", "e", "í", "i", "ó", "o", "ô", "o", "õ", "o", "ú", "u", "ç", "c")

func norm(s string) string { return accents.Replace(strings.ToLower(strings.TrimSpace(s))) }

// findHeader procura a linha de cabeçalho do modelo e devolve o índice das colunas.
func findHeader(row []string) (columns, bool) {
	c := columns{-1, -1, -1, -1, -1, -1}
	for i, h := range row {
		switch n := norm(h); {
		case n == "data":
			c.date = i
		case n == "horario":
			c.time = i
		case n == "area":
			c.area = i
		case strings.HasPrefix(n, "tema"):
			c.title = i
		case n == "prioridade":
			c.priority = i
		case n == "concluido":
			c.done = i
		}
	}
	return c, c.date >= 0 && c.title >= 0
}

func cell(row []string, i int) string {
	if i < 0 || i >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[i])
}

func parseDate(v string) (string, error) {
	if f, err := strconv.ParseFloat(v, 64); err == nil {
		t, err := excelize.ExcelDateToTime(f, false)
		if err != nil {
			return "", err
		}
		return t.Format("2006-01-02"), nil
	}
	for _, layout := range []string{"02/01/2006", "2/1/2006", "2006-01-02", "02/01/06"} {
		if t, err := time.Parse(layout, v); err == nil {
			return t.Format("2006-01-02"), nil
		}
	}
	return "", fmt.Errorf("data inválida %q (use dd/mm/aaaa)", v)
}

var timeRange = regexp.MustCompile(`^(\d{1,2})\s*[h:]?\s*(\d{2})?\s*h?\s*(?:–|—|-|a|às)\s*(\d{1,2})\s*[h:]?\s*(\d{2})?`)

// rangeMinutes converte "19h–22h", "19:00 - 22:30", "19h30–22h" em minutos. Sem horário = 0.
func rangeMinutes(v string) int {
	m := timeRange.FindStringSubmatch(strings.ToLower(v))
	if m == nil {
		return 0
	}
	at := func(h, min string) int {
		hh, _ := strconv.Atoi(h)
		mm, _ := strconv.Atoi(min)
		return hh*60 + mm
	}
	d := at(m[3], m[4]) - at(m[1], m[2])
	if d < 0 {
		d += 24 * 60
	}
	return d
}

func parsePriority(v string) (string, error) {
	switch norm(v) {
	case "alta", "high":
		return "high", nil
	case "", "media", "medium":
		return "medium", nil
	case "baixa", "low":
		return "low", nil
	}
	return "", fmt.Errorf("prioridade inválida %q (use ALTA, MÉDIA ou BAIXA)", v)
}

func isDone(v string) bool {
	switch norm(v) {
	case "☑", "☒", "✓", "✔", "x", "sim", "s", "1", "true", "verdadeiro", "ok", "concluido":
		return true
	}
	return false
}

// parseWorkbook lê a primeira aba que contém o cabeçalho do modelo.
func parseWorkbook(r io.Reader) (ImportResult, error) {
	f, err := excelize.OpenReader(r)
	if err != nil {
		return ImportResult{}, errors.New("arquivo .xlsx inválido")
	}
	defer f.Close()

	for _, sheet := range f.GetSheetList() {
		rows, err := f.GetRows(sheet, excelize.Options{RawCellValue: true})
		if err != nil {
			return ImportResult{}, err
		}
		for h, header := range rows {
			cols, ok := findHeader(header)
			if !ok {
				continue
			}
			res := ImportResult{Sheet: sheet, Rows: []ImportRow{}, Errors: []string{}}
			for i, row := range rows[h+1:] {
				line := h + i + 2
				title := cell(row, cols.title)
				if title == "" {
					continue
				}
				date, err := parseDate(cell(row, cols.date))
				if err != nil {
					res.Errors = append(res.Errors, fmt.Sprintf("linha %d: %v", line, err))
					continue
				}
				priority, err := parsePriority(cell(row, cols.priority))
				if err != nil {
					res.Errors = append(res.Errors, fmt.Sprintf("linha %d: %v", line, err))
					continue
				}
				t := cell(row, cols.time)
				res.Rows = append(res.Rows, ImportRow{
					Line:    line,
					Date:    date,
					Time:    t,
					Area:    cell(row, cols.area),
					Title:    title,
					Priority: priority,
					Minutes:  rangeMinutes(t),
					Done:     isDone(cell(row, cols.done)),
				})
			}
			return res, nil
		}
	}
	return ImportResult{}, errors.New("cabeçalho não encontrado: a planilha precisa das colunas Data e Tema / Atividade")
}

// markDuplicates sinaliza linhas já importadas (mesmo título com item no cronograma na mesma data).
func (s *Store) markDuplicates(ctx context.Context, rows []ImportRow) error {
	for i := range rows {
		err := s.db.QueryRow(ctx, `SELECT EXISTS (
			SELECT 1 FROM schedule_items i JOIN topics t ON t.id = i.topic_id
			WHERE t.title = $1 AND i.date = $2::date)`, rows[i].Title, rows[i].Date).Scan(&rows[i].Duplicate)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Store) Import(ctx context.Context, rows []ImportRow) (int, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)
	n := 0
	for _, r := range rows {
		if r.Duplicate {
			continue
		}
		status := "todo"
		if r.Done {
			status = "done"
		}
		var id int64
		err := tx.QueryRow(ctx,
			`INSERT INTO topics (title, description, priority, status, target_minutes)
			 VALUES ($1,$2,$3,$4,$5) RETURNING id`,
			r.Title, r.Area, r.Priority, status, r.Minutes).Scan(&id)
		if err != nil {
			return 0, err
		}
		_, err = tx.Exec(ctx,
			`INSERT INTO schedule_items (topic_id, date, planned_minutes, done, note) VALUES ($1,$2::date,$3,$4,$5)`,
			id, r.Date, r.Minutes, r.Done, r.Time)
		if err != nil {
			return 0, err
		}
		n++
	}
	return n, tx.Commit(ctx)
}

func templateWorkbook(w io.Writer) error {
	f := excelize.NewFile()
	defer f.Close()
	const sheet = "Cronograma"
	if err := f.SetSheetName("Sheet1", sheet); err != nil {
		return err
	}
	rows := [][]any{
		{"06/10/2026", "Ter", "19h–22h", "Cálculo", "Funções: definição, domínio, contradomínio e imagem", "ALTA", "☐"},
		{"10/10/2026", "Sáb", "15h–18h", "Algoritmos", "Variáveis e operadores", "MÉDIA", "☑"},
	}
	if err := f.SetSheetRow(sheet, "A1", &templateHeaders); err != nil {
		return err
	}
	for i, r := range rows {
		if err := f.SetSheetRow(sheet, fmt.Sprintf("A%d", i+2), &r); err != nil {
			return err
		}
	}
	_ = f.SetColWidth(sheet, "A", "D", 12)
	_ = f.SetColWidth(sheet, "E", "E", 60)
	_, err := f.WriteTo(w)
	return err
}

const maxUpload = 10 << 20

func registerImport(mux *http.ServeMux, s *Store) {
	// POST /api/topics/import?dryRun=1 → só pré-visualiza; sem dryRun grava as linhas novas.
	mux.HandleFunc("POST /api/topics/import", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxUpload)
		file, _, err := r.FormFile("file")
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "envie o arquivo .xlsx no campo \"file\"")
			return
		}
		defer file.Close()
		res, err := parseWorkbook(file)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := s.markDuplicates(r.Context(), res.Rows); err != nil {
			httpx.Fail(w, err)
			return
		}
		if r.URL.Query().Get("dryRun") == "" {
			if res.Imported, err = s.Import(r.Context(), res.Rows); err != nil {
				httpx.Fail(w, err)
				return
			}
		}
		httpx.JSON(w, http.StatusOK, res)
	})
	mux.HandleFunc("GET /api/topics/import/template", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", `attachment; filename="modelo_importacao_topicos.xlsx"`)
		if err := templateWorkbook(w); err != nil {
			httpx.Fail(w, err)
		}
	})
}
