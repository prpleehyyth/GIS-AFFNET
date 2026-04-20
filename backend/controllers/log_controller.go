package controllers

import (
	"net/http"
	"time"

	"affnet-backend/config"
	"affnet-backend/models"
	"affnet-backend/services" // Import folder services yang baru dibuat

	"github.com/gin-gonic/gin"
)

// CreateLog — dipanggil dari frontend setiap ada event
func CreateLog(c *gin.Context) {
	var input struct {
		Severity string `json:"severity" binding:"required"`
		Source   string `json:"source"   binding:"required"`
		Title    string `json:"title"    binding:"required"`
		Message  string `json:"message"  binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// ==========================================
	// 1. FITUR ANTI-SPAM & KUNCI WAKTU (KRITERIA 1)
	// ==========================================
	var existingLog models.Log
	
	err := config.DB.Where("title = ? AND source = ? AND resolved = false", input.Title, input.Source).First(&existingLog).Error

	if err == nil {
		c.JSON(http.StatusOK, gin.H{
			"message": "Log duplikat ditolak, perangkat masih dalam status error.",
			"data":    existingLog,
		})
		return
	}

	// ==========================================
	// 2. BUAT LOG BARU JIKA BELUM ADA YANG AKTIF
	// ==========================================
	log := models.Log{
		Severity: models.LogSeverity(input.Severity),
		Source:   models.LogSource(input.Source),
		Title:    input.Title,
		Message:  input.Message,
	}

	if err := config.DB.Create(&log).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan log"})
		return
	}

	// ==========================================
	// 3. TRIGGER TELEGRAM NOTIFICATION
	// ==========================================
	// Menggunakan goroutine agar tidak memblokir respon ke frontend
	if log.Severity == "critical" {
		go services.SendTelegramNotification(log)
	}

	c.JSON(http.StatusCreated, log)
}

// GetLogs — ambil semua log, support filter severity & source
func GetLogs(c *gin.Context) {
	var logs []models.Log

	query := config.DB.Order("created_at desc")

	if severity := c.Query("severity"); severity != "" {
		query = query.Where("severity = ?", severity)
	}
	if source := c.Query("source"); source != "" {
		query = query.Where("source = ?", source)
	}
	if resolved := c.Query("resolved"); resolved != "" {
		query = query.Where("resolved = ?", resolved == "true")
	}

	// Limit default 200 baris terbaru
	query = query.Limit(200)

	if err := query.Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil log"})
		return
	}

	c.JSON(http.StatusOK, logs)
}

// ResolveLog — tandai log sebagai resolved
func ResolveLog(c *gin.Context) {
	id := c.Param("id")
	now := time.Now()

	if err := config.DB.Model(&models.Log{}).Where("id = ?", id).Updates(map[string]interface{}{
		"resolved":    true,
		"resolved_at": now,
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal update log"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Log ditandai resolved"})
}

// ResolveLogByTitle — resolve semua log aktif dengan title tertentu
func ResolveLogByTitle(c *gin.Context) {
	var input struct {
		Title  string `json:"title"  binding:"required"`
		Source string `json:"source" binding:"required"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	now := time.Now()
	if err := config.DB.Model(&models.Log{}).
		Where("title = ? AND source = ? AND resolved = false", input.Title, input.Source).
		Updates(map[string]interface{}{
			"resolved":    true,
			"resolved_at": now,
		}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal resolve log"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Log berhasil di-resolve"})
}

// DeleteLog — hapus log by ID
func DeleteLog(c *gin.Context) {
	id := c.Param("id")
	if err := config.DB.Delete(&models.Log{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus log"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Log dihapus"})
}

// ClearResolvedLogs — hapus semua log yang sudah resolved
func ClearResolvedLogs(c *gin.Context) {
	if err := config.DB.Where("resolved = true").Delete(&models.Log{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membersihkan log"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Log resolved berhasil dihapus"})
}

// TestBulkTelegram — Endpoint sementara untuk ngetes koneksi bot
func TestBulkTelegram(c *gin.Context) {
	var logs []models.Log

	// Ambil 5 log terbaru dari database
	if err := config.DB.Order("created_at desc").Limit(5).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal ambil data log"})
		return
	}

	if len(logs) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "Database log masih kosong, buat satu log dulu untuk tes"})
		return
	}

	// Kirim semua log yang terambil ke Telegram
	for _, l := range logs {
		// Kita panggil tanpa goroutine 'go' agar kita bisa melihat jika ada error
		services.SendTelegramNotification(l)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "Proses pengiriman 5 log terbaru ke Telegram selesai",
		"jumlah_dikirim":   len(logs),
	})
}