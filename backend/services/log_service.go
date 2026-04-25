package services

import (
	"strings"
	"time"

	"affnet-backend/config"
	"affnet-backend/models"
)

// RecordLog creates a log and optionally sends a telegram notification if critical.
func RecordLog(severity models.LogSeverity, source models.LogSource, title string, message string) {
	// Anti-spam: Hanya berlaku untuk log error/critical/warning.
	// Log info sebaiknya tidak di-blokir agar histori tetap tercatat.
	if severity != "info" {
		var existingLog models.Log
		err := config.DB.Where("title = ? AND source = ? AND resolved = false", title, source).First(&existingLog).Error

		if err == nil {
			// Log still active, do nothing
			return
		}
	}

	log := models.Log{
		Severity: severity,
		Source:   source,
		Title:    title,
		Message:  message,
	}

	// Info log secara otomatis ditandai sebagai resolved agar tidak masuk ke daftar "error aktif"
	if severity == "info" {
		log.Resolved = true
		now := time.Now()
		log.ResolvedAt = &now
	}

	if err := config.DB.Create(&log).Error; err == nil {
		if severity == "critical" || (severity == "info" && strings.Contains(strings.ToLower(message), "kembali normal")) {
			go SendTelegramNotification(log)
		}
	}
}
// ResolveLog auto resolves a log
func ResolveLog(title string, source models.LogSource) {
	config.DB.Model(&models.Log{}).
		Where("title = ? AND source = ? AND resolved = false", title, source).
		Updates(map[string]interface{}{
			"resolved":    true,
			"resolved_at": time.Now(),
		})
}
