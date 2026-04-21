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

// Helper 1: Ekstrak MAC baku (AA:BB:CC:DD:EE:FF) dari text Zabbix buat disimpen di DB
func extractMacAddress(input string) string {
	re := regexp.MustCompile(`([0-9A-Fa-f]{12})|([0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2})`)
	match := re.FindString(input)
	if match == "" {
		return ""
	}
	clean := regexp.MustCompile(`[^a-fA-F0-9]`).ReplaceAllString(match, "")
	if len(clean) == 12 {
		return strings.ToUpper(fmt.Sprintf("%s:%s:%s:%s:%s:%s", clean[0:2], clean[2:4], clean[4:6], clean[6:8], clean[8:10], clean[10:12]))
	}
	return strings.ToUpper(match)
}

// Helper 2: Hapus semua titik/titik dua/strip biar MAC bersih (AABBCCDDEEFF)
func normalizeMac(mac string) string {
	re := regexp.MustCompile(`[^a-fA-F0-9]`)
	return strings.ToUpper(re.ReplaceAllString(mac, ""))
}

// SyncOnuFromZabbix: Menyedot Zabbix + MikroTik dengan fitur FUZZY MATCH MAC
func SyncOnuFromZabbix(c *gin.Context) {
	// ================================================================
	// 1. TARIK DATA KAMUS DARI MIKROTIK (PPPoE ACTIVE)
	// ================================================================
	mkIp := os.Getenv("MIKROTIK_IP")
	mkUser := os.Getenv("MIKROTIK_USER")
	mkPass := os.Getenv("MIKROTIK_PASS")

	macToCustomer := make(map[string]string)

	client, errMk := routeros.Dial(mkIp, mkUser, mkPass)
	if errMk == nil {
		defer client.Close()
		// Mengambil data user yang sedang online
		reply, errRun := client.Run("/ppp/active/print")
		if errRun == nil {
			for _, re := range reply.Re {
				if callerID, ok := re.Map["caller-id"]; ok {
					cleanMac := normalizeMac(callerID)
					macToCustomer[cleanMac] = re.Map["name"]
				}
			}
		}
	} else {
		fmt.Println("⚠️ Peringatan: Gagal konek ke MikroTik. Sinkronisasi lanjut tanpa update nama.", errMk)
	}

	// ================================================================
	// 2. TARIK DATA REDAMAN DARI ZABBIX (Anti 502 Bad Gateway)
	// ================================================================
	token, err := getZabbixAuthToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal login ke Zabbix", "detail": err.Error()})
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
	resp, errZ := http.Post(ZabbixURL, "application/json-rpc", bytes.NewBuffer(jb))
	
	if errZ != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "Zabbix tidak merespon", "detail": errZ.Error()})
		return
	}
	defer resp.Body.Close()

	itemBody, errRead := io.ReadAll(resp.Body)
	if errRead != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca response Zabbix"})
		return
	}

	var zabbixData struct {
		Result []struct {
			Itemid    string `json:"itemid"`
			Name      string `json:"name"`
			Key       string `json:"key_"`
			Lastvalue string `json:"lastvalue"`
			Units     string `json:"units"`
		} `json:"result"`
	}

	if errUnmarshal := json.Unmarshal(itemBody, &zabbixData); errUnmarshal != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal parsing JSON Zabbix", "detail": errUnmarshal.Error()})
		return
	}

	// ================================================================
	// 3. MERGING DENGAN FUZZY MATCH & INSERT/UPDATE KE TABEL `onus`
	// ================================================================
	countNew := 0
	countUpdate := 0
	batasKritis := -25.0

	for _, item := range zabbixData.Result {
		// 1. Ekstrak MAC baku untuk Database (Contoh: C8:3A:35:3C:AA:B8)
		dbMac := extractMacAddress(item.Name)
		if dbMac == "" {
			continue
		}

		// 2. Normalisasi MAC Zabbix (Contoh: C83A353CAAB8)
		searchMac := normalizeMac(dbMac)
		customerName := ""

		// --- LOGIKA FUZZY MATCH SAKTI ---
		// A. Coba Exact Match (12 Digit Sama Persis)
		if nama, ada := macToCustomer[searchMac]; ada {
			customerName = nama
		} else {
			// B. Coba Fuzzy Match (11 Digit Sama, Beda Ujungnya Doang)
			for mkMac, mkName := range macToCustomer {
				if len(searchMac) == 12 && len(mkMac) == 12 {
					if searchMac[:11] == mkMac[:11] {
						customerName = mkName
						fmt.Printf("💡 Fuzzy Match: %s (Zabbix) disamakan dengan %s (MikroTik) -> %s\n", searchMac, mkMac, mkName)
						break
					}
				}
			}
		}

		// --- LOGIKA NOTIFIKASI CRITICAL (TELEGRAM) ---
		rxPowerFloat, errParse := strconv.ParseFloat(item.Lastvalue, 64)
		if errParse == nil {
			isCritical := rxPowerFloat < batasKritis

			if isCritical {
				var existingLog models.Log
				errLog := config.DB.Where("title = ? AND source = ? AND resolved = false", dbMac, "ONU").First(&existingLog).Error

				if errLog != nil {
					pesanNotif := fmt.Sprintf("Sinyal kritis: %s dBm.", item.Lastvalue)
					if customerName != "" {
						pesanNotif += fmt.Sprintf(" Pelanggan: %s", customerName)
					}

					newLog := models.Log{
						Severity: "critical",
						Source:   "ONU",
						Title:    dbMac,
						Message:  pesanNotif,
					}
					config.DB.Create(&newLog)
					go services.SendTelegramNotification(newLog)
				}
			} else {
				// Auto-resolve jika sinyal membaik
				config.DB.Model(&models.Log{}).
					Where("title = ? AND source = ? AND resolved = false", dbMac, "ONU").
					Updates(map[string]interface{}{
						"resolved":    true,
						"resolved_at": time.Now(),
					})
			}
		}

		// --- LOGIKA SAVE KE DATABASE ---
		var existingOnu models.Onu
		result := config.DB.Where("mac_address = ?", dbMac).First(&existingOnu)

		if result.RowsAffected > 0 {
			// UPDATE
			updateData := map[string]interface{}{
				"rx_power": item.Lastvalue,
				"status":   "Online",
			}
			// Jangan timpa nama jadi kosong kalau PPPoE lg putus bentar
			if customerName != "" {
				updateData["customer"] = customerName
			}
			config.DB.Model(&existingOnu).Updates(updateData)
			countUpdate++
		} else {
			// INSERT
			newOnu := models.Onu{
				MacAddress: dbMac,
				RxPower:    item.Lastvalue,
				Status:     "Online",
				Customer:   customerName,
			}
			config.DB.Create(&newOnu)
			countNew++
		}
	}

	// ================================================================
	// 4. RESPONSE
	// ================================================================
	c.JSON(http.StatusOK, gin.H{
		"message":       "Sinkronisasi Data Selesai",
		"total_ditarik": len(zabbixData.Result),
		"onu_baru":      countNew,
		"onu_diupdate":  countUpdate,
	})
}