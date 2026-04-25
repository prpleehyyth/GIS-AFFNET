package controllers

import (
	"fmt"
	"net/http"
	"time"

	"affnet-backend/config"
	"affnet-backend/models"
	"affnet-backend/services"

	"github.com/gin-gonic/gin"
)

// TestOnuScenario: Endpoint khusus untuk testing 4 skenario
func TestOnuScenario(c *gin.Context) {
	var input struct {
		Scenario   int    `json:"scenario" binding:"required"`
		MacAddress string `json:"mac_address"` // Default AA:BB:CC:11:22:33 jika kosong
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mac := input.MacAddress
	if mac == "" {
		mac = "AA:BB:CC:11:22:33"
	}

	switch input.Scenario {
	case 1:
		// Skenario 1: Perangkat ONU dimatikan (RX Power drop jadi -30 dBm)
		pesan := fmt.Sprintf("Sinyal kritis: -30.0 dBm (batas: -25 dBm) | Simulasi Testing")
		
		// Cek apakah log sudah ada biar gak dobel
		var existingLog models.Log
		err := config.DB.Where("title = ? AND source = ? AND resolved = false", mac, "ONU").First(&existingLog).Error
		
		if err != nil {
			newLog := models.Log{
				Severity: "critical",
				Source:   "ONU",
				Title:    mac,
				Message:  pesan,
			}
			config.DB.Create(&newLog)
			go services.SendTelegramNotification(newLog)
		}

		// Update database ONU kalau ada
		config.DB.Model(&models.Onu{}).Where("mac_address = ?", mac).Updates(map[string]interface{}{
			"rx_power": "-30.0",
		})

		c.JSON(http.StatusOK, gin.H{"message": "Skenario 1: Perangkat dimatikan. Log critical dibuat."})

	case 2:
		// Skenario 2: Perangkat ONU diaktifkan kembali (RX Power naik jadi -19 dBm)
		res := config.DB.Model(&models.Log{}).
			Where("title = ? AND source = ? AND resolved = false", mac, "ONU").
			Updates(map[string]interface{}{
				"resolved":    true,
				"resolved_at": time.Now(),
			})

		if res.RowsAffected > 0 {
			services.RecordLog("info", "ONU", mac, "Sinyal ONU kembali normal (Up) | Simulasi Testing")
		}

		config.DB.Model(&models.Onu{}).Where("mac_address = ?", mac).Updates(map[string]interface{}{
			"rx_power": "-19.0",
		})

		c.JSON(http.StatusOK, gin.H{"message": "Skenario 2: Perangkat diaktifkan. Log di-resolve dan log info ditambahkan."})

	case 3:
		// Skenario 3: Menambahkan perangkat baru (Auto-discovery)
		var existingOnu models.Onu
		result := config.DB.Where("mac_address = ?", mac).First(&existingOnu)

		if result.RowsAffected > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "Skenario 3 gagal: MAC Address sudah ada di database. Hapus dulu atau gunakan MAC lain."})
			return
		}

		config.DB.Create(&models.Onu{
			MacAddress: mac,
			RxPower:    "-20.0",
			Status:     "Online",
			Customer:   "Customer Testing",
		})
		
		services.RecordLog("info", "ONU", mac, "Perangkat ONU baru terdeteksi (Pelanggan: Customer Testing) | Simulasi Testing")

		c.JSON(http.StatusOK, gin.H{"message": "Skenario 3: Perangkat baru ditambahkan. Log info ditambahkan."})

	case 4:
		// Skenario 4: Mengubah koordinat lokasi
		var existingOnu models.Onu
		if err := config.DB.Where("mac_address = ?", mac).First(&existingOnu).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "Skenario 4 gagal: MAC Address tidak ditemukan. Jalankan skenario 3 dulu."})
			return
		}

		newLat := fmt.Sprintf("-6.%d", time.Now().Unix()%1000000)
		newLon := fmt.Sprintf("106.%d", time.Now().Unix()%1000000)

		if existingOnu.Latitude != newLat || existingOnu.Longitude != newLon {
			msg := fmt.Sprintf("Lokasi koordinat perangkat ONU diperbarui (Lat: %s, Lon: %s) | Simulasi Testing", newLat, newLon)
			services.RecordLog("info", "ONU", mac, msg)

			config.DB.Model(&existingOnu).Updates(map[string]interface{}{
				"latitude":  newLat,
				"longitude": newLon,
			})
			c.JSON(http.StatusOK, gin.H{
				"message": "Skenario 4: Lokasi diubah. Log info ditambahkan.",
				"new_lat": newLat,
				"new_lon": newLon,
			})
		} else {
			c.JSON(http.StatusOK, gin.H{"message": "Skenario 4: Lokasi sama, tidak ada perubahan log."})
		}

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "Skenario tidak valid. Pilih 1, 2, 3, atau 4."})
	}
}
