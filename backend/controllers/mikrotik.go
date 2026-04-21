package controllers

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"gopkg.in/routeros.v2"
)

func GetPPPoEActive(c *gin.Context) {
	// 1. Ambil kredensial dari file .env
	mkIp := os.Getenv("MIKROTIK_IP")       // Contoh: "192.168.1.1:8728"
	mkUser := os.Getenv("MIKROTIK_USER")
	mkPass := os.Getenv("MIKROTIK_PASS")

	// 2. Lakukan dial (koneksi) ke MikroTik API
	client, err := routeros.Dial(mkIp, mkUser, mkPass)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Gagal terhubung ke MikroTik",
			"detail": err.Error(),
		})
		return
	}
	defer client.Close() // Pastikan koneksi ditutup setelah selesai

	// 3. Eksekusi perintah terminal MikroTik: /ppp/active/print
	reply, err := client.Run("/ppp/active/print")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Gagal membaca data PPPoE",
			"detail": err.Error(),
		})
		return
	}

	// 4. Parsing data dari format MikroTik ke bentuk Array/List
	var activeUsers []map[string]string
	for _, re := range reply.Re {
		user := map[string]string{
			"username":  re.Map["name"],
			"ip_address": re.Map["address"],
			"mac_address": re.Map["caller-id"], // Caller ID biasanya berisi MAC Address router pelanggan
			"uptime":    re.Map["uptime"],
		}
		activeUsers = append(activeUsers, user)
	}

	// 5. Kembalikan data dalam format JSON
	c.JSON(http.StatusOK, gin.H{
		"status": "success",
		"total":  len(activeUsers),
		"data":   activeUsers,
	})
}