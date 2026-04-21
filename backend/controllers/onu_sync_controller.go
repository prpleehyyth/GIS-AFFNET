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
// ─────────────────────────────────────────────
// SyncOnuFromZabbix
// GET/POST /api/sync-onu
// ─────────────────────────────────────────────
func SyncOnuFromZabbix(c *gin.Context) {

	// ================================================================
	// 1. TARIK DATA PPPoE AKTIF DARI MIKROTIK
	// Key map: normalized MAC (12 hex uppercase), value: username PPPoE
	// ================================================================
	macToCustomer := make(map[string]string)

	mkClient, errMk := routeros.Dial(
		os.Getenv("MIKROTIK_IP"),
		os.Getenv("MIKROTIK_USER"),
		os.Getenv("MIKROTIK_PASS"),
	)

	if errMk != nil {
		// Tidak hard-fail: sync Zabbix tetap jalan, Customer hanya tidak terisi
		fmt.Printf("[WARN] Gagal konek MikroTik: %v — sinkronisasi lanjut tanpa data Customer\n", errMk)
	} else {
		// FIX BUG 3: defer di luar blok if, setelah cek error.
		// Sebelumnya defer ada di DALAM blok if errMk == nil,
		// sehingga Go meregister defer saat blok if selesai —
		// artinya client bisa ditutup sebelum Run() selesai dieksekusi.
		defer mkClient.Close()

		reply, errRun := mkClient.Run("/ppp/active/print")
		if errRun != nil {
			fmt.Printf("[WARN] Gagal baca PPPoE aktif: %v\n", errRun)
		} else {
			for _, re := range reply.Re {
				callerID := re.Map["caller-id"]
				username  := strings.TrimSpace(re.Map["name"])

				// FIX BUG 1: normalizeMac() memastikan format apapun dari MikroTik
				// (c8:3a:..., C8-3A-..., c83a35...) diubah ke 12 hex uppercase
				// sebelum dijadikan key, sehingga lookup dari Zabbix selalu cocok.
				key := normalizeMac(callerID)
				if key != "" && username != "" {
					macToCustomer[key] = username
				}

				// DEBUG: uncomment untuk cek format caller-id asli dari MikroTik
				// fmt.Printf("[DEBUG] caller-id raw: %q → normalized: %q → user: %q\n", callerID, key, username)
			}
			fmt.Printf("[INFO] PPPoE aktif dimuat: %d sesi\n", len(macToCustomer))
		}
	}

	// ================================================================
	// 2. LOGIN ZABBIX & TARIK ITEM "REDAMAN ONU"
	// ================================================================
	token, err := getZabbixAuthToken()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Gagal login ke Zabbix",
			"detail": err.Error(),
		})
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
		c.JSON(http.StatusBadGateway, gin.H{
			"error":  "Zabbix tidak merespon",
			"detail": errZ.Error(),
		})
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
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if errUnmarshal := json.Unmarshal(itemBody, &zabbixData); errUnmarshal != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Gagal parsing JSON Zabbix",
			"detail": errUnmarshal.Error(),
		})
		return
	}
	if zabbixData.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  "Zabbix API error",
			"detail": zabbixData.Error.Message,
		})
		return
	}

	// ================================================================
	// 3. MERGE DATA + UPSERT KE DATABASE
	// ================================================================
	const batasKritis = -25.0

	countNew      := 0
	countUpdate   := 0
	countCustomer := 0
	countSkip     := 0

	for _, item := range zabbixData.Result {

		// a. Ekstrak MAC dari nama item Zabbix (format: AA:BB:CC:DD:EE:FF untuk DB)
		dbMac := extractMacAddress(item.Name)
		if dbMac == "" {
			countSkip++
			continue
		}

		// b. Normalisasi MAC untuk lookup map (12 hex uppercase)
		// FIX BUG 1 (lanjutan): pakai normalizeMac(dbMac) sebagai lookup key,
		// BUKAN dbMac langsung — agar cocok dengan key di macToCustomer
		// yang juga sudah dinormalisasi dari MikroTik.
		lookupKey := normalizeMac(dbMac)

		// c. Exact match lookup — TANPA fuzzy match
		// FIX BUG 2: fuzzy match "11 digit sama" dihapus karena berbahaya.
		// Contoh: C83A353CAAB8 (Zabbix) vs C83A353CAAB9 (MikroTik tetangga)
		// → 11 digit sama → salah pasang customer ke ONU beda.
		// Exact match lebih aman. Jika tidak match, Customer tetap kosong
		// dan tidak menimpa data yang sudah ada.
		customerName := macToCustomer[lookupKey]
		if customerName != "" {
			countCustomer++
		}

		// d. Evaluasi redaman & notifikasi Telegram (anti-spam)
		rxPowerFloat, errParse := strconv.ParseFloat(item.Lastvalue, 64)
		if errParse == nil {
			if rxPowerFloat < batasKritis {
				var existingLog models.Log
				errLog := config.DB.
					Where("title = ? AND source = ? AND resolved = false", dbMac, "ONU").
					First(&existingLog).Error

				if errLog != nil {
					// Belum ada log aktif → buat baru + kirim notif
					pesan := fmt.Sprintf("Sinyal kritis: %s dBm (batas: %.0f dBm)", item.Lastvalue, batasKritis)
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
				// Sinyal sudah normal → auto-resolve log yang aktif
				config.DB.Model(&models.Log{}).
					Where("title = ? AND source = ? AND resolved = false", dbMac, "ONU").
					Updates(map[string]interface{}{
						"resolved":    true,
						"resolved_at": time.Now(),
					})
			}
		}

		// e. Upsert tabel ONU
		var existingOnu models.Onu
		result := config.DB.Where("mac_address = ?", dbMac).First(&existingOnu)

		if result.RowsAffected > 0 {
			updateData := map[string]interface{}{
				"rx_power": item.Lastvalue,
				"status":   "Online",
			}
			// Hanya update Customer jika PPPoE match ditemukan.
			// Tidak menimpa data yang sudah diisi manual saat pelanggan offline.
			if customerName != "" {
				updateData["customer"] = customerName
			}
			config.DB.Model(&existingOnu).Updates(updateData)
			countUpdate++
		} else {
			config.DB.Create(&models.Onu{
				MacAddress: dbMac,
				RxPower:    item.Lastvalue,
				Status:     "Online",
				Customer:   customerName,
			})
			countNew++
		}
	}

	// ================================================================
	// 4. RESPONSE — detail untuk debugging
	// ================================================================
	c.JSON(http.StatusOK, gin.H{
		"message":          "Sinkronisasi selesai",
		"total_zabbix":     len(zabbixData.Result),
		"total_pppoe":      len(macToCustomer),
		"onu_baru":         countNew,
		"onu_diupdate":     countUpdate,
		"customer_matched": countCustomer,
		"item_skip_no_mac": countSkip,
	})
}