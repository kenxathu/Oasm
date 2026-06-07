package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/go-rod/rod"
	"github.com/oasm-platform/oasm-sdk-go/oasm"
	"github.com/oasm-platform/open-asm/grpc-client/go/jobs_registry"
)

var jobLogGlobal = oasm.NewLogger("Worker.Job")

func processJob(ctx context.Context, client *oasm.Client, browser *rod.Browser, toolPath string, jobTimeoutSeconds int) {
	job, err := client.JobsNext(ctx)
	if err != nil {
		jobLogGlobal.ErrorE("Failed to pull job", err)
		return
	}
	if job == nil || job.Id == "" {
		return
	}

	activeJobsMu.Lock()
	activeJobs[job.Id] = struct{}{}
	activeJobsMu.Unlock()

	defer func() {
		activeJobsMu.Lock()
		delete(activeJobs, job.Id)
		activeJobsMu.Unlock()
	}()

	cmdStr := job.GetCommand()
	if cmdStr == "" {
		jobLogGlobal.Warning("[%s] Empty command", job.Id)
		_ = client.JobsResult(ctx, job.Id, oasm.NewErrorResult("No command provided by Core"))
		return
	}

	jobLogGlobal.Info("[%s] Executing: %s", job.Id, cmdStr)
	var payload *jobs_registry.DataPayloadResult

	if after, ok := strings.CutPrefix(cmdStr, "screenshot "); ok {
		url := strings.TrimSpace(after)
		jobLogGlobal.Debug("[%s] Capturing screenshot: %s", job.Id, url)

		base64Image, err := TakeScreenshotBase64(ctx, browser, url)
		if err != nil {
			jobLogGlobal.Warning("[%s] Screenshot capture failed: %v", job.Id, err)
			payload = oasm.NewErrorResult(fmt.Sprintf("Screenshot capture failed: %v", err))
		} else {
			resultData := struct {
				Screenshot string `json:"screenshot"`
				URL        string `json:"url"`
			}{
				Screenshot: base64Image,
				URL:        formatURL(url),
			}

			if jsonBytes, err := json.Marshal(resultData); err != nil {
				jobLogGlobal.ErrorE(fmt.Sprintf("[%s] JSON marshal failed", job.Id), err)
				payload = oasm.NewErrorResult(fmt.Sprintf("JSON error: %v", err))
			} else {
				jsonStr := string(jsonBytes)
				payload = &jobs_registry.DataPayloadResult{
					Error: false,
					Raw:   &jsonStr,
				}
			}
		}
	} else {
		if jobTimeoutSeconds <= 0 {
			jobTimeoutSeconds = 300
		}
		jobCtx, cancel := context.WithTimeout(ctx, time.Duration(jobTimeoutSeconds)*time.Second)
		defer cancel()

		var cmd *exec.Cmd
		if runtime.GOOS == "windows" {
			cmd = exec.CommandContext(jobCtx, "cmd", "/C", cmdStr)
		} else {
			cmd = exec.CommandContext(jobCtx, "sh", "-c", cmdStr)
		}
		cmd.SysProcAttr = newSysProcAttr()
		cmd.Env = setupCmdEnv(toolPath)

		output, err := cmd.CombinedOutput()
		outStr := string(output)
		if jobCtx.Err() == context.DeadlineExceeded {
			jobLogGlobal.Warning("[%s] Command timed out after %d seconds", job.Id, jobTimeoutSeconds)
			payload = oasm.NewErrorResult(fmt.Sprintf("Command timed out after %d seconds\n%s", jobTimeoutSeconds, outStr))
		} else if err != nil {
			jobLogGlobal.Verbose("[%s] Process exited with error: %v", job.Id, err)
			payload = oasm.NewErrorResult(fmt.Sprintf("Command failed: %v\n%s", err, outStr))
		} else if strings.TrimSpace(outStr) == "" {
			jobLogGlobal.Warning("[%s] Command produced no output", job.Id)
			payload = oasm.NewErrorResult("Command produced no output")
		} else {
			payload = &jobs_registry.DataPayloadResult{
				Error: false,
				Raw:   &outStr,
			}
		}
	}

	if err := client.JobsResult(ctx, job.Id, payload); err != nil {
		jobLogGlobal.ErrorE(fmt.Sprintf("[%s] Failed to submit result", job.Id), err)
		return
	}

	jobLogGlobal.Success("[%s] Completed", job.Id)
}
