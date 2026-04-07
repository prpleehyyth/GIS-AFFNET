package controllers

import (
	"affnet-backend/config"
	"affnet-backend/models"
	"net/http"
    "fmt"
	"github.com/gin-gonic/gin"
)

func CreateOdp(c *gin.Context) {
	var odp models.Odp
	if err := c.ShouldBindJSON(&odp); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	config.DB.Create(&odp)
	c.JSON(http.StatusOK, odp)
}

func GetAllOdp(c *gin.Context) {
	var odps []models.Odp
	config.DB.Preload("Onus").Find(&odps)
	c.JSON(http.StatusOK, odps)
}

// Update ODP
func UpdateOdp(c *gin.Context) {
    id := c.Param("id")
    var odp models.Odp
    if err := config.DB.First(&odp, id).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "ODP tidak ditemukan"})
        return
    }

    if err := c.ShouldBindJSON(&odp); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    config.DB.Save(&odp)
    c.JSON(http.StatusOK, odp)
}

func DeleteOdp(c *gin.Context) {
    id := c.Param("id")

    var odp models.Odp
    
    // 1. Cari dulu tiang ODP-nya, ada nggak?
    if err := config.DB.First(&odp, id).Error; err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "Data ODP tidak ditemukan"})
        return
    }

    // 2. Putuskan SEMUA kabel ONU dari tiang ini secara resmi lewat GORM Association
    if err := config.DB.Model(&odp).Association("Onus").Clear(); err != nil {
        fmt.Println("🚨 ERROR CLEAR ONU:", err.Error())
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal melepaskan pelanggan dari ODP"})
        return
    }

    // 3. Setelah bersih dari pelanggan, baru eksekusi mati tiangnya
    if err := config.DB.Delete(&odp).Error; err != nil {
        fmt.Println("🚨 ERROR HAPUS ODP:", err.Error())
        c.JSON(http.StatusInternalServerError, gin.H{"error": "Gagal menghapus tiang ODP"})
        return
    }

    c.JSON(http.StatusOK, gin.H{"message": "ODP AFF NET berhasil dihapus bersih!"})
}