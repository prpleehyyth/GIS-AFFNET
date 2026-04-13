package main

import (
	"affnet-backend/config"
	"affnet-backend/controllers"
	"net/http"

	"github.com/gin-gonic/gin"
)

func main() {
	// Inisialisasi Database
	config.ConnectDB()

	r := gin.Default()

	// Middleware CORS
	r.Use(func(c *gin.Context) {
		// Sesuaikan dengan URL frontend kamu
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:8888")
		
		// Izinkan pengiriman Cookie/JWT
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		// Handle Preflight Request
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	})

	// API Route Grouping
	api := r.Group("/api")
	{
		// Authentication
		api.POST("/login", controllers.Login)
		api.POST("/logout", controllers.Logout)

		// ODP Management
		api.POST("/odp", controllers.CreateOdp)
		api.GET("/odp", controllers.GetAllOdp)
		api.PUT("/odp/:id", controllers.UpdateOdp)
		api.DELETE("/odp/:id", controllers.DeleteOdp)

		// ONU Management (Zabbix Integration)
		api.GET("/onu", controllers.GetAllOnu)              // List data dari DB lokal
		api.GET("/onu-sync", controllers.SyncOnuFromZabbix) // Tarik data terbaru dari Zabbix
		api.PUT("/onu/:mac", controllers.UpdateOnuDetails)  // Update info pelanggan & lokasi
		api.DELETE("/onu/:id", controllers.DeleteOnu)

		// Infrastructure Monitoring
		api.GET("/zabbix-infra", controllers.GetZabbixInfra) // Mikrotik & OLT

		//Write Logs
		// Write Logs
		api.GET("/logs",                   controllers.GetLogs)
		api.POST("/logs",                  controllers.CreateLog)
		api.PUT("/logs/:id/resolve",       controllers.ResolveLog)
		api.POST("/logs/resolve-by-title", controllers.ResolveLogByTitle)
		api.DELETE("/logs/:id",            controllers.DeleteLog)
		api.DELETE("/logs/resolved",       controllers.ClearResolvedLogs)

	}

	// Menjalankan server pada port 8080
	r.Run("0.0.0.0:8080")
}