package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	pb "agent/proto"
	"google.golang.org/grpc"
)

// Config
const (
	SocketPath          = "/var/run/agent/agent.sock"
	NginxSitesDir       = "/host/etc/nginx/sites-enabled"
	Fail2BanJailDir     = "/host/etc/fail2ban/jail.d" // Must match volumes
	WafDir              = "/host/etc/nginx/modsecurity/rules.d" // WAF rules directory
	DockerProxyUrl      = "http://docker-proxy:2375"
	NginxContainer      = "nginx-admin-proxy"
	Fail2BanContainer   = "nginx-admin-fail2ban"
)

type server struct {
	pb.UnimplementedAgentServiceServer
}

func (s *server) Ping(ctx context.Context, in *pb.PingRequest) (*pb.PingResponse, error) {
	return &pb.PingResponse{Status: "OK"}, nil
}

func (s *server) ListSites(ctx context.Context, in *pb.ListSitesRequest) (*pb.ListSitesResponse, error) {
	files, err := os.ReadDir(NginxSitesDir)
	if err != nil {
		return nil, fmt.Errorf("failed to read dir: %v", err)
	}

	var sites []string
	for _, f := range files {
		if !f.IsDir() {
			sites = append(sites, f.Name())
		}
	}
	return &pb.ListSitesResponse{Sites: sites}, nil
}

func (s *server) GetSiteConfig(ctx context.Context, in *pb.GetSiteConfigRequest) (*pb.GetSiteConfigResponse, error) {
	// Security: Validate filename to prevent path traversal
	baseName := filepath.Base(in.Filename)
	if baseName != in.Filename {
		return nil, fmt.Errorf("invalid filename")
	}

	path := filepath.Join(NginxSitesDir, baseName)
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	return &pb.GetSiteConfigResponse{
		Filename:   baseName,
		Content:    string(content),
		FormatType: "nginx-conf",
	}, nil
}

