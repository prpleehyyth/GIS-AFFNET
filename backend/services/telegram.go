package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"

	"affnet-backend/config"
	"affnet-backend/models"
)

func SendTelegramNotification(log models.Log) {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	chatID := os.Getenv("TELEGRAM_CHAT_ID")

	if token == "" || chatID == "" {
		fmt.Println("Warning: TELEGRAM_BOT_TOKEN atau TELEGRAM_CHAT_ID belum di-set")
		return
	}

	// Default jika data tidak ditemukan
	namaPelanggan := "Belum Terdaftar"
	lokasiTeks := "Koordinat Belum Diatur"

	// Mencari data ONU berdasarkan MAC Address yang ada di log.Title
	if log.Source == "ONU" {
		var onu models.Onu
		if err := config.DB.Where("mac_address = ?", log.Title).First(&onu).Error; err == nil {
			// Mengambil nama pelanggan dari field Customer
			if onu.Customer != "" {
				namaPelanggan = onu.Customer
			}

			// Menyusun link Google Maps jika Latitude dan Longitude tersedia
			if onu.Latitude != "" && onu.Longitude != "" {
				mapsUrl := fmt.Sprintf("https://www.google.com/maps?q=%s,%s", onu.Latitude, onu.Longitude)
				lokasiTeks = fmt.Sprintf("[Lihat di Google Maps](%s)", mapsUrl)
			}
		}
	}

	apiUrl := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)

	header := "🚨 *LOG KRITIS JARINGAN*"
	if log.Severity == "info" {
		header = "✅ *STATUS KEMBALI NORMAL*"
	}

	// Format pesan dengan tambahan informasi pelanggan dan lokasi
	text := fmt.Sprintf(
		"%s\n"+
			"━━━━━━━━━━━━━━━━━━\n"+
			"📌 *Identitas*: `%s` \n"+
			"⚠️ *Level*: %s\n"+
			"🔌 *Sumber*: %s\n"+
			"👤 *Pelanggan*: %s\n"+
			"📍 *Lokasi*: %s\n"+
			"📝 *Detail*: %s\n"+
			"━━━━━━━━━━━━━━━━━━",
		header, log.Title, string(log.Severity), string(log.Source), namaPelanggan, lokasiTeks, log.Message,
	)

	payload := map[string]interface{}{
		"chat_id":                  chatID,
		"text":                     text,
		"parse_mode":               "Markdown",
		"disable_web_page_preview": false, // Set false agar preview peta muncul kecil di bawah pesan
	}

	jsonData, _ := json.Marshal(payload)

	resp, err := http.Post(apiUrl, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		fmt.Println("Error API Telegram:", err)
		return
	}
	defer resp.Body.Close()
}