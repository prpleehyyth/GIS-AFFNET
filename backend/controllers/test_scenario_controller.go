package controllers

import (
	"fmt"
	"net/http"

	"affnet-backend/config"
	"affnet-backend/models"

	"github.com/gin-gonic/gin"
)

// =====================================================================
// 1. TEST ONU SCENARIO (SIMULASI UJI COBA ONU)
// =====================================================================
// TestOnuScenario: Endpoint khusus untuk testing 1 skenario
func TestOnuScenario(c *gin.Context) {
	var input struct {
		Scenario   int    `json:"scenario" binding:"required"`
		MacAddress string `json:"mac_address"` // Default 44:22:95:49:71:68 jika kosong
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mac := input.MacAddress
	if mac == "" {
		mac = "44:22:95:49:71:68"
	}

	if input.Scenario == 1 {
		// Skenario 1: Perangkat ONU dimatikan (RX Power drop jadi -30 dBm) TANPA LOG
		config.DB.Model(&models.Onu{}).Where("mac_address = ?", mac).Updates(map[string]interface{}{
			"rx_power": "-30.0",
		})

		c.JSON(http.StatusOK, gin.H{"message": "Skenario 1: Perangkat dimatikan (-30.0 dBm)."})
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Skenario tidak valid. Hanya skenario 1 yang tersedia."})
	}
}
