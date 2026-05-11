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

// =====================================================================
// 1. SEND TELEGRAM NOTIFICATION
// Mengirim pesan error/pemulihan ke grup/bot Telegram beserta detailnya
// =====================================================================
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
	switch log.Source {
	case "ONU":
		macAddress := log.Title
		// Hapus prefix "Resolved: " jika ada, agar pencarian MAC Address tetap akurat
		if len(macAddress) > 10 && macAddress[:10] == "Resolved: " {
			macAddress = macAddress[10:]
		}

		var onu models.Onu
		if err := config.DB.Where("mac_address = ?", macAddress).First(&onu).Error; err == nil {
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
	case "Infra":
		infraName := log.Title
		if len(infraName) > 10 && infraName[:10] == "Resolved: " {
			infraName = infraName[10:]
		}

		namaPelanggan = "N/A (Infrastruktur Jaringan)"

		var infra models.Infra
		if err := config.DB.Where("name = ?", infraName).First(&infra).Error; err == nil {
			if infra.Lat != "" && infra.Lon != "" {
				mapsUrl := fmt.Sprintf("https://www.google.com/maps?q=%s,%s", infra.Lat, infra.Lon)
				lokasiTeks = fmt.Sprintf("[Lihat di Google Maps](%s)", mapsUrl)
			}
		}
	case "ODP":
		odpName := log.Title
		if len(odpName) > 10 && odpName[:10] == "Resolved: " {
			odpName = odpName[10:]
		}

		namaPelanggan = "N/A (Perangkat Distribusi)"

		var odp models.Odp
		if err := config.DB.Where("name = ?", odpName).First(&odp).Error; err == nil {
			if odp.Latitude != "" && odp.Longitude != "" {
				mapsUrl := fmt.Sprintf("https://www.google.com/maps?q=%s,%s", odp.Latitude, odp.Longitude)
				lokasiTeks = fmt.Sprintf("[Lihat di Google Maps](%s)", mapsUrl)
			}
		}
	}

	apiUrl := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)

	header := "🚨 *LOG KRITIS JARINGAN*"
	if log.Severity == "info" {
		header = "✅ *STATUS KEMBALI NORMAL*"
	}

	identitasLabel := "Identitas"
	switch log.Source {
	case "ONU":
		identitasLabel = "MAC Address"
	case "ODP", "Infra":
		identitasLabel = "Nama Perangkat"
	}

	// Format pesan dengan tambahan informasi pelanggan dan lokasi
	text := fmt.Sprintf(
		"%s\n"+
			"━━━━━━━━━━━━━━━━━━\n"+
			"📌 *%s*: `%s` \n"+
			"⚠️ *Level*: %s\n"+
			"🔌 *Sumber*: %s\n"+
			"👤 *Pelanggan*: %s\n"+
			"📍 *Lokasi*: %s\n"+
			"📝 *Detail*: %s\n"+
			"━━━━━━━━━━━━━━━━━━",
		header, identitasLabel, log.Title, string(log.Severity), string(log.Source), namaPelanggan, lokasiTeks, log.Message,
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