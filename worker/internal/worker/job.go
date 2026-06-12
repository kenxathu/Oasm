package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/go-rod/rod"
	"github.com/oasm-platform/oasm-sdk-go/oasm"
	"github.com/oasm-platform/open-asm/grpc-client/go/jobs_registry"
)

var jobLogGlobal = oasm.NewLogger("Worker.Job")

type pingProbe func(context.Context, string) (time.Duration, bool, error)

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

		if preflightPayload, shouldRun := pingPreflightPayload(jobCtx, job, pingHost); !shouldRun {
			payload = preflightPayload
		} else {
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
				if isEmptyOutputSuccessCommand(cmdStr) {
					payload = &jobs_registry.DataPayloadResult{
						Error: false,
						Raw:   &outStr,
					}
				} else {
					jobLogGlobal.Warning("[%s] Command produced no output", job.Id)
					payload = oasm.NewErrorResult("Command produced no output")
				}
			} else {
				payload = &jobs_registry.DataPayloadResult{
					Error: false,
					Raw:   &outStr,
				}
			}
		}
	}

	if err := client.JobsResult(ctx, job.Id, payload); err != nil {
		jobLogGlobal.ErrorE(fmt.Sprintf("[%s] Failed to submit result", job.Id), err)
		return
	}

	jobLogGlobal.Success("[%s] Completed", job.Id)
}

func isEmptyOutputSuccessCommand(cmdStr string) bool {
	return strings.Contains(strings.ToLower(cmdStr), "nuclei")
}

func pingPreflightPayload(ctx context.Context, job *jobs_registry.Job, probe pingProbe) (*jobs_registry.DataPayloadResult, bool) {
	cmdStr := job.GetCommand()
	assetValue := strings.TrimSpace(job.GetAsset().GetValue())
	if !shouldPingBeforeScan(assetValue, cmdStr) {
		return nil, true
	}

	latency, reachable, err := probe(ctx, assetValue)
	if err != nil {
		jobLogGlobal.Warning("[%s] Ping failed for %s: %v", job.GetId(), assetValue, err)
	}
	if reachable {
		jobLogGlobal.Info("[%s] Ping succeeded for %s in %s", job.GetId(), assetValue, latency.Round(time.Millisecond))
		return nil, true
	}

	jobLogGlobal.Info("[%s] Skipping scan for unreachable internal IP %s", job.GetId(), assetValue)
	raw := ""
	return &jobs_registry.DataPayloadResult{
		Error: false,
		Raw:   &raw,
	}, false
}

func shouldPingBeforeScan(assetValue, cmdStr string) bool {
	ip := net.ParseIP(strings.TrimSpace(assetValue))
	if ip == nil || ip.To4() == nil {
		return false
	}
	if !isInternalScanIP(ip) {
		return false
	}
	return isPingPreflightScanCommand(cmdStr)
}

func isInternalScanIP(ip net.IP) bool {
	return ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast()
}

func isPingPreflightScanCommand(cmdStr string) bool {
	lower := strings.ToLower(cmdStr)
	for _, tool := range []string{"naabu", "nmap", "nuclei", "nikto"} {
		if strings.Contains(lower, tool) {
			return true
		}
	}
	return false
}

func pingHost(ctx context.Context, ip string) (time.Duration, bool, error) {
	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	name, args := pingCommand(ip)
	start := time.Now()
	cmd := exec.CommandContext(pingCtx, name, args...)
	cmd.SysProcAttr = newSysProcAttr()
	_, err := cmd.CombinedOutput()
	elapsed := time.Since(start)
	if pingCtx.Err() == context.DeadlineExceeded {
		return elapsed, false, pingCtx.Err()
	}
	if err != nil {
		return elapsed, false, err
	}
	return elapsed, true, nil
}

func pingCommand(ip string) (string, []string) {
	switch runtime.GOOS {
	case "windows":
		return "ping", []string{"-n", "1", "-w", "1000", ip}
	case "darwin":
		return "ping", []string{"-c", "1", "-W", "1000", ip}
	default:
		return "ping", []string{"-c", "1", "-W", "1", ip}
	}
}
