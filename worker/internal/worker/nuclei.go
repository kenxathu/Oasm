package worker

import (
	"context"
	"os"
	"path/filepath"

	"github.com/oasm-platform/oasm-sdk-go/oasm"
)

var nucleiLog = oasm.NewLogger("Worker.Nuclei")

func checkNucleiTemplates(ctx context.Context) {
	select {
	case <-ctx.Done():
		return
	default:
	}

	templateDir := os.Getenv("NUCLEI_TEMPLATES_DIR")
	if templateDir == "" {
		templateDir = filepath.Join(os.Getenv("HOME"), "nuclei-templates")
	}

	hasTemplates := false
	_ = filepath.WalkDir(templateDir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}

		ext := filepath.Ext(path)
		if ext == ".yaml" || ext == ".yml" {
			hasTemplates = true
			return filepath.SkipAll
		}

		return nil
	})

	if hasTemplates {
		nucleiLog.Success("Nuclei templates available at %s", templateDir)
		return
	}

	nucleiLog.Warning(
		"Nuclei templates are missing at %s. Nuclei jobs will fail until worker DNS/proxy can reach GitHub/PDTM or templates are mounted there.",
		templateDir,
	)
}
