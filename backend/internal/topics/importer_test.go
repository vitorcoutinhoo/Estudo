package topics

import (
	"bytes"
	"testing"
	"time"

	"github.com/xuri/excelize/v2"
)

func TestParseWorkbook(t *testing.T) {
	f := excelize.NewFile()
	sh := "Sheet1"
	_ = f.SetSheetRow(sh, "A2", &templateHeaders)
	_ = f.SetSheetRow(sh, "A3", &[]any{"06/10/2026", "Ter", "19h–22h", "Cálculo", "Funções: definição", "ALTA", "☐"})
	_ = f.SetSheetRow(sh, "A4", &[]any{time.Date(2026, 10, 10, 0, 0, 0, 0, time.UTC), "Sáb", "15h-18h", "Algoritmos", "Variáveis", "MÉDIA", "☑"})
	_ = f.SetSheetRow(sh, "A5", &[]any{"11/12/2026", "Sex", "—", "PROVA", "PROVA ESCRITA", "", "☐"})
	_ = f.SetSheetRow(sh, "A6", &[]any{"31/02/2026", "", "", "", "Data ruim", "", ""})
	_ = f.SetSheetRow(sh, "A7", &[]any{"12/12/2026", "", "", "", "Prioridade ruim", "URGENTE", ""})
	var buf bytes.Buffer
	if _, err := f.WriteTo(&buf); err != nil {
		t.Fatal(err)
	}

	res, err := parseWorkbook(&buf)
	if err != nil {
		t.Fatal(err)
	}
	want := []ImportRow{
		{Line: 3, Date: "2026-10-06", Time: "19h–22h", Area: "Cálculo", Title: "Funções: definição", Priority: "high", Minutes: 180},
		{Line: 4, Date: "2026-10-10", Time: "15h-18h", Area: "Algoritmos", Title: "Variáveis", Priority: "medium", Minutes: 180, Done: true},
		{Line: 5, Date: "2026-12-11", Time: "—", Area: "PROVA", Title: "PROVA ESCRITA", Priority: "medium"},
	}
	if len(res.Rows) != len(want) {
		t.Fatalf("rows = %+v", res.Rows)
	}
	for i := range want {
		if res.Rows[i] != want[i] {
			t.Errorf("row %d = %+v, want %+v", i, res.Rows[i], want[i])
		}
	}
	if len(res.Errors) != 2 {
		t.Errorf("errors = %v", res.Errors)
	}
}

func TestRangeMinutes(t *testing.T) {
	for in, want := range map[string]int{"19h–22h": 180, "19:00 - 22:30": 210, "19h30–22h": 150, "23h-1h": 120, "—": 0} {
		if got := rangeMinutes(in); got != want {
			t.Errorf("rangeMinutes(%q) = %d, want %d", in, got, want)
		}
	}
}
