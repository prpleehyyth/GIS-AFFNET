package controllers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"affnet-backend/models"
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

	var zabbixResp interface{}
	json.NewDecoder(resp.Body).Decode(&zabbixResp)
	c.JSON(http.StatusOK, zabbixResp)
}