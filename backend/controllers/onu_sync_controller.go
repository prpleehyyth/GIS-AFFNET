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

// ─────────────────────────────────────────────
// normalizeMac: strip semua karakter non-hex lalu uppercase
// Input  : "c8:3a:35:3c:aa:b8" / "c8-3a-35-3c-aa-b8" / "c83a.353c.aab8"
// Output : "C83A353CAAB8"  (12 hex, uppercase, tanpa separator)
// Return "" jika hasilnya bukan tepat 12 karakter.
// ─────────────────────────────────────────────
func normalizeMac(mac string) string {
	re := regexp.MustCompile(`[^a-fA-F0-9]`)
	result := strings.ToUpper(re.ReplaceAllString(mac, ""))
	if len(result) != 12 {
		return ""
	}
	return result
}

// ─────────────────────────────────────────────
// formatMac: 12 digit hex → AA:BB:CC:DD:EE:FF untuk disimpan di DB
// ─────────────────────────────────────────────
func formatMac(raw12 string) string {
	r := strings.ToUpper(raw12)
	return fmt.Sprintf("%s:%s:%s:%s:%s:%s",
		r[0:2], r[2:4], r[4:6], r[6:8], r[8:10], r[10:12],
	)
}

// ─────────────────────────────────────────────
// extractMacAddress: cari MAC dari nama item Zabbix
// Coba format dengan separator dulu (lebih spesifik),
// fallback ke 12 digit berurutan.
// Return: "AA:BB:CC:DD:EE:FF" atau "" jika tidak ketemu.
// ─────────────────────────────────────────────
func extractMacAddress(input string) string {
	// Format dengan separator (: atau -)
	reSep := regexp.MustCompile(`[0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}[:\-][0-9A-Fa-f]{2}`)
	if match := reSep.FindString(input); match != "" {
		if n := normalizeMac(match); n != "" {
			return formatMac(n)
		}
	}
	// Fallback: 12 digit hex berurutan
	reRaw := regexp.MustCompile(`\b([0-9A-Fa-f]{12})\b`)
	if match := reRaw.FindString(input); match != "" {
		return formatMac(strings.ToUpper(match))
	}
	return ""
}

