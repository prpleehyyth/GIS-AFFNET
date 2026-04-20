package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv" // <--- TAMBAHKAN INI UNTUK KONVERSI STRING KE FLOAT
	"strings"
	"time"
	"affnet-backend/config"
	"affnet-backend/models"
	"affnet-backend/services" // <--- TAMBAHKAN INI (JIKA MEMANGGIL TELEGRAM SECARA MANUAL)

	"github.com/gin-gonic/gin"
)

// (Fungsi extractMacAddress biarkan sama)
func extractMacAddress(input string) string {
	re := regexp.MustCompile(`([0-9A-Fa-f]{12})`)
	match := re.FindString(input)

	if match == "" {
		return ""
	}

	formattedMac := fmt.Sprintf("%s:%s:%s:%s:%s:%s",
		match[0:2], match[2:4], match[4:6],
		match[6:8], match[8:10], match[10:12],
	)

	return strings.ToUpper(formattedMac)
}

// SyncOnuFromZabbix: Menyedot data MAC & Redaman dari Zabbix ke DB
func SyncOnuFromZabbix(c *gin.Context) {
	// 1. Ambil Token Zabbix (Asumsi fungsi getZabbixAuthToken ada di file ini/package yg sama)
	token, err := getZabbixAuthToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal login ke Zabbix"})
		return
	}

	zabbixPayload := models.ZabbixRequest{
		Jsonrpc: "2.0",
		Method:  "item.get",
		Params: map[string]interface{}{
			"output":      []string{"itemid", "name", "key_", "lastvalue", "units"},
			"search":      map[string]string{"name": "Redaman ONU"},
			"startSearch": true,
		},
		Auth: token,
		ID:   2,
	}

	jb, _ := json.Marshal(zabbixPayload)
	resp, _ := http.Post(ZabbixURL, "application/json-rpc", bytes.NewBuffer(jb))
	defer resp.Body.Close()

	itemBody, _ := io.ReadAll(resp.Body)

	var zabbixData struct {
		Result []struct {
			Itemid    string `json:"itemid"`
			Name      string `json:"name"`
			Key       string `json:"key_"`
			Lastvalue string `json:"lastvalue"`
			Units     string `json:"units"`
		} `json:"result"`
	}
	json.Unmarshal(itemBody, &zabbixData)

	countNew := 0
	countUpdate := 0
	batasKritis := -25.0 // <--- ATUR BATAS REDAMAN KRITIS KAMU DI SINI (misal -25 dBm)

	for _, item := range zabbixData.Result {
		mac := extractMacAddress(item.Name)
		if mac == "" {
			continue
		}

		// --- TAMBAHAN UNTUK LOGGING: Evaluasi Redaman ---
		// Konversi string Lastvalue (misal "-26.38") menjadi float64 agar bisa dibandingin
		rxPowerFloat, _ := strconv.ParseFloat(item.Lastvalue, 64)
		isCritical := rxPowerFloat < batasKritis // Jika -26 < -25, maka true

		// Jika kritis, masukkan ke sistem Log kita
		if isCritical {
			// Cek Anti-Spam: Apakah MAC ini sudah punya Log aktif (belum di resolve)?
			var existingLog models.Log
			errLog := config.DB.Where("title = ? AND source = ? AND resolved = false", mac, "ONU").First(&existingLog).Error

			// Jika tidak ada error (artinya log belum ada/sudah beres sebelumnya), kita buat log baru
			if errLog != nil {
				newLog := models.Log{
					Severity: "critical", // Sesuai tipe data models.LogSeverity kamu
					Source:   "ONU",      // Sesuai tipe data models.LogSource kamu
					Title:    mac,
					Message:  fmt.Sprintf("Sinyal kritis terdeteksi: %s dBm", item.Lastvalue),
				}
				// Simpan ke DB
				config.DB.Create(&newLog)

				// Panggil Notifikasi Telegram
				go services.SendTelegramNotification(newLog)
			}
		} else {
			// (OPSIONAL LEVEL PRO): AUTO-RESOLVE
			// Jika sinyalnya sudah bagus lagi (misal naik jadi -20), kita otomatis 'Resolve' log-nya!
			config.DB.Model(&models.Log{}).
				Where("title = ? AND source = ? AND resolved = false", mac, "ONU").
				Updates(map[string]interface{}{
					"resolved":    true,
					"resolved_at": time.Now(), // Pastikan package time di-import
				})
		}
		// ------------------------------------------------

		var existingOnu models.Onu
		result := config.DB.Where("mac_address = ?", mac).First(&existingOnu)

		if result.RowsAffected > 0 {
			config.DB.Model(&existingOnu).Updates(map[string]interface{}{
				"rx_power": item.Lastvalue,
				"status":   "Online",
			})
			countUpdate++
		} else {
			newOnu := models.Onu{
				MacAddress: mac,
				RxPower:    item.Lastvalue,
				Status:     "Online",
			}
			config.DB.Create(&newOnu)
			countNew++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Sinkronisasi selesai",
		"total_ditarik": len(zabbixData.Result),
		"onu_baru":      countNew,
		"onu_diupdate":  countUpdate,
	})
}