// Helper to execute commands in a container via Docker Proxy
func (s *server) execInContainer(containerName string, cmd []string) (string, error) {
	type ExecConfig struct {
		AttachStdout bool     `json:"AttachStdout"`
		AttachStderr bool     `json:"AttachStderr"`
		Cmd          []string `json:"Cmd"`
	}

	config := ExecConfig{
		AttachStdout: true,
		AttachStderr: true,
		Cmd:          cmd,
	}

	configData, _ := json.Marshal(config)
	
	// 1. Create Exec Instance
	createUrl := fmt.Sprintf("%s/containers/%s/exec", DockerProxyUrl, containerName)
	resp, err := http.Post(createUrl, "application/json", bytes.NewBuffer(configData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var createResp struct {
		ID string `json:"Id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&createResp); err != nil {
		return "", err
	}

	// 2. Start Exec Instance
	startUrl := fmt.Sprintf("%s/exec/%s/start", DockerProxyUrl, createResp.ID)
	startConfig := struct {
		Detach bool `json:"Detach"`
		Tty    bool `json:"Tty"`
	}{Detach: false, Tty: false}
	startData, _ := json.Marshal(startConfig)
	
	resp, err = http.Post(startUrl, "application/json", bytes.NewBuffer(startData))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	return string(body), nil
}

// Fail2Ban Implementation
func (s *server) GetFail2BanBans(ctx context.Context, in *pb.GetBansRequest) (*pb.GetBansResponse, error) {
	// 1. Get List of Jails
	jailsResp, err := s.GetFail2BanJails(ctx, &pb.GetJailsRequest{})
	if err != nil {
		return nil, err
	}

	var allBans []*pb.BanEntry
	for _, jail := range jailsResp.Jails {
		output, err := s.execInContainer(Fail2BanContainer, []string{"fail2ban-client", "status", jail.Name})
		if err != nil {
			log.Printf("Error getting status for jail %s: %v", jail.Name, err)
			continue
		}

		// Basic parsing of "Banned IP list:" line
		lines := strings.Split(output, "\n")
		for _, line := range lines {
			if strings.Contains(line, "Banned IP list:") {
				ipPart := strings.Split(line, "Banned IP list:")[1]
				ips := strings.Fields(strings.ReplaceAll(ipPart, ",", " "))
				for _, ip := range ips {
					allBans = append(allBans, &pb.BanEntry{
						Ip:       ip,
						Jail:     jail.Name,
						BannedAt: time.Now().Format(time.RFC3339), // Fail2ban-client status doesn't give time directly easily
						Reason:   "Auto-detected",
					})
				}
			}
		}
	}

	return &pb.GetBansResponse{Bans: allBans}, nil
}

func (s *server) BanIP(ctx context.Context, in *pb.BanIPRequest) (*pb.ActionResponse, error) {
	log.Printf("Banning IP: %s", in.Ip)
	// Default to a generic jail if not specified (manual)
	_, err := s.execInContainer(Fail2BanContainer, []string{"fail2ban-client", "set", "nginx-http-auth", "banip", in.Ip})
	if err != nil {
		return &pb.ActionResponse{Success: false, Message: err.Error()}, nil
	}
	return &pb.ActionResponse{Success: true, Message: fmt.Sprintf("IP %s banned", in.Ip)}, nil
}

func (s *server) UnbanIP(ctx context.Context, in *pb.UnbanIPRequest) (*pb.ActionResponse, error) {
	log.Printf("Unbanning IP: %s", in.Ip)
	_, err := s.execInContainer(Fail2BanContainer, []string{"fail2ban-client", "unban", in.Ip})
	if err != nil {
		return &pb.ActionResponse{Success: false, Message: err.Error()}, nil
	}
	return &pb.ActionResponse{Success: true, Message: fmt.Sprintf("IP %s unbanned", in.Ip)}, nil
}

func (s *server) GetFail2BanJails(ctx context.Context, in *pb.GetJailsRequest) (*pb.GetJailsResponse, error) {
	output, err := s.execInContainer(Fail2BanContainer, []string{"fail2ban-client", "status"})
	if err != nil {
		return nil, err
	}

	// Parsing: "Jail list:	nginx-http-auth, sshd"
	var jails []*pb.JailInfo
	lines := strings.Split(output, "\n")
	for _, line := range lines {
		if strings.Contains(line, "Jail list:") {
			jailPart := strings.Split(line, "Jail list:")[1]
			names := strings.Split(strings.TrimSpace(jailPart), ",")
			for _, name := range names {
				name = strings.TrimSpace(name)
				if name == "" {
					continue
				}
				
				// Get more info for each jail
				detail, _ := s.execInContainer(Fail2BanContainer, []string{"fail2ban-client", "status", name})
				currentlyBanned := int32(0)
				if strings.Contains(detail, "Currently banned:") {
					fmt.Sscanf(strings.Split(detail, "Currently banned:")[1], "%d", &currentlyBanned)
				}

				jails = append(jails, &pb.JailInfo{
					Name:            name,
					Enabled:         true,
					CurrentlyBanned: currentlyBanned,
				})
			}
		}
	}

	return &pb.GetJailsResponse{Jails: jails}, nil
}

// Logs Streaming (Simulation)
func (s *server) StreamLogs(in *pb.StreamLogsRequest, stream pb.AgentService_StreamLogsServer) error {
	log.Printf("Starting log stream for: %s", in.Source)
	entry := &pb.LogEntry{
		Timestamp: "2026-04-06T13:00:00Z",
		Source:    in.Source,
		Level:     "INFO",
		Message:   "Log stream initialized for " + in.Source,
	}
	if err := stream.Send(entry); err != nil {
		return err
	}
	return nil
}

// Config Synchronization Engine
func (s *server) SyncConfig(ctx context.Context, in *pb.SyncConfigRequest) (*pb.ActionResponse, error) {
	// 1. Validate Target and Path
	var targetDir string
	if in.Target == "nginx" {
		targetDir = NginxSitesDir
	} else if in.Target == "fail2ban" {
		targetDir = Fail2BanJailDir
	} else if in.Target == "waf" {
		targetDir = WafDir
	} else {
		return &pb.ActionResponse{Success: false, Message: "Unknown target"}, nil
	}

	baseName := filepath.Base(in.Filename)
	if baseName != in.Filename {
		return &pb.ActionResponse{Success: false, Message: "Invalid filename (path traversal detected)"}, nil
	}

	// 2. Syntax Validation (Nginx/WAF specific)
	if in.Target == "nginx" || in.Target == "waf" {
		// Use a temporary file for validation
		tmpDir := "/tmp/nginx-validate"
		os.MkdirAll(tmpDir, 0755)
		tmpPath := filepath.Join(tmpDir, baseName)
		if err := os.WriteFile(tmpPath, []byte(in.Content), 0644); err != nil {
			return &pb.ActionResponse{Success: false, Message: fmt.Sprintf("Failed to write temp config for validation: %v", err)}, nil
		}
		defer os.Remove(tmpPath)

		// Run nginx -t
		// Note: This requires a minimal nginx.conf context to work well, 
		// but often sites can be validated standalone if they don't depend on global vars
		// For MVP, we run nginx -t on the block.
		cmd := exec.Command("nginx", "-t", "-c", "/etc/nginx/nginx.conf", "-g", fmt.Sprintf("include %s;", tmpPath))
		output, err := cmd.CombinedOutput()
		if err != nil {
			return &pb.ActionResponse{
				Success: false, 
				Message: fmt.Sprintf("Nginx configuration validation failed:\n%s", string(output)),
			}, nil
		}
		log.Printf("Config validation passed for %s", in.Filename)
	}

	// 3. Write File
	path := filepath.Join(targetDir, baseName)
	// Ensure directory exists
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return &pb.ActionResponse{Success: false, Message: fmt.Sprintf("Failed to create target dir: %v", err)}, nil
	}
	
	err := os.WriteFile(path, []byte(in.Content), 0644)
	if err != nil {
		return &pb.ActionResponse{Success: false, Message: fmt.Sprintf("Failed to write config: %v", err)}, nil
	}
	log.Printf("Wrote config %s to %s", in.Filename, path)

	// 4. Reload Service Securely via Socket Proxy
	if in.ReloadAfter {
		if in.Target == "nginx" || in.Target == "waf" {
			// Send SIGHUP to Nginx (kill API)
			resp, err := http.Post(fmt.Sprintf("%s/containers/%s/kill?signal=SIGHUP", DockerProxyUrl, NginxContainer), "application/json", nil)
			if err != nil || resp.StatusCode >= 400 {
				return &pb.ActionResponse{Success: false, Message: "Failed to reload nginx"}, nil
			}
			log.Println("Nginx (or WAF) reloaded successfully")
		} else if in.Target == "fail2ban" {
			// Restart Fail2ban container
			resp, err := http.Post(fmt.Sprintf("%s/containers/%s/restart", DockerProxyUrl, Fail2BanContainer), "application/json", nil)
			if err != nil || resp.StatusCode >= 400 {
				return &pb.ActionResponse{Success: false, Message: "Failed to restart fail2ban"}, nil
			}
			log.Println("Fail2Ban restarted successfully")
		}
	}

	return &pb.ActionResponse{Success: true, Message: "Config synced and applied"}, nil
}


func main() {
	log.Println("Starting Nginx Admin Agent...")

	// Clean up old socket
	if _, err := os.Stat(SocketPath); err == nil {
		os.Remove(SocketPath)
	}

	lis, err := net.Listen("unix", SocketPath)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	// Set permissions for socket so App (GID 1000) can read/write
	// 0660 = RW for Owner (Root) and Group (AppGroup)
	// We assume GID 1000 is the app group.
	if err := os.Chmod(SocketPath, 0666); err != nil { // 0666 for MVP simplicity locally, 0660 in prod if groups aligned
		log.Printf("Warning: Failed to chmod socket: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterAgentServiceServer(s, &server{})

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigCh
		log.Println("Shutting down...")
		s.GracefulStop()
		os.Remove(SocketPath)
	}()

	log.Printf("Listening on unix://%s", SocketPath)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}
