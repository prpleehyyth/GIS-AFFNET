package controllers

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"fmt"
	"strings"
	"affnet-backend/config"
	"affnet-backend/models"

	"github.com/gin-gonic/gin"
)

// Fungsi untuk mengekstrak MAC Address yang digabung (AABBCC112233)
// dan mengubahnya jadi standar (AA:BB:CC:11:22:33)
func extractMacAddress(input string) string {
	// Cari 12 karakter (angka 0-9 atau huruf A-F) yang gandeng terus
	re := regexp.MustCompile(`([0-9A-Fa-f]{12})`)
	match := re.FindString(input)

	// Kalau nggak ketemu 12 karakter itu, lewati
	if match == "" {
		return ""
	}

	// Rapikan formatnya: sisipkan titik dua (:) setiap 2 karakter
	formattedMac := fmt.Sprintf("%s:%s:%s:%s:%s:%s",
		match[0:2], match[2:4], match[4:6],
		match[6:8], match[8:10], match[10:12],
	)

	// Jadikan huruf besar semua biar seragam di database
	return strings.ToUpper(formattedMac)
}

// SyncOnuFromZabbix: Menyedot data MAC & Redaman dari Zabbix ke DB
func SyncOnuFromZabbix(c *gin.Context) {
	// 1. Ambil Token Zabbix
	token, err := getZabbixAuthToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal login ke Zabbix"})
		return
	}

	// 2. Minta data Item Redaman ONU dari Zabbix (Menggunakan Payload yang terbukti berhasil)
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

	// Membaca response sesuai dengan cara yang berhasil
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

	// 3. Proses Sinkronisasi ke Database (Upsert)
	countNew := 0
	countUpdate := 0

	for _, item := range zabbixData.Result {
		// Ekstrak MAC dari nama item
		mac := extractMacAddress(item.Name)
		
		// Lewati kalau regex tidak menemukan bentuk MAC Address
		if mac == "" {
			continue
		}

		var existingOnu models.Onu
		result := config.DB.Where("mac_address = ?", mac).First(&existingOnu)

		if result.RowsAffected > 0 {
			// Jika MAC sudah ada di DB, kita update redaman terbarunya saja
			config.DB.Model(&existingOnu).Updates(map[string]interface{}{
				"rx_power": item.Lastvalue,
				"status":   "Online",
			})
			countUpdate++
		} else {
			// Jika MAC belum ada, kita buat baris baru (Nama pelanggan & Lokasi masih kosong)
			newOnu := models.Onu{
				MacAddress: mac,
				RxPower:    item.Lastvalue,
				Status:     "Online",
			}
			config.DB.Create(&newOnu)
			countNew++
		}
	}

	// Response akhir yang informatif
	c.JSON(http.StatusOK, gin.H{
		"message":       "Sinkronisasi selesai",
		"total_ditarik": len(zabbixData.Result),
		"onu_baru":      countNew,
		"onu_diupdate":  countUpdate,
	})
}