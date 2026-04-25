package controllers

import (
	"affnet-backend/config"
	"affnet-backend/models"
	"affnet-backend/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

// UpdateOnuDetails: Menambahkan Nama & Lokasi pada MAC yang sudah disedot dari Zabbix
func UpdateOnuDetails(c *gin.Context) {
	macAddress := c.Param("mac") // Kita ambil MAC dari URL parameter

	var input struct {
		Customer  string `json:"customer"`
		Latitude  string `json:"latitude"`
		Longitude string `json:"longitude"`
		OdpID     *uint  `json:"odp_id"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Cari ONU berdasarkan MAC Address
	var existingOnu models.Onu
	if err := config.DB.Where("mac_address = ?", macAddress).First(&existingOnu).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ONU dengan MAC tersebut tidak ditemukan. Silakan Sync dari Zabbix dulu."})
		return
	}

	// PERBAIKAN: Gunakan map[string]interface{} agar nilai kosong ("") tetap bisa di-save
	updateData := map[string]interface{}{
		"customer":  input.Customer,
		"latitude":  input.Latitude,
		"longitude": input.Longitude,
		"odp_id":    input.OdpID,
	}

	if err := config.DB.Model(&existingOnu).Updates(updateData).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menyimpan perubahan ke database"})
		return
	}

	// Skenario 4: Catat log saat koordinat lokasi perangkat diubah
	if existingOnu.Latitude != input.Latitude || existingOnu.Longitude != input.Longitude {
		msg := "Lokasi koordinat perangkat ONU diperbarui (Lat: " + input.Latitude + ", Lon: " + input.Longitude + ")"
		services.RecordLog("info", "ONU", macAddress, msg)
	}

	// Ambil data terbaru setelah di-update (termasuk updated_at yang baru)
	config.DB.Where("mac_address = ?", macAddress).First(&existingOnu)

	c.JSON(http.StatusOK, gin.H{"message": "Data pelanggan berhasil diupdate", "data": existingOnu})
}

// GetAllOnu: Mengambil semua data ONU
func GetAllOnu(c *gin.Context) {
	var onus []models.Onu
	
	// PERBAIKAN: Tambahkan Order by ID biar urutan di tabel React nggak lompat-lompat pas auto-refresh
	if err := config.DB.Order("id asc").Find(&onus).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal mengambil data ONU"})
		return
	}
	
	c.JSON(http.StatusOK, onus)
}

// DeleteOnu: Menghapus data ONU
func DeleteOnu(c *gin.Context) {
	id := c.Param("id")
	if err := config.DB.Delete(&models.Onu{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus data ONU"})
		return
	}
	
	services.RecordLog("info", "ONU", "ID "+id, "Perangkat ONU telah dihapus dari sistem")

	c.JSON(http.StatusOK, gin.H{"message": "Data ONU berhasil dihapus"})
}