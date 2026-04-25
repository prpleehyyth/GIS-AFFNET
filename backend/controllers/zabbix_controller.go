package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"affnet-backend/config"
	"affnet-backend/models"
	"affnet-backend/services"

	"github.com/gin-gonic/gin"
)

const (
	ZabbixURL  = "http://15.233.0.248:8080/api_jsonrpc.php"
	ZabbixUser = "Admin"
	ZabbixPass = "zabbix"
)

// Fungsi Helper untuk Login Otomatis ke Zabbix
func getZabbixAuthToken() (string, error) {
	payload := models.ZabbixRequest{
		Jsonrpc: "2.0",
		Method:  "user.login",
		Params:  map[string]string{"username": ZabbixUser, "password": ZabbixPass},
		ID:      1,
	}
	
	jb, _ := json.Marshal(payload)
	resp, err := http.Post(ZabbixURL, "application/json-rpc", bytes.NewBuffer(jb))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Result string `json:"result"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Result, nil
}

// GetZabbixInfra: Ambil Lokasi Mikrotik & OLT
func GetZabbixInfra(c *gin.Context) {
	token, err := getZabbixAuthToken()
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Gagal login ke Zabbix"})
		return
	}

	payload := models.ZabbixRequest{
		Jsonrpc: "2.0",
		Method:  "host.get",
		Params:  map[string]interface{}{
            // Pake "extend" biar Zabbix ngeluarin SEMUA datanya
            "output": "extend", 
            "selectInventory": []string{"location_lat", "location_lon", "location"},
            "selectInterfaces": "extend", // Panggil semua info interface
        },
		Auth: token,
		ID:   2,
	}

	jb, _ := json.Marshal(payload)
	resp, _ := http.Post(ZabbixURL, "application/json-rpc", bytes.NewBuffer(jb))
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal membaca response dari Zabbix"})
		return
	}

	// Parsing response untuk ngecek status perangkat (Infra)
	var zabbixRespStruct struct {
		Result []struct {
			Name       string `json:"name"`
			Hostid     string `json:"hostid"`
			Interfaces []struct {
				Available string `json:"available"`
			} `json:"interfaces"`
			Inventory struct {
				LocationLat string `json:"location_lat"`
				LocationLon string `json:"location_lon"`
				Location    string `json:"location"`
			} `json:"inventory"`
		} `json:"result"`
	}
	json.Unmarshal(bodyBytes, &zabbixRespStruct)

	// Cek apakah ada yang down, jika ya catat log
	for _, host := range zabbixRespStruct.Result {
		isDown := false
		for _, iface := range host.Interfaces {
			if iface.Available == "2" {
				isDown = true
				break
			}
		}

		nameLow := strings.ToLower(host.Name)
		deviceType := "Server (" + host.Name + ")"
		if strings.Contains(nameLow, "mikrotik") {
			deviceType = "Router MikroTik"
		} else if strings.Contains(nameLow, "olt") {
			deviceType = "OLT HiOSO"
		}

		// Skenario 1 & 2: Cek status down/up
		if isDown {
			services.RecordLog("critical", "Infra", host.Name, deviceType+" tidak merespons / down")
		} else {
			services.ResolveLog(host.Name, "Infra")
		}

		// Skenario 3 & 4: Cek Infra (untuk auto-discovery dan perubahan lokasi)
		var existingInfra models.Infra
		result := config.DB.Where("host_id = ?", host.Hostid).First(&existingInfra)

		lat := host.Inventory.LocationLat
		lon := host.Inventory.LocationLon

		if result.RowsAffected == 0 {
			// Skenario 3: Perangkat baru ditemukan
			config.DB.Create(&models.Infra{
				HostID: host.Hostid,
				Name:   host.Name,
				Lat:    lat,
				Lon:    lon,
			})
			msg := fmt.Sprintf("Perangkat %s baru terdeteksi via auto-discovery SNMP", deviceType)
			services.RecordLog("info", "Infra", host.Name, msg)
		} else {
			// Skenario 4: Mengubah koordinat lokasi perangkat
			// Hanya deteksi jika koordinat sebelumnya ada isinya (tidak kosong) atau jika berubah dari ada isinya ke isi yang berbeda
			if (existingInfra.Lat != lat || existingInfra.Lon != lon) && (lat != "" && lon != "") {
				msg := fmt.Sprintf("Lokasi koordinat %s berubah (Lat: %s, Lon: %s)", deviceType, lat, lon)
				services.RecordLog("info", "Infra", host.Name, msg)
				
				// Update DB agar tidak log berulang-ulang
				config.DB.Model(&existingInfra).Updates(map[string]interface{}{
					"lat": lat,
					"lon": lon,
				})
			}
		}
	}

	// Kirimkan response asli kembali ke frontend
	c.Data(http.StatusOK, "application/json", bodyBytes)
}