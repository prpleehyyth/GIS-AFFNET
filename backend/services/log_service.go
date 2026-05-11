package services

import (
	"strings"
	"time"

	"affnet-backend/config"
	"affnet-backend/models"
)

// =====================================================================
// 1. RECORD LOG (MENYIMPAN LOG KE DATABASE)
// Membuat log baru dan mengirim notifikasi telegram jika status kritis
// =====================================================================
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
// =====================================================================
// 2. RESOLVE LOG (MENGUBAH STATUS ERROR JADI NORMAL)
// =====================================================================
// ResolveLog auto resolves a log
func ResolveLog(title string, source models.LogSource) {
	var logsToResolve []models.Log
	config.DB.Where("title = ? AND source = ? AND resolved = false", title, source).Find(&logsToResolve)

	if len(logsToResolve) == 0 {
		return
	}

	now := time.Now()
	for _, l := range logsToResolve {
		config.DB.Model(&l).Updates(map[string]interface{}{
			"resolved":    true,
			"resolved_at": now,
		})

		RecordLog("info", source, "Resolved: "+title, "Status perangkat telah kembali normal (Isu sebelumnya: "+l.Message+")")
	}
}

// =====================================================================
// 3. CLEAN OLD LOGS (PENGHAPUSAN OTOMATIS)
// =====================================================================
// CleanOldLogs menghapus log yang usianya lebih dari 30 hari
func CleanOldLogs() {
	config.DB.Where("created_at < ?", time.Now().AddDate(0, 0, -30)).Delete(&models.Log{})
}
