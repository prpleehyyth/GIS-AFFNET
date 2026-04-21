package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"affnet-backend/config"
	"affnet-backend/models"
	"affnet-backend/services"

	"github.com/gin-gonic/gin"
	"gopkg.in/routeros.v2"
)

// Fungsi untuk mengekstrak dan memformat MAC Address dari nama item Zabbix
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

// SyncOnuFromZabbix: Menyedot Zabbix + MikroTik, lalu simpan ke Tabel Database
func SyncOnuFromZabbix(c *gin.Context) {
	// ================================================================
	// 1. TARIK DATA KAMUS DARI MIKROTIK (PPPoE ACTIVE)
	// ================================================================
	mkIp := os.Getenv("MIKROTIK_IP")
	mkUser := os.Getenv("MIKROTIK_USER")
	mkPass := os.Getenv("MIKROTIK_PASS")

	// Siapkan buku kamus: MAC Address -> Nama Customer
	macToCustomer := make(map[string]string)

	client, errMk := routeros.Dial(mkIp, mkUser, mkPass)
	if errMk == nil {
		defer client.Close()
		reply, errRun := client.Run("/ppp/active/print")
		if errRun == nil {
			for _, re := range reply.Re {
				// Ambil MAC dan pastikan huruf besar
				mac := strings.ToUpper(re.Map["caller-id"])
				nama := re.Map["name"]
				macToCustomer[mac] = nama
			}
		}
	} else {
		fmt.Println("⚠️ Peringatan: Gagal konek ke MikroTik saat sinkronisasi:", errMk)
	}

	// ================================================================
	// 2. TARIK DATA REDAMAN DARI ZABBIX
	// ================================================================
	token, err := getZabbixAuthToken() // Pastikan fungsi ini ada di file yg sama
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

	// ================================================================
	// 3. MERGING & INSERT/UPDATE KE TABEL DATABASE `onus`
	// ================================================================
	countNew := 0
	countUpdate := 0
	batasKritis := -25.0 

	for _, item := range zabbixData.Result {
		mac := extractMacAddress(item.Name)
		if mac == "" {
			continue
		}

		// Cari nama customer dari MikroTik berdasarkan MAC dari Zabbix
		customerName := "" // Default kosong sesuai struct awalmu
		if nama, ada := macToCustomer[mac]; ada {
			customerName = nama
		}

		// --- LOGIKA NOTIFIKASI CRITICAL (TELEGRAM) ---
		rxPowerFloat, _ := strconv.ParseFloat(item.Lastvalue, 64)
		isCritical := rxPowerFloat < batasKritis 

		if isCritical {
			var existingLog models.Log
			errLog := config.DB.Where("title = ? AND source = ? AND resolved = false", mac, "ONU").First(&existingLog).Error

			if errLog != nil {
				pesanNotif := fmt.Sprintf("Sinyal kritis: %s dBm.", item.Lastvalue)
				if customerName != "" {
					pesanNotif += fmt.Sprintf(" Pelanggan: %s", customerName)
				}

				newLog := models.Log{
					Severity: "critical", 
					Source:   "ONU",      
					Title:    mac,
					Message:  pesanNotif,
				}
				config.DB.Create(&newLog)
				go services.SendTelegramNotification(newLog)
			}
		} else {
			// Auto-resolve jika sinyal sudah membaik
			config.DB.Model(&models.Log{}).
				Where("title = ? AND source = ? AND resolved = false", mac, "ONU").
				Updates(map[string]interface{}{
					"resolved":    true,
					"resolved_at": time.Now(), 
				})
		}

		// --- LOGIKA SAVE KE DATABASE (Tabel `onus`) ---
		var existingOnu models.Onu
		result := config.DB.Where("mac_address = ?", mac).First(&existingOnu)

		if result.RowsAffected > 0 {
			// Jika MAC sudah ada di DB -> Update Data
			config.DB.Model(&existingOnu).Updates(map[string]interface{}{
				"rx_power": item.Lastvalue,
				"status":   "Online",
				"customer": customerName, // Update customer dari MikroTik
			})
			countUpdate++
		} else {
			// Jika MAC belum ada di DB -> Insert Baru
			newOnu := models.Onu{
				MacAddress: mac,
				RxPower:    item.Lastvalue,
				Status:     "Online",
				Customer:   customerName, // Isi customer dari MikroTik
			}
			config.DB.Create(&newOnu)
			countNew++
		}
	}

	// ================================================================
	// 4. RESPONSE SELESAI
	// ================================================================
	c.JSON(http.StatusOK, gin.H{
		"message":       "Sinkronisasi Data Zabbix & MikroTik selesai",
		"total_ditarik": len(zabbixData.Result),
		"onu_baru":      countNew,
		"onu_diupdate":  countUpdate,
	})
}