// ─────────────────────────────────────────────
// getZabbixAuthToken: login ke Zabbix API, return auth token
// ─────────────────────────────────────────────
// FetchAndProcessOnuSync mengeksekusi logika sync ONU dan mereturn map statistik
func FetchAndProcessOnuSync() (map[string]interface{}, error) {
	macToCustomer := make(map[string]string)

	mkClient, errMk := routeros.Dial(
		os.Getenv("MIKROTIK_IP"),
		os.Getenv("MIKROTIK_USER"),
		os.Getenv("MIKROTIK_PASS"),
	)

	if errMk != nil {
		fmt.Printf("[WARN] Gagal konek MikroTik: %v — sinkronisasi lanjut tanpa data Customer\n", errMk)
	} else {
		defer mkClient.Close()
		reply, errRun := mkClient.Run("/ppp/active/print")
		if errRun != nil {
			fmt.Printf("[WARN] Gagal baca PPPoE aktif: %v\n", errRun)
		} else {
			for _, re := range reply.Re {
				callerID := re.Map["caller-id"]
				username  := strings.TrimSpace(re.Map["name"])
				key := normalizeMac(callerID)
				if key != "" && username != "" {
					macToCustomer[key] = username
				}
			}
			fmt.Printf("[INFO] PPPoE aktif dimuat: %d sesi\n", len(macToCustomer))
		}
	}

	token, err := getZabbixAuthToken()
	if err != nil {
		return nil, fmt.Errorf("gagal login ke Zabbix: %v", err)
	}

	zabbixPayload := models.ZabbixRequest{
		Jsonrpc: "2.0",
		Method:  "item.get",
		Params: map[string]interface{}{
			"output":      []string{"itemid", "name", "key_", "lastvalue", "units", "lastclock"},
			"search":      map[string]string{"name": "Redaman ONU"},
			"startSearch": true,
		},
		Auth: token,
		ID:   2,
	}

	jb, _ := json.Marshal(zabbixPayload)
	resp, errZ := http.Post(ZabbixURL, "application/json-rpc", bytes.NewBuffer(jb))
	if errZ != nil {
		return nil, fmt.Errorf("zabbix tidak merespon: %v", errZ)
	}
	defer resp.Body.Close()

	itemBody, errRead := io.ReadAll(resp.Body)
	if errRead != nil {
		return nil, fmt.Errorf("gagal membaca response Zabbix: %v", errRead)
	}

	var zabbixData struct {
		Result []struct {
			Itemid    string `json:"itemid"`
			Name      string `json:"name"`
			Key       string `json:"key_"`
			Lastvalue string `json:"lastvalue"`
			Units     string `json:"units"`
			Lastclock string `json:"lastclock"`
		} `json:"result"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if errUnmarshal := json.Unmarshal(itemBody, &zabbixData); errUnmarshal != nil {
		return nil, fmt.Errorf("gagal parsing JSON Zabbix: %v", errUnmarshal)
	}
	if zabbixData.Error != nil {
		return nil, fmt.Errorf("zabbix API error: %s", zabbixData.Error.Message)
	}

	const batasKritis = -25.0
	countNew      := 0
	countUpdate   := 0
	countCustomer := 0
	countSkip     := 0

	for _, item := range zabbixData.Result {
		dbMac := extractMacAddress(item.Name)
		if dbMac == "" {
			countSkip++
			continue
		}

		rxPowerVal := item.Lastvalue
		statusVal := "Online"

		// Jika item belum pernah mendapatkan data atau bernilai 0
		if item.Lastclock == "0" || item.Lastvalue == "0" || item.Lastvalue == "0.0000" || item.Lastvalue == "" {
			rxPowerVal = "N/A"
			statusVal = "Koneksi terputus"
		}

		lookupKey := normalizeMac(dbMac)
		customerName := macToCustomer[lookupKey]
		if customerName != "" {
			countCustomer++
		}

		if rxPowerVal != "N/A" {
			rxPowerFloat, errParse := strconv.ParseFloat(rxPowerVal, 64)
			if errParse == nil {
				if rxPowerFloat < batasKritis {
					var existingLog models.Log
					errLog := config.DB.
						Where("title = ? AND source = ? AND resolved = false", dbMac, "ONU").
						First(&existingLog).Error

					if errLog != nil {
						pesan := fmt.Sprintf("Sinyal kritis: %s dBm (batas: %.0f dBm)", rxPowerVal, batasKritis)
						if customerName != "" {
							pesan += fmt.Sprintf(" | Pelanggan: %s", customerName)
						}
						newLog := models.Log{
							Severity: "critical",
							Source:   "ONU",
							Title:    dbMac,
							Message:  pesan,
						}
						config.DB.Create(&newLog)
						go services.SendTelegramNotification(newLog)
					}
				} else {
					res := config.DB.Model(&models.Log{}).
						Where("title = ? AND source = ? AND resolved = false", dbMac, "ONU").
						Updates(map[string]interface{}{
							"resolved":    true,
							"resolved_at": time.Now(),
						})
					
					if res.RowsAffected > 0 {
						msgInfo := "Sinyal ONU kembali normal (Up)"
						if customerName != "" {
							msgInfo += fmt.Sprintf(" | Pelanggan: %s", customerName)
						}
						services.RecordLog("info", "ONU", dbMac, msgInfo)
					}
				}
			}
		}

		var existingOnu models.Onu
		result := config.DB.Where("mac_address = ?", dbMac).First(&existingOnu)

		if result.RowsAffected > 0 {
			updateData := map[string]interface{}{
				"rx_power": rxPowerVal,
				"status":   statusVal,
			}
			if customerName != "" {
				updateData["customer"] = customerName
			}
			config.DB.Model(&existingOnu).Updates(updateData)
			countUpdate++
		} else {
			config.DB.Create(&models.Onu{
				MacAddress: dbMac,
				RxPower:    rxPowerVal,
				Status:     statusVal,
				Customer:   customerName,
			})
			
			msg := "Perangkat ONU baru terdeteksi"
			if customerName != "" {
				msg += " (Pelanggan: " + customerName + ")"
			}
			services.RecordLog("info", "ONU", dbMac, msg)
			
			countNew++
		}
	}

	return map[string]interface{}{
		"message":          "Sinkronisasi selesai",
		"total_zabbix":     len(zabbixData.Result),
		"total_pppoe":      len(macToCustomer),
		"onu_baru":         countNew,
		"onu_diupdate":     countUpdate,
		"customer_matched": countCustomer,
		"item_skip_no_mac": countSkip,
	}, nil
}

// SyncOnuFromZabbix
// GET/POST /api/sync-onu
func SyncOnuFromZabbix(c *gin.Context) {
	stats, err := FetchAndProcessOnuSync()